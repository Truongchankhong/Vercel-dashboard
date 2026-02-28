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

    // Smart Normalize RPRO logic
    // 1. Remove obvious delimiters like | from QR
    if (rpro.includes('|')) rpro = rpro.split('|').find(p => p.startsWith('RPRO')) || rpro;

    // 1. Extract RPRO from complex strings (using Regex)
    // Supports: 'RPRO-250101-1234', 'Order: RPRO-250101-1234, Qty: 50', '2501011234'
    const rproRegex = /RPRO-?\d{6}-?\d{1,4}/i;
    const match = rpro.match(rproRegex);

    let pureId = "";
    if (match) {
        // Use the matched part and clean it
        pureId = match[0].toUpperCase().replace(/RPRO-?/i, '').replace(/-+/g, '');
    } else {
        // Fallback: just take digits if no RPRO prefix found
        pureId = rpro.replace(/[^0-9]/g, '');
    }

    // 3. Re-construct standard format: RPRO-XXXXXX-XXXX
    if (pureId.length >= 7) {
        // Format YYMMDDXXXX -> RPRO-YYMMDD-XXXX
        rpro = `RPRO-${pureId.substring(0, 6)}-${pureId.substring(6)}`;
    } else if (pureId.length > 0) {
        rpro = 'RPRO-' + pureId;
    }

    // Final check for valid length if formatted partially
    if (rpro === 'RPRO-') {
        showToast("⚠️ Mã không hợp lệ hoặc không có dữ liệu RPRO!", "error");
        return;
    }

    rproInput.value = rpro;

    showToast("🔍 Đang tìm thông tin đơn hàng...", "info");

    try {
        // Tầng 0: Kiểm tra xem đơn này đã được nhập hàng dư chưa (để sửa)
        const { data: existingSurplus } = await supabase.from('surplusgoods').select('*').eq('rpro', rpro).maybeSingle();

        if (existingSurplus) {
            editingId = existingSurplus.id;
            activeOrderData = existingSurplus;

            clearFormFields();

            // Map legacy fields to match powerapp structure for displayOrderInfo
            const mappedData = {
                'PRO ODER': existingSurplus.rpro,
                'Brand Code': existingSurplus.brand_code,
                '#MOLD': existingSurplus.mold,
                'BOM': existingSurplus.bom,
                'PU DESCRIPTION': existingSurplus.pu,
                'FB DESCRIPTION': existingSurplus.fabric,
                'note': existingSurplus.note,
                ...existingSurplus // Include size columns
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
        let { data: order, error } = await supabase.from('powerapp').select('*').eq('PRO ODER', rpro).maybeSingle();

        // Tầng 2: Masterdata
        if (!order) {
            const { data: masterOrder } = await supabase.from('Masterdata').select('*').eq('PRO ODER', rpro).maybeSingle();
            order = masterOrder;
        }

        if (!order) {
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
    infoBrand.textContent = order['Brand Code'] || '-';
    infoMold.textContent = order['#MOLD'] || order['Mã Khuôn'] || '-';
    infoBom.textContent = order['BOM'] || '-';

    const puFull = order['PU DESCRIPTION'] || order['Mã dao'] || '-';
    const fbFull = order['FB DESCRIPTION'] || order['Tên vải'] || '-';

    infoPu.textContent = puFull;
    infoFabric.textContent = fbFull;

    // Add click event for full view
    infoPu.className = "text-[11px] font-bold text-teal-600 truncate block cursor-pointer hover:underline";
    infoPu.onclick = () => alert("Mã PU đầy đủ:\n" + puFull);

    infoFabric.className = "text-[11px] font-bold text-indigo-600 truncate block cursor-pointer hover:underline";
    infoFabric.onclick = () => alert("Mã Vải đầy đủ:\n" + fbFull);

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
    sizeInputPanel.classList.remove('opacity-50', 'pointer-events-none');
    if (sectionSelector) sectionSelector.classList.remove('opacity-50', 'pointer-events-none');
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

    const rpro = activeOrderData['PRO ODER'] || activeOrderData['rpro'];
    if (!activeSection) {
        showToast("⚠️ Vui lòng chọn Section!", "error");
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
        return;
    }

    const payload = {
        rpro: rpro,
        so: activeOrderData['SO'] || activeOrderData['so'] || activeOrderData['Sales Order'] || '',
        brand_code: activeOrderData['brand_code'] || activeOrderData['Brand Code'] || '',
        mold: activeOrderData['mold'] || activeOrderData['#MOLD'] || activeOrderData['Mã Khuôn'] || '',
        bom: activeOrderData['bom'] || activeOrderData['BOM'] || '',
        pu: activeOrderData['pu'] || activeOrderData['PU DESCRIPTION'] || activeOrderData['Mã dao'] || activeOrderData['PU'] || '',
        fabric: activeOrderData['fabric'] || activeOrderData['FB DESCRIPTION'] || activeOrderData['Tên vải'] || '',
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
    [infoBrand, infoMold, infoBom, infoPu, infoFabric].forEach(el => el.textContent = '-');

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
        query = query.or(`rpro.ilike.%${q}%,bom.ilike.%${q}%,fabric.ilike.%${q}%`);
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

    const puFull = data.pu || '-';
    const fbFull = data.fabric || '-';

    infoPu.textContent = puFull;
    infoFabric.textContent = fbFull;

    // Interactive elements for history preview as well
    infoPu.className = "text-[11px] font-bold text-teal-600 truncate block cursor-pointer hover:underline";
    infoPu.onclick = () => alert("Mã PU đầy đủ:\n" + puFull);

    infoFabric.className = "text-[11px] font-bold text-indigo-600 truncate block cursor-pointer hover:underline";
    infoFabric.onclick = () => alert("Mã Vải đầy đủ:\n" + fbFull);

    // Highlight UI
    orderInfoContainer.classList.remove('opacity-50', 'pointer-events-none');
    sizeInputPanel.classList.remove('opacity-50', 'pointer-events-none');

    // Fill standard sizes
    Object.keys(data).forEach(k => {
        if (k.startsWith('size_')) {
            const input = document.getElementById(k);
            if (input) input.value = data[k];
        }
    });

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
