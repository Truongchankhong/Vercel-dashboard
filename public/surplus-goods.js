import { supabase } from './supabaseClient.js';

// ==================== CONFIG & STATE ====================
const STANDARD_SIZES = [
    3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15
];

let activeOrderData = null; // Currently scanned RPRO data
let editingId = null; // Track if we are editing an existing surplus record
let extraSizes = []; // Any sizes found outside the standard range
let html5QrScanner = null;
let isScanning = false;
let activeSection = null; // LPS, MOLDING, LEANLINE
let currentSearchType = 'rpro'; // Default search type (History)
let currentRproType = 'rpro'; // Default search type (Scanning/Search)

// ==================== DOM ELEMENTS ====================
const rproInput = document.getElementById('rpro-input');
const btnSearchManual = document.getElementById('btn-search-manual');
const btnScanCamera = document.getElementById('btn-scan-camera');
const qrReaderDiv = document.getElementById('qr-reader');
const orderInfoContainer = document.getElementById('order-info-container');
const sizeInputPanel = document.getElementById('size-input-panel');
const sizeGrid = document.getElementById('size-grid');
const extraSizesContainer = document.getElementById('extra-sizes-container');
const extraSizeGrid = document.getElementById('extra-size-grid');
const sectionSelector = document.getElementById('section-selector');
const sectionBtns = document.querySelectorAll('.section-btn');
const btnSaveSurplus = document.getElementById('btn-save-surplus');
const btnDeleteSurplus = document.getElementById('btn-delete-surplus');
const btnNewEntry = document.getElementById('btn-new-entry');
const entryNote = document.getElementById('entry-note');
const historySearch = document.getElementById('history-search');
const historyList = document.getElementById('history-list');
const searchTypeBtns = document.querySelectorAll('.search-type-btn');
const rproTypeBtns = document.querySelectorAll('.rpro-type-btn');

// Export Elements
const btnExportExcel = document.getElementById('btn-export-excel');
const exportStartDate = document.getElementById('export-start-date');
const exportEndDate = document.getElementById('export-end-date');

// Info Display
const infoBrand = document.getElementById('info-brand');
const infoMold = document.getElementById('info-mold');
const infoBom = document.getElementById('info-bom');
const infoPu = document.getElementById('info-pu');
const infoFabric = document.getElementById('info-fabric');

// ==================== INITIALIZATION ====================

function init() {
    renderSizeGrid();
    setupEventListeners();
    // Set default dates for export (last 7 days)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    if (exportStartDate) exportStartDate.value = start.toISOString().split('T')[0];
    if (exportEndDate) exportEndDate.value = end.toISOString().split('T')[0];

    loadHistory();
}

function renderSizeGrid() {
    sizeGrid.innerHTML = STANDARD_SIZES.map(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        return `
            <div class="flex flex-col gap-1">
                <label class="text-[10px] font-black text-slate-500 text-center uppercase">Size ${size}</label>
                <input type="number" id="${id}" data-size="${size}" min="0" value="0"
                    class="size-input w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-teal-100 outline-none transition-all">
            </div>
        `;
    }).join('');
}

function setupEventListeners() {
    // Size Highlights & Event Delegation
    sizeGrid.addEventListener('input', (e) => {
        if (e.target.classList.contains('size-input')) updateSizeHighlights();
    });
    extraSizeGrid.addEventListener('input', (e) => {
        if (e.target.classList.contains('size-input')) updateSizeHighlights();
    });

    // Handheld scan & Enter key
    rproInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleScan(rproInput.value.trim());
    });

    // Manual Search Button
    if (btnSearchManual) {
        btnSearchManual.onclick = () => handleScan(rproInput.value.trim());
    }

    // Camera Scan
    btnScanCamera.onclick = toggleCamera;

    // Save
    btnSaveSurplus.onclick = saveSurplus;

    // Delete
    if (btnDeleteSurplus) {
        btnDeleteSurplus.onclick = deleteSurplus;
    }

    // New Entry
    btnNewEntry.onclick = resetEntry;

    // Search History
    historySearch.addEventListener('input', debounce(loadHistory, 300));

    // RPRO Input suggestions (for PU/Fabric)
    rproInput.addEventListener('input', debounce((e) => updateRPROSuggestions(e.target.value), 300));

    // Export Excel
    if (btnExportExcel) {
        btnExportExcel.onclick = exportSurplusExcel;
    }

    // Section Selector
    sectionBtns.forEach(btn => {
        btn.onclick = () => {
            const section = btn.dataset.section;
            updateActiveSection(section);
        };
    });

    // History Search Type Filters
    searchTypeBtns.forEach(btn => {
        btn.onclick = () => {
            currentSearchType = btn.dataset.type;
            updateSearchTypeUI();
            loadHistory();
        };
    });

    // Autocomplete for PU and Fabric
    infoPu.addEventListener('input', (e) => updateSuggestions('PU DESCRIPTION', e.target.value, 'pu-suggestions'));
    infoFabric.addEventListener('input', (e) => updateSuggestions('FB DESCRIPTION', e.target.value, 'fb-suggestions'));

    infoPu.addEventListener('click', () => { if (infoPu.readOnly && infoPu.value) alert("Mã PU đầy đủ:\n" + infoPu.value); });
    infoFabric.addEventListener('click', () => { if (infoFabric.readOnly && infoFabric.value) alert("Mã Vải đầy đủ:\n" + infoFabric.value); });

    // RPRO Search Type Selection
    rproTypeBtns.forEach(btn => {
        btn.onclick = () => {
            currentRproType = btn.dataset.type;
            updateRproTypeUI();
        };
    });

    // If RPRO is empty, check if PU+Fabric already exists when losing focus
    [infoPu, infoFabric].forEach(input => {
        input.addEventListener('blur', async () => {
            if (!rproInput.value.trim() && infoPu.value.trim() && infoFabric.value.trim()) {
                await checkExistingManualEntry();
            }
        });
    });
}

let suggestionTimeout = null;
async function updateSuggestions(column, value, datalistId) {
    if (value.length < 2) return;
    clearTimeout(suggestionTimeout);

    suggestionTimeout = setTimeout(async () => {
        try {
            // First try surplusgoods for existing manual entries
            const { data: surplusData } = await supabase.from('surplusgoods')
                .select(column)
                .ilike(column === 'PU DESCRIPTION' ? 'pu' : 'fabric', `%${value}%`)
                .limit(5);

            // Then try Masterdata for suggestions
            const { data: masterData } = await supabase.from('Masterdata')
                .select(column)
                .ilike(column, `%${value}%`)
                .limit(5);

            const allVals = new Set();
            if (surplusData) surplusData.forEach(d => allVals.add(d[column === 'PU DESCRIPTION' ? 'pu' : 'fabric']));
            if (masterData) masterData.forEach(d => allVals.add(d[column]));

            const datalist = document.getElementById(datalistId);
            datalist.innerHTML = Array.from(allVals).map(v => `<option value="${v}">`).join('');
        } catch (err) { console.error(err); }
    }, 300);
}

async function checkExistingManualEntry() {
    const pu = infoPu.value.trim();
    const fb = infoFabric.value.trim();

    // Search for a record where rpro is equivalent to PU/Fabric or rpro is empty and pu/fabric matches
    const { data, error } = await supabase.from('surplusgoods')
        .select('*')
        .eq('pu', pu)
        .eq('fabric', fb)
        .maybeSingle();

    if (data) {
        editingId = data.id;
        activeOrderData = data;
        loadSurplusDataToUI(data);
        showToast("📝 Đã tìm thấy đơn hàng cũ. Bạn có thể cập nhật!", "orange");
    }
}
async function updateRPROSuggestions(value) {
    if (value.length < 3) {
        const datalist = document.getElementById('rpro-suggestions');
        if (datalist) datalist.innerHTML = '';
        return;
    }

    if (currentRproType === 'rpro' && value.toUpperCase().startsWith('RPRO-')) return;

    try {
        const promises = [];
        const safeValue = value.trim();

        if (currentRproType === 'pu' || currentRproType === 'rpro') {
            promises.push(supabase.from('powerapp').select('*').ilike('PU DESCRIPTION', `%${safeValue}%`).limit(10));
            promises.push(supabase.from('Masterdata').select('*').ilike('PU DESCRIPTION', `%${safeValue}%`).limit(10));
            promises.push(supabase.from('powerapp').select('*').ilike('Mã dao', `%${safeValue}%`).limit(5));
        }

        if (currentRproType === 'fabric' || currentRproType === 'rpro') {
            promises.push(supabase.from('powerapp').select('*').ilike('FB DESCRIPTION', `%${safeValue}%`).limit(10));
            promises.push(supabase.from('Masterdata').select('*').ilike('FB DESCRIPTION', `%${safeValue}%`).limit(10));
            promises.push(supabase.from('powerapp').select('*').ilike('Tên vải', `%${safeValue}%`).limit(5));
            promises.push(supabase.from('Masterdata').select('*').ilike('Tên vải', `%${safeValue}%`).limit(5));
            promises.push(supabase.from('powerapp').select('*').ilike('FABRIC DESCRIPTION', `%${safeValue}%`).limit(5));
        }

        const results = await Promise.all(promises);
        const set = new Set();

        results.forEach(r => {
            if (r.data) {
                r.data.forEach(d => {
                    const pu = d['PU DESCRIPTION'] || d['Mã dao'] || d['pu'] || '';
                    const fb = d['FB DESCRIPTION'] || d['Tên vải'] || d['FABRIC DESCRIPTION'] || d['fabric'] || '';

                    if (currentRproType === 'pu') {
                        if (pu.toLowerCase().includes(safeValue.toLowerCase())) set.add(pu);
                    } else if (currentRproType === 'fabric') {
                        if (fb.toLowerCase().includes(safeValue.toLowerCase())) set.add(fb);
                    } else {
                        if (pu.toLowerCase().includes(safeValue.toLowerCase())) set.add(pu);
                        if (fb.toLowerCase().includes(safeValue.toLowerCase())) set.add(fb);
                    }
                });
            }
        });

        const dl = document.getElementById('rpro-suggestions');
        if (dl) dl.innerHTML = Array.from(set).map(s => `<option value="${s}">`).join('');
    } catch (e) { console.error("Error fetching suggestions:", e); }
}

function updateRproTypeUI() {
    rproTypeBtns.forEach(btn => {
        if (btn.dataset.type === currentRproType) {
            btn.classList.add('bg-slate-800', 'text-white', 'border-slate-800', 'shadow-sm');
            btn.classList.remove('border-slate-100', 'text-slate-500', 'hover:bg-slate-50');
        } else {
            btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-800', 'shadow-sm');
            btn.classList.add('border-slate-100', 'text-slate-500', 'hover:bg-slate-50');
        }
    });

    const placeholders = {
        rpro: "RPRO hoặc Tên PU, Fabric...",
        pu: "Nhập tên PU DESCRIPTION để tìm...",
        fabric: "Nhập tên FABRIC DESCRIPTION để tìm..."
    };
    rproInput.placeholder = placeholders[currentRproType] || "Nhập từ khóa tìm kiếm...";
}

function updateSearchTypeUI() {
    searchTypeBtns.forEach(btn => {
        if (btn.dataset.type === currentSearchType) {
            btn.classList.add('bg-slate-800', 'text-white', 'border-slate-800', 'shadow-sm');
            btn.classList.remove('border-slate-100', 'text-slate-500', 'hover:bg-slate-50');
        } else {
            btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-800', 'shadow-sm');
            btn.classList.add('border-slate-100', 'text-slate-500', 'hover:bg-slate-50');
        }
    });

    // Update placeholder based on type
    const placeholders = {
        rpro: "Tìm theo mã RPRO...",
        bom: "Tìm theo mã BOM...",
        pu: "Tìm theo mã PU / PU Description...",
        fabric: "Tìm theo tên Vải / Fabric..."
    };
    if (historySearch) historySearch.placeholder = placeholders[currentSearchType] || "Tìm kiếm...";
}

function updateActiveSection(section) {
    activeSection = section;
    sectionBtns.forEach(b => {
        if (b.dataset.section === section) {
            b.classList.add('bg-teal-600', 'text-white', 'border-teal-700', 'shadow-md');
            b.classList.remove('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
        } else {
            b.classList.remove('bg-teal-600', 'text-white', 'border-teal-700', 'shadow-md');
            b.classList.add('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
        }
    });
}

// ==================== SCAN LOGIC ====================

async function handleScan(text) {
    if (!text) return;
    let rpro = text.toUpperCase();

    // Distinguish between RPRO and PU/Fabric
    const isStandardRPRO = currentRproType === 'rpro' && (/RPRO/i.test(text) || /^\d{6,15}$/.test(text.replace(/[^0-9]/g, '')));

    if (isStandardRPRO) {
        if (rpro.includes('|')) rpro = rpro.split('|').find(p => p.startsWith('RPRO')) || rpro;
        const rproRegex = /RPRO-?\d{6}-?\d{1,4}/i;
        const match = rpro.match(rproRegex);

        let pureId = "";
        if (match) {
            pureId = match[0].toUpperCase().replace(/RPRO-?/i, '').replace(/-+/g, '');
        } else {
            pureId = rpro.replace(/[^0-9]/g, '');
        }

        if (pureId.length >= 7) {
            rpro = `RPRO-${pureId.substring(0, 6)}-${pureId.substring(6)}`;
        } else if (pureId.length > 0) {
            rpro = 'RPRO-' + pureId;
        }

        if (rpro === 'RPRO-') {
            showToast("⚠️ Mã không hợp lệ hoặc không có dữ liệu RPRO!", "error");
            return;
        }
        rproInput.value = rpro;
    } else {
        rpro = text;
    }

    showToast("🔍 Đang tìm thông tin đơn hàng...", "info");

    try {
        // Tầng 0: Kiểm tra surplusgoods
        let existingSurplusQuery = supabase.from('surplusgoods').select('*');
        if (currentRproType === 'pu') {
            existingSurplusQuery = existingSurplusQuery.ilike('pu', `%${rpro}%`);
        } else if (currentRproType === 'fabric') {
            existingSurplusQuery = existingSurplusQuery.ilike('fabric', `%${rpro}%`);
        } else {
            existingSurplusQuery = existingSurplusQuery.or(`rpro.eq."${rpro}",pu.eq."${rpro}",fabric.eq."${rpro}"`);
        }

        const { data: existingSurplus } = await existingSurplusQuery.maybeSingle();

        if (existingSurplus) {
            editingId = existingSurplus.id;
            activeOrderData = existingSurplus;
            clearFormFields();

            const mappedData = {
                'PRO ODER': existingSurplus.rpro,
                'Brand Code': existingSurplus.brand_code,
                '#MOLD': existingSurplus.mold,
                'BOM': existingSurplus.bom,
                'PU DESCRIPTION': existingSurplus.pu,
                'FB DESCRIPTION': existingSurplus.fabric,
                'note': existingSurplus.note,
                ...existingSurplus
            };

            displayOrderInfo(mappedData);
            loadSurplusDataToUI(existingSurplus);
            enableInput();
            updateSizeHighlights();
            if (btnDeleteSurplus) btnDeleteSurplus.classList.remove('hidden');
            showToast("📝 Đã tìm thấy đơn hàng cũ. Bạn có thể cập nhật!", "orange");
            return;
        }

        // Tầng 1: Powerapp
        let order;
        if (currentRproType === 'pu') {
            order = await supabase.from('powerapp').select('*').ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            if (!order) order = await supabase.from('powerapp').select('*').ilike('Mã dao', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
        } else if (currentRproType === 'fabric') {
            order = await supabase.from('powerapp').select('*').ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            if (!order) order = await supabase.from('powerapp').select('*').ilike('Tên vải', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            if (!order) order = await supabase.from('powerapp').select('*').ilike('FABRIC DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
        } else {
            order = await supabase.from('powerapp').select('*').eq('PRO ODER', rpro).maybeSingle().then(r => r.data);
            if (!order) order = await supabase.from('powerapp').select('*').ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            if (!order) order = await supabase.from('powerapp').select('*').ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
        }

        // Tầng 2: Masterdata
        if (!order) {
            if (currentRproType === 'pu') {
                order = await supabase.from('Masterdata').select('*').ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
                if (!order) order = await supabase.from('Masterdata').select('*').ilike('Mã dao', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            } else if (currentRproType === 'fabric') {
                order = await supabase.from('Masterdata').select('*').ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
                if (!order) order = await supabase.from('Masterdata').select('*').ilike('Tên vải', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
                if (!order) order = await supabase.from('Masterdata').select('*').ilike('FABRIC DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            } else {
                order = await supabase.from('Masterdata').select('*').eq('PRO ODER', rpro).maybeSingle().then(r => r.data);
                if (!order) order = await supabase.from('Masterdata').select('*').ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
                if (!order) order = await supabase.from('Masterdata').select('*').ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            }
        }

        if (!order) {
            if (text.length > 5) {
                enableInput();
                showToast("💡 Không thấy đơn hàng. Bạn có thể tự nhập thông tin!", "info");
                activeOrderData = { 'PRO ODER': '' };
                if (currentRproType === 'pu') infoPu.value = text;
                if (currentRproType === 'fabric') infoFabric.value = text;
                return;
            }
            showToast("❌ Không thấy đơn này trên hệ thống!", "error");
            return;
        }

        clearFormFields();

        activeOrderData = order;
        displayOrderInfo(order);
        detectExtraSizes(order);
        enableInput();
        showToast("✅ Tìm thấy dữ liệu. Mời nhập số lượng dôi!", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Lỗi hệ thống khi tìm dữ liệu", "error");
    }
}

function displayOrderInfo(order) {
    infoBrand.textContent = order['Brand Code'] || order['brand_code'] || '-';
    infoMold.textContent = order['#MOLD'] || order['Mã Khuôn'] || order['mold'] || '-';
    infoBom.textContent = order['BOM'] || order['bom'] || '-';

    const puFull = order['PU DESCRIPTION'] || order['Mã dao'] || order['pu'] || '';
    const fbFull = order['FB DESCRIPTION'] || order['Tên vải'] || order['fabric'] || '';

    infoPu.value = puFull;
    infoFabric.value = fbFull;
    infoPu.title = puFull;
    infoFabric.title = fbFull;

    orderInfoContainer.classList.remove('opacity-50', 'pointer-events-none');
}

function detectExtraSizes(order) {
    extraSizes = [];
    extraSizeGrid.innerHTML = '';
    extraSizesContainer.classList.add('hidden');

    // Scan all columns for size patterns
    Object.keys(order).forEach(key => {
        const num = parseFloat(key);
        if (!isNaN(num) && num > 0) {
            // Check if size has actual quantity in system
            const systemQty = parseFloat(order[key]);
            if (!STANDARD_SIZES.includes(num) && !isNaN(systemQty) && systemQty > 0) {
                extraSizes.push(num);
            }
        }
    });

    if (extraSizes.length > 0) {
        extraSizesContainer.classList.remove('hidden');
        extraSizeGrid.innerHTML = extraSizes.sort((a, b) => a - b).map(size => {
            const id = `size_${size.toString().replace('.', '_')}`;
            return `
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-orange-600 text-center uppercase">Size ${size}</label>
                    <input type="number" id="${id}" data-size="${size}" min="0" value="0"
                        class="size-input w-full bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all">
                </div>
            `;
        }).join('');
    }
}

function enableInput() {
    orderInfoContainer.classList.remove('opacity-50', 'pointer-events-none');
    sizeInputPanel.classList.remove('opacity-50', 'pointer-events-none');
    if (sectionSelector) sectionSelector.classList.remove('opacity-50', 'pointer-events-none');

    // Toggle manual edit if RPRO is missing/manual
    const rproVal = rproInput.value.trim();
    const isManual = !activeOrderData || (!activeOrderData['PRO ODER'] && !activeOrderData['PRO_ODER'] && !activeOrderData['rpro']);

    infoPu.readOnly = !isManual;
    infoFabric.readOnly = !isManual;

    if (isManual) {
        infoPu.classList.add('bg-white', 'ring-2', 'ring-teal-100', 'p-1', 'rounded-lg');
        infoFabric.classList.add('bg-white', 'ring-2', 'ring-indigo-100', 'p-1', 'rounded-lg');
        infoPu.classList.remove('cursor-pointer');
        infoFabric.classList.remove('cursor-pointer');
    } else {
        infoPu.classList.remove('bg-white', 'ring-2', 'ring-teal-100', 'p-1', 'rounded-lg');
        infoFabric.classList.remove('bg-white', 'ring-2', 'ring-indigo-100', 'p-1', 'rounded-lg');
        infoPu.classList.add('cursor-pointer');
        infoFabric.classList.add('cursor-pointer');
    }
}

// ==================== CAMERA SCANNER ====================

function toggleCamera() {
    if (isScanning) {
        stopCamera();
    } else {
        startCamera();
    }
}

async function startCamera() {
    qrReaderDiv.classList.remove('hidden');
    html5QrScanner = new Html5Qrcode("qr-reader");

    try {
        await html5QrScanner.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                stopCamera();
                handleScan(decodedText);
            },
            () => { }
        );
        isScanning = true;
        btnScanCamera.innerHTML = "⏹️ Dừng";
    } catch (err) {
        console.error(err);
        showToast("❌ Không mở được camera", "error");
    }
}

async function stopCamera() {
    if (html5QrScanner) {
        await html5QrScanner.stop();
        qrReaderDiv.classList.add('hidden');
        isScanning = false;
        btnScanCamera.innerHTML = "📷";
    }
}

// ==================== SAVE LOGIC ====================

async function saveSurplus() {
    if (!activeOrderData) return;

    btnSaveSurplus.disabled = true;
    btnSaveSurplus.textContent = "⏳ Đang lưu...";

    let rpro = rproInput.value.trim() || activeOrderData['PRO ODER'] || activeOrderData['rpro'];
    const pu = infoPu.value.trim();
    const fabric = infoFabric.value.trim();

    if (!rpro) {
        // Fallback RPRO identifier for manual entries
        if (!pu || !fabric) {
            showToast("⚠️ Nếu không có RPRO, vui lòng nhập cả PU và Fabric!", "error");
            btnSaveSurplus.disabled = false;
            btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
            return;
        }
        rpro = `MANUAL-${pu.substring(0, 10)}-${fabric.substring(0, 10)}`.replace(/\s+/g, '-').toUpperCase();
    }

    if (!activeSection) {
        showToast("⚠️ Vui lòng chọn Section!", "error");
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
        return;
    }

    const payload = {
        rpro: rpro,
        so: activeOrderData['SO'] || activeOrderData['so'] || activeOrderData['Sales Order'] || '',
        brand_code: infoBrand.textContent === '-' ? '' : infoBrand.textContent,
        mold: infoMold.textContent === '-' ? '' : infoMold.textContent,
        bom: infoBom.textContent === '-' ? '' : infoBom.textContent,
        pu: pu,
        fabric: fabric,
        section: activeSection,
        note: entryNote.value.trim(),
        dynamic_sizes: {}
    };

    let hasAnyQty = false;

    // Collect standard sizes
    STANDARD_SIZES.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const val = parseFloat(document.getElementById(id)?.value) || 0;
        payload[`size_${size.toString().replace('.', '_')}`] = val;
        if (val > 0) hasAnyQty = true;
    });

    // Collect extra sizes
    extraSizes.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const val = parseFloat(document.getElementById(id)?.value) || 0;
        payload.dynamic_sizes[size] = val;
        if (val > 0) hasAnyQty = true;
    });

    if (!hasAnyQty) {
        showToast("⚠️ Vui lòng nhập số lượng cho ít nhất một size!", "error");
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
        return;
    }

    try {
        let result;
        if (editingId) {
            // UPDATE existing
            result = await supabase.from('surplusgoods').update(payload).eq('id', editingId);
        } else {
            // INSERT new
            result = await supabase.from('surplusgoods').insert([payload]);
        }

        if (result.error) throw result.error;

        showToast("🎉 Lưu thông tin thành công!", "success");
        if (btnDeleteSurplus) btnDeleteSurplus.classList.add('hidden');
        loadHistory();
        resetEntry();
    } catch (err) {
        console.error(err);
        showToast("❌ Lỗi khi lưu: " + err.message, "error");
    } finally {
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
    }
}

async function deleteSurplus() {
    if (!editingId) return;

    if (!confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA ĐƠN NÀY KHÔNG?\nHành động này không thể hoàn tác!")) {
        return;
    }

    btnDeleteSurplus.disabled = true;
    btnDeleteSurplus.textContent = "⌛ Đang xóa...";

    try {
        const { error } = await supabase.from('surplusgoods').delete().eq('id', editingId);
        if (error) throw error;

        showToast("🗑️ Đã xóa đơn hàng dôi thành công!", "success");
        resetEntry();
        loadHistory();
    } catch (err) {
        console.error(err);
        showToast("❌ Lỗi khi xóa: " + err.message, "error");
    } finally {
        btnDeleteSurplus.disabled = false;
        btnDeleteSurplus.textContent = "🗑️ Xóa đơn";
    }
}

// Function to load surplus record data back into the form
function loadSurplusDataToUI(data) {
    entryNote.value = data.note || '';

    // Fill standard sizes
    STANDARD_SIZES.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const input = document.getElementById(id);
        if (input) input.value = data[id] || 0;
    });

    // Handle extra sizes
    extraSizes = [];
    extraSizeGrid.innerHTML = '';
    extraSizesContainer.classList.add('hidden');

    const dyn = data.dynamic_sizes || {};
    const dynKeys = Object.keys(dyn).map(k => parseFloat(k));

    if (dynKeys.length > 0) {
        extraSizes = dynKeys;
        extraSizesContainer.classList.remove('hidden');
        extraSizeGrid.innerHTML = dynKeys.sort((a, b) => a - b).map(size => {
            const id = `size_${size.toString().replace('.', '_')}`;
            return `
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-orange-600 text-center uppercase">Size ${size}</label>
                    <input type="number" id="${id}" data-size="${size}" min="0" value="${dyn[size]}"
                        class="size-input w-full bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all">
                </div>
            `;
        }).join('');
    }
    if (data.section) {
        updateActiveSection(data.section);
    }

    updateSizeHighlights();
}

function resetEntry() {
    activeOrderData = null;
    editingId = null;
    if (btnDeleteSurplus) btnDeleteSurplus.classList.add('hidden');
    extraSizes = [];
    rproInput.value = '';
    clearFormFields();
    rproInput.focus();
}

// Logic to clear all fields except RPRO input
function clearFormFields() {
    entryNote.value = '';
    extraSizesContainer.classList.add('hidden');
    extraSizeGrid.innerHTML = '';

    // Clear standard sizes
    STANDARD_SIZES.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const input = document.getElementById(id);
        if (input) input.value = 0;
    });

    // Reset UI states
    orderInfoContainer.classList.add('opacity-50', 'pointer-events-none');
    sizeInputPanel.classList.add('opacity-50', 'pointer-events-none');
    if (sectionSelector) sectionSelector.classList.add('opacity-50', 'pointer-events-none');

    // Reset section buttons
    activeSection = null;
    sectionBtns.forEach(b => {
        b.classList.remove('bg-teal-600', 'text-white', 'border-teal-700', 'shadow-md');
        b.classList.add('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
    });

    // Reset info text
    [infoBrand, infoMold, infoBom].forEach(el => el.textContent = '-');
    [infoPu, infoFabric].forEach(el => el.value = '');

    updateSizeHighlights();
}

function updateSizeHighlights() {
    document.querySelectorAll('.size-input').forEach(input => {
        const val = parseFloat(input.value) || 0;
        const isExtra = input.closest('#extra-size-grid');

        if (val > 0) {
            // Highlighted state: Soft color, dark font, readable selection
            if (isExtra) {
                input.className = "size-input w-full bg-orange-200 border-2 border-orange-400 p-2 rounded-xl text-center font-black text-slate-800 shadow-md ring-4 ring-orange-50 outline-none transition-all scale-105 z-10";
            } else {
                input.className = "size-input w-full bg-teal-200 border-2 border-teal-400 p-2 rounded-xl text-center font-black text-slate-800 shadow-md ring-4 ring-teal-50 outline-none transition-all scale-105 z-10";
            }
        } else {
            // Normal state
            if (isExtra) {
                input.className = "size-input w-full bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all";
            } else {
                input.className = "size-input w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-teal-100 outline-none transition-all";
            }
        }
    });
}

// ==================== HISTORY & SEARCH ====================

async function loadHistory() {
    const q = historySearch.value.trim();

    let query = supabase.from('surplusgoods').select('*').order('created_at', { ascending: false }).limit(20);

    if (q) {
        // Targeted search based on selected type
        let rqlColumn = "rpro";
        if (currentSearchType === "bom") rqlColumn = "bom";
        if (currentSearchType === "pu") rqlColumn = "pu";
        if (currentSearchType === "fabric") rqlColumn = "fabric";

        query = query.ilike(rqlColumn, `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return;
    }

    const filtered = data; // Already filtered by database if q exists

    if (filtered.length === 0) {
        historyList.innerHTML = `<div class="p-8 text-center text-slate-300 italic text-sm">Không tìm thấy dữ liệu phù hợp.</div>`;
        return;
    }

    historyList.innerHTML = filtered.map(item => {
        // Calculate total qty
        let total = 0;
        Object.keys(item).forEach(k => {
            if (k.startsWith('size_') && !isNaN(item[k])) total += item[k];
        });
        Object.values(item.dynamic_sizes || {}).forEach(v => {
            if (!isNaN(v)) total += v;
        });

        return `
            <div onclick="previewEntry('${item.id}')" class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">${item.rpro}</span>
                    <span class="text-[10px] font-bold text-slate-400">${new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                <div class="flex justify-between items-end">
                    <div>
                        <p class="text-xs font-bold text-slate-700">BOM: ${item.bom || '-'}</p>
                        <p class="text-[10px] text-slate-400 italic">${item.mold || '-'}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-black text-slate-800">${total}</span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase ml-1">đôi dôi</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Function to preview an entry from history
window.previewEntry = async (id) => {
    showToast("📥 Đang tải thông tin chi tiết...", "info");
    const { data, error } = await supabase.from('surplusgoods').select('*').eq('id', id).single();
    if (error || !data) return;

    resetEntry();
    editingId = data.id;
    if (btnDeleteSurplus) btnDeleteSurplus.classList.remove('hidden');
    activeOrderData = data; // Ensure saving from preview also works
    rproInput.value = data.rpro;
    entryNote.value = data.note || '';
    infoBrand.textContent = data.brand_code || '-';
    infoMold.textContent = data.mold || '-';
    infoBom.textContent = data.bom || '-';

    const puFull = data.pu || '';
    const fbFull = data.fabric || '';

    infoPu.value = puFull;
    infoFabric.value = fbFull;
    infoPu.title = puFull;
    infoFabric.title = fbFull;

    // Highlight UI
    enableInput();

    // Fill standard sizes
    Object.keys(data).forEach(k => {
        if (k.startsWith('size_')) {
            const input = document.getElementById(k);
            if (input) input.value = data[k];
        }
    });

    // Load section if exists
    if (data.section) {
        updateActiveSection(data.section);
    }

    // Check for dynamic sizes from this record
    const dyn = data.dynamic_sizes || {};
    const dynKeys = Object.keys(dyn).map(k => parseFloat(k));

    if (dynKeys.length > 0) {
        extraSizes = dynKeys;
        extraSizesContainer.classList.remove('hidden');
        extraSizeGrid.innerHTML = dynKeys.sort((a, b) => a - b).map(size => {
            const id = `size_${size.toString().replace('.', '_')}`;
            return `
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-orange-600 text-center uppercase">Size ${size}</label>
                    <input type="number" id="${id}" data-size="${size}" min="0" value="${dyn[size]}"
                        class="size-input w-full bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all">
                </div>
            `;
        }).join('');
    }
    updateSizeHighlights();
};

// ==================== UI MISC ====================

function showToast(msg, type = "success") {
    const toast = document.getElementById('toast');
    toast.textContent = msg;

    const colors = {
        success: "bg-emerald-600 border-b-4 border-emerald-800",
        error: "bg-rose-600 border-b-4 border-rose-800",
        info: "bg-sky-600 border-b-4 border-sky-800",
        orange: "bg-orange-500 border-b-4 border-orange-700"
    };

    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-bold transition-all duration-300 transform translate-y-0 opacity-100 ${colors[type] || colors.success}`;

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, 20px)";
    }, 3000);
}

// ==================== EXCEL EXPORT ====================

async function exportSurplusExcel() {
    const start = exportStartDate.value;
    const end = exportEndDate.value;

    if (!start || !end) {
        showToast("⚠️ Vui lòng chọn khoảng ngày!", "error");
        return;
    }

    showToast("⏳ Đang chuẩn bị dữ liệu Excel...", "info");
    btnExportExcel.disabled = true;

    try {
        const startTimestamp = `${start}T00:00:00`;
        const endTimestamp = `${end}T23:59:59`;

        const { data, error } = await supabase
            .from('surplusgoods')
            .select('*')
            .gte('created_at', startTimestamp)
            .lte('created_at', endTimestamp)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            showToast("❌ Không có dữ liệu trong khoảng ngày này!", "error");
            btnExportExcel.disabled = false;
            return;
        }

        // Prepare data for XLSX
        const exportData = data.map(item => {
            const row = {
                'Ngày nhập': new Date(item.created_at).toLocaleString('vi-VN'),
                'Mã RPRO': item.rpro,
                'Sales Order': item.so || '',
                'Brand': item.brand_code || '',
                'Mold': item.mold || '',
                'BOM': item.bom || '',
                'PU': item.pu || '',
                'Fabric': item.fabric || '',
                'Section': item.section || '',
                'Ghi chú': item.note || ''
            };

            // Add standard sizes
            STANDARD_SIZES.forEach(size => {
                const colName = `Size ${size}`;
                const key = `size_${size.toString().replace('.', '_')}`;
                row[colName] = item[key] || 0;
            });

            // Add dynamic/extra sizes
            const dyn = item.dynamic_sizes || {};
            Object.keys(dyn).forEach(sz => {
                row[`Size ${sz} (Lạ)`] = dyn[sz];
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Surplus_Goods");

        const fileName = `Surplus_Goods_${start}_den_${end}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        showToast("✅ Đã tải file Excel thành công!", "success");
    } catch (err) {
        console.error(err);
        showToast("❌ Lỗi xuất Excel: " + err.message, "error");
    } finally {
        btnExportExcel.disabled = false;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Start everything
document.addEventListener('DOMContentLoaded', init);
