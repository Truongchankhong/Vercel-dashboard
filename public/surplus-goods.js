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
let isSplittingOrder = false; // Flag for splitting a manual record
let currentMSNV = null; // Store MSNV for MOLDING

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
const btnSplitSurplus = document.getElementById('btn-split-surplus');
const btnNewEntry = document.getElementById('btn-new-entry');
const entryNote = document.getElementById('entry-note');
const historySearch = document.getElementById('history-search');
const historyList = document.getElementById('history-list');
const searchTypeBtns = document.querySelectorAll('.search-type-btn');
const rproTypeBtns = document.querySelectorAll('.rpro-type-btn');
const btnTutorial = document.getElementById('btn-tutorial');

// Export Elements
const btnExportExcel = document.getElementById('btn-export-excel');
const exportStartDate = document.getElementById('export-start-date');
const exportEndDate = document.getElementById('export-end-date');

// Specialized History Search (Molding)
const moldingHistorySearchContainer = document.getElementById('molding-history-search-container');
const defaultHistorySearchContainer = document.getElementById('default-history-search-container');
const moldingHistoryRpro = document.getElementById('molding-history-rpro');
const moldingHistoryMold = document.getElementById('molding-history-mold');
const moldingHistoryPu = document.getElementById('molding-history-pu');
const moldingHistoryFb = document.getElementById('molding-history-fb');
const btnSearchHistoryMolding = document.getElementById('btn-search-history-molding');

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

    // Parse URL parameter for section
    const params = new URLSearchParams(window.location.search);
    const urlSection = params.get('section');
    if (urlSection) {
        updateActiveSection(urlSection);
        if (sectionSelector) sectionSelector.classList.add('hidden');

        const sectionDisplay = document.getElementById('current-section-display');
        if (sectionDisplay) {
            sectionDisplay.textContent = urlSection.toUpperCase();
            sectionDisplay.classList.remove('hidden');
        }

        if (urlSection.toUpperCase() === 'MOLDING') {
            const modal = document.getElementById('msnv-modal');
            const content = document.getElementById('msnv-modal-content');
            if (modal && content) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 10);
                document.getElementById('msnv-input').focus();
            }
        }
    }

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

    // Molding Manual Search Button
    const btnSearchMolding = document.getElementById('btn-search-molding');
    if (btnSearchMolding) {
        btnSearchMolding.onclick = () => handleScanMolding();
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
    const chkSearchAllSections = document.getElementById('search-all-sections');
    if (chkSearchAllSections) {
        chkSearchAllSections.addEventListener('change', loadHistory);
    }
    if (btnSearchHistoryMolding) {
        btnSearchHistoryMolding.onclick = loadHistory;
    }

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
    infoPu.addEventListener('input', (e) => {
        if (!infoPu.readOnly) updateSuggestions('PU DESCRIPTION', e.target.value, 'info-pu', 'pu-suggestions');
    });
    infoFabric.addEventListener('input', (e) => {
        if (!infoFabric.readOnly) updateSuggestions('FB DESCRIPTION', e.target.value, 'info-fabric', 'fb-suggestions');
    });

    // Manual Split Event
    if (btnSplitSurplus) {
        btnSplitSurplus.addEventListener('click', (e) => {
            e.preventDefault(); // Tránh lỗi form submit nếu có
            editingId = null; // Gỡ bỏ liên kết với đơn cũ
            isSplittingOrder = true; // Bật cờ tách đơn
            btnSplitSurplus.classList.add('hidden');
            if (btnSaveSurplus) btnSaveSurplus.textContent = "💾 LƯU PHIẾU TÁCH MỚI";
            alert("✂️ Đã chuyển sang chế độ Tách Đơn!\nPhiếu nhập này sẽ được lưu thành một dòng riêng biệt, không đè lên lượng tồn cũ.");
            showToast("Đã kích hoạt Tách đơn!", "success");
        });
    }

    infoPu.addEventListener('click', () => { if (infoPu.readOnly && infoPu.value) alert("Mã PU đầy đủ:\n" + infoPu.value); });
    infoFabric.addEventListener('click', () => { if (infoFabric.readOnly && infoFabric.value) alert("Mã Vải đầy đủ:\n" + infoFabric.value); });

    // RPRO Search Type Selection
    rproTypeBtns.forEach(btn => {
        btn.onclick = () => {
            currentRproType = btn.dataset.type;
            updateRproTypeUI();
        };
    });

    // Check if PU+Fabric already exists dynamically as the user types or leaves the field
    const checkDuplicateDebounced = debounce(async () => {
        // Chỉ quét trùng lặp khi đang ở chế độ nhập tay bằng PU hoặc Fabric
        if ((currentRproType === 'pu' || currentRproType === 'fabric') && infoPu.value.trim() && infoFabric.value.trim()) {
            await checkExistingManualEntry();
        }
    }, 500);

    [infoPu, infoFabric].forEach(input => {
        input.addEventListener('input', checkDuplicateDebounced);
        input.addEventListener('blur', checkDuplicateDebounced);
    });

    // MSNV Modal Events
    const btnMsnvOk = document.getElementById('btn-msnv-ok');
    const btnMsnvCancel = document.getElementById('btn-msnv-cancel');
    const msnvInput = document.getElementById('msnv-input');
    const msnvModal = document.getElementById('msnv-modal');

    if (btnMsnvOk && msnvInput) {
        btnMsnvOk.onclick = () => {
            const val = msnvInput.value.trim();
            if (!val) {
                alert("Vui lòng nhập Mã số nhân viên!");
                msnvInput.focus();
                return;
            }
            currentMSNV = val;
            if (msnvModal) {
                msnvModal.classList.remove('flex'); msnvModal.classList.add('hidden');
            }
        };
    }
    if (btnMsnvCancel) {
        btnMsnvCancel.onclick = () => {
            if (msnvModal) {
                msnvModal.classList.remove('flex'); msnvModal.classList.add('hidden');
            }
            // MOLDING requires MSNV, maybe redirect to home if canceled?
            window.location.href = 'surplus-landing.html';
        };
    }

    // Total Qty Override Sync
    const totalQtyOverride = document.getElementById('total-qty-override');
    if (totalQtyOverride) {
        // If user manually types into total-qty-override, we don't automatically clear sizing grid.
        // But when sizes are edited, the total-qty-override could be updated automatically if we want,
        // or we just leave them independent.
        // In the requirement: "người dùng có quyền nhập theo size, số tổng tự nhảy hoặc không cần nhập theo size, nhập luôn số tổng cũng ok."
        // We will update totalQtyOverride whenever updateSizeHighlights() runs.
    }

    // Tutorial
    if (btnTutorial) {
        btnTutorial.onclick = startTutorial;
    }
}

function renderCustomDropdown(inputId, dropdownId, valuesArray) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    if (!valuesArray || valuesArray.length === 0) {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.innerHTML = valuesArray.map(val => {
        // Securely escape HTML characters to prevent breaking attributes (like double quotes in Fabric names)
        const safeVal = (val || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
        <div class="px-4 py-3 border-b border-slate-100 text-sm cursor-pointer hover:bg-teal-50 text-slate-700 transition"
             onclick="selectDropdownItem('${inputId}', '${dropdownId}', this.getAttribute('data-value'))" 
             data-value="${safeVal}">
             ${safeVal}
        </div>
        `;
    }).join('');
    dropdown.classList.remove('hidden');
}

window._isSubmittingDropdown = false;
window.selectDropdownItem = function (inputId, dropdownId, value) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (input) {
        window._isSubmittingDropdown = true; // Prevent reopening
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger background tasks
        setTimeout(() => { window._isSubmittingDropdown = false; }, 200); // Release lock
    }
    if (dropdown) dropdown.classList.add('hidden');
};

// Hide dropdowns when clicking outside
document.addEventListener('click', (e) => {
    ['rpro-suggestions', 'pu-suggestions', 'fb-suggestions'].forEach(id => {
        const dd = document.getElementById(id);
        const input = document.getElementById(id.replace('-suggestions', '-input').replace('pu-', 'info-pu').replace('fb-', 'info-fabric')); // Simplified mapping
        let relatedInput = null;
        if (id === 'rpro-suggestions') relatedInput = document.getElementById('rpro-input');
        if (id === 'pu-suggestions') relatedInput = document.getElementById('info-pu');
        if (id === 'fb-suggestions') relatedInput = document.getElementById('info-fabric');

        if (dd && !dd.contains(e.target) && relatedInput && !relatedInput.contains(e.target)) {
            dd.classList.add('hidden');
        }
    });
});

let suggestionTimeout = null;
async function updateSuggestions(column, value, inputId, datalistId) {
    if (window._isSubmittingDropdown) return; // Do not fetch if recently selected an item
    if (value.length < 2) {
        renderCustomDropdown(inputId, datalistId, []);
        return;
    }
    clearTimeout(suggestionTimeout);

    suggestionTimeout = setTimeout(async () => {
        try {
            const promises = [];
            const isPu = column === 'PU DESCRIPTION';
            const val = value.trim();

            // surplusgoods table uses 'pu' and 'fabric' - OPTIMIZED: Select only needed column
            promises.push(supabase.from('surplusgoods')
                .select(isPu ? 'pu' : 'fabric')
                .ilike(isPu ? 'pu' : 'fabric', `%${val}%`)
                .limit(5));

            if (isPu) {
                // OPTIMIZED: Select only PU DESCRIPTION
                promises.push(supabase.from('powerapp').select('"PU DESCRIPTION"').ilike('PU DESCRIPTION', `%${val}%`).limit(5));
                promises.push(supabase.from('Masterdata').select('"PU DESCRIPTION"').ilike('PU DESCRIPTION', `%${val}%`).limit(5));
            } else {
                // OPTIMIZED: Select only FB DESCRIPTION
                promises.push(supabase.from('powerapp').select('"FB DESCRIPTION"').ilike('FB DESCRIPTION', `%${val}%`).limit(5));
                promises.push(supabase.from('Masterdata').select('"FB DESCRIPTION"').ilike('FB DESCRIPTION', `%${val}%`).limit(5));
            }

            const results = await Promise.all(promises);

            // Abort rendering if user typed more or selected an item while the network request was in-flight
            const currentInputElement = document.getElementById(inputId);
            if (!currentInputElement || currentInputElement.value.trim() !== val) return;

            const allVals = new Set();

            results.forEach(r => {
                if (r.data) {
                    r.data.forEach(d => {
                        if (isPu) {
                            const pu = d['PU DESCRIPTION'] || d['Mã dao'] || d['pu'];
                            if (pu && pu.toLowerCase().includes(val.toLowerCase())) allVals.add(pu);
                        } else {
                            const fb = d['FB DESCRIPTION'] || d['Tên vải'] || d['FABRIC DESCRIPTION'] || d['fabric'];
                            if (fb && fb.toLowerCase().includes(val.toLowerCase())) allVals.add(fb);
                        }
                    });
                }
            });

            renderCustomDropdown(inputId, datalistId, Array.from(allVals));
        } catch (err) { console.error("Error fetching suggestions:", err); }
    }, 300);
}

async function checkExistingManualEntry() {
    const pu = infoPu.value.trim();
    const fb = infoFabric.value.trim();

    // Search for a record where pu/fabric matches
    let query = supabase.from('surplusgoods')
        .select('*')
        .eq('pu', pu)
        .eq('fabric', fb)
        .order('created_at', { ascending: false })
        .limit(1);

    if (activeSection) {
        query = query.eq('section', activeSection);
    }

    const { data, error } = await query;
    const existingData = data && data.length > 0 ? data[0] : null;

    if (existingData) {
        // Prevent re-triggering loader if it's already the same ID
        if (editingId !== existingData.id) {
            editingId = existingData.id;
            activeOrderData = existingData;
            loadSurplusDataToUI(existingData);
            alert("⚠️ CẢNH BÁO TỪ HỆ THỐNG:\nĐơn hàng với cặp PU và VẢI này ĐÃ TỒN TẠI ở khu vực hiện tại!\n\nHệ thống đã điền lại số lượng tồn cũ và chuyển sang chế độ CẬP NHẬT GHI ĐÈ.\n\nNếu đây là đơn nhập mới, vui lòng nhấn nút '✂️ TÁCH ĐƠN' màu vàng để lưu độc lập.");
            if (btnSplitSurplus) btnSplitSurplus.classList.remove('hidden');
            if (btnSaveSurplus) btnSaveSurplus.textContent = "💾 CHẤP NHẬN GHI ĐÈ";

            // Enable inputs just in case they were locked
            enableInput();
            updateSizeHighlights();
        }
    }
}
async function updateRPROSuggestions(value) {
    if (window._isSubmittingDropdown) return; // Do not fetch if recently selected an item
    if (value.length < 3) {
        renderCustomDropdown('rpro-input', 'rpro-suggestions', []);
        return;
    }

    if (value.length > 100) return; // Prevent searching for massive strings (like accidentally pasted SQL)

    try {
        const promises = [];
        const safeValue = value.trim();

        if (currentRproType === 'pu' || currentRproType === 'rpro') {
            // TỐI ƯU: Chỉ search powerapp, không search Masterdata cho suggestions để tránh treo DB
            promises.push(supabase.from('powerapp').select('"PU DESCRIPTION", "FB DESCRIPTION"').ilike('PU DESCRIPTION', `%${safeValue}%`).limit(10));
            // promises.push(supabase.from('Masterdata').select('"PU DESCRIPTION", "FB DESCRIPTION"').ilike('PU DESCRIPTION', `%${safeValue}%`).limit(10));
        }

        if (currentRproType === 'fabric' || currentRproType === 'rpro') {
            promises.push(supabase.from('powerapp').select('"PU DESCRIPTION", "FB DESCRIPTION"').ilike('FB DESCRIPTION', `%${safeValue}%`).limit(10));
            // promises.push(supabase.from('Masterdata').select('"PU DESCRIPTION", "FB DESCRIPTION"').ilike('FB DESCRIPTION', `%${safeValue}%`).limit(10));
        }

        const results = await Promise.all(promises);
        // ... (Phần xử lý kết quả giữ nguyên)

        // Abort rendering if user typed more or selected an item while the network request was in-flight
        const rproInputEl = document.getElementById('rpro-input');
        if (!rproInputEl || rproInputEl.value.trim() !== safeValue) return;

        const set = new Set();

        results.forEach(r => {
            if (r.data) {
                r.data.forEach(d => {
                    const pu = d['PU DESCRIPTION'] || d['pu'] || '';
                    const fb = d['FB DESCRIPTION'] || d['fabric'] || '';

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

        renderCustomDropdown('rpro-input', 'rpro-suggestions', Array.from(set));
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
        fabric: "Tìm theo tên Vải / Fabric...",
        molding_combo: "Tìm theo mã combo (Mold_PU_Fabric)..."
    };
    if (historySearch) historySearch.placeholder = placeholders[currentSearchType] || "Tìm kiếm...";
}

function updateActiveSection(section) {
    activeSection = section;
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        mainTitle.textContent = "Quản Lý Hàng Dư - " + (section ? section.toUpperCase() : "");
    }

    const isMolding = section && section.toUpperCase() === 'MOLDING';

    // Toggle Search Containers
    const defaultSearch = document.getElementById('default-search-container');
    const moldingSearch = document.getElementById('molding-search-container');
    if (defaultSearch && moldingSearch) {
        if (isMolding) {
            defaultSearch.classList.add('hidden');
            moldingSearch.classList.remove('hidden'); moldingSearch.classList.add('flex');
        } else {
            defaultSearch.classList.remove('hidden');
            moldingSearch.classList.add('hidden'); moldingSearch.classList.remove('flex');
        }
    }

    // Toggle History Search Containers
    if (moldingHistorySearchContainer && defaultHistorySearchContainer) {
        if (isMolding) {
            defaultHistorySearchContainer.classList.add('hidden');
            moldingHistorySearchContainer.classList.remove('hidden'); moldingHistorySearchContainer.classList.add('flex');
        } else {
            defaultHistorySearchContainer.classList.remove('hidden');
            moldingHistorySearchContainer.classList.add('hidden'); moldingHistorySearchContainer.classList.remove('flex');
        }
    }

    // Toggle Labels
    const puLabel = document.getElementById('label-info-pu');
    const fbLabel = document.getElementById('label-info-fb');
    if (puLabel) puLabel.textContent = isMolding ? 'PU Code' : 'PU Description';
    if (fbLabel) fbLabel.textContent = isMolding ? 'FB Code' : 'Fabric Description';

    // Toggle History Filters
    const dFilters = document.getElementById('default-history-filters');
    const mFilters = document.getElementById('molding-history-filters');
    if (dFilters && mFilters) {
        if (isMolding) {
            dFilters.classList.add('hidden'); dFilters.classList.remove('flex');
            mFilters.classList.remove('hidden'); mFilters.classList.add('flex');
            // reset search type
            currentSearchType = 'rpro';
            document.querySelectorAll('#molding-history-filters .search-type-btn').forEach(b => {
                if (b.dataset.type === 'rpro') b.classList.add('active-search-type');
                else b.classList.remove('active-search-type');
            });
        } else {
            dFilters.classList.remove('hidden'); dFilters.classList.add('flex');
            mFilters.classList.add('hidden'); mFilters.classList.remove('flex');
        }
    }

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
        // Tầng 0: Kiểm tra surplusgoods (Chỉ tìm RPRO, không ép lấy đơn cũ khi đang dò PU/Vải)
        let existingSurplus = null;
        if (currentRproType === 'rpro') {
            // OPTIMIZED: Select only needed columns for surplus lookup
            const sizeFields = STANDARD_SIZES.map(s => `"size_${s.toString().replace('.', '_')}"`);
            const surplusSelectCols = ['id', 'rpro', 'brand_code', 'mold', 'bom', 'pu', 'fabric', 'note', 'dynamic_sizes', ...sizeFields].join(',');

            let query = supabase.from('surplusgoods')
                .select(surplusSelectCols)
                .or(`rpro.eq."${rpro}",pu.eq."${rpro}",fabric.eq."${rpro}"`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (activeSection) {
                query = query.eq('section', activeSection);
            }

            const { data } = await query;
            existingSurplus = data && data.length > 0 ? data[0] : null;
        }

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

        // Tầng 1: Tìm kiếm trong cả powerapp và Masterdata
        // TỐI ƯU HÓA: Chỉ select các cột cần thiết để tránh lỗi 500 (Timeout/Statement Cancellation) do bảng Masterdata quá rộng và lớn.
        const essentialFields = ['STT', 'PRO ODER', 'SO', 'Brand Code', '#MOLD', 'BOM', 'PU DESCRIPTION', 'FB DESCRIPTION', 'PU', 'FB'];
        const sizeFields = STANDARD_SIZES.map(s => s.toString());
        const selectCols = [...essentialFields, ...sizeFields].map(f => `"${f}"`).join(',');

        let paOrder = null;
        let mdOrder = null;

        if (currentRproType === 'pu') {
            paOrder = await supabase.from('powerapp').select(selectCols).ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            mdOrder = await supabase.from('Masterdata').select(selectCols).ilike('PU DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
        } else if (currentRproType === 'fabric') {
            paOrder = await supabase.from('powerapp').select(selectCols).ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
            mdOrder = await supabase.from('Masterdata').select(selectCols).ilike('FB DESCRIPTION', `%${rpro}%`).limit(1).maybeSingle().then(r => r.data);
        } else {
            // TÌM KIẾM THEO RPRO: Dùng .eq để tận dụng Index, cực nhanh và không bị lỗi 500
            const searchRpro = rpro.trim(); // Đảm bảo lọc sạch khoảng trắng trước khi search

            // 1. Tìm trong powerapp trước
            let paRes = await supabase.from('powerapp').select(selectCols).eq('PRO ODER', searchRpro).limit(1);
            paOrder = (paRes.data && paRes.data.length > 0) ? paRes.data[0] : null;

            // 2. Tìm trong Masterdata bằng .eq (Tuyệt đối không dùng ilike % mặc định ở đây nếu không có index)
            // Dùng .limit(1) thay vì .maybeSingle() để tránh lỗi PostgREST (PGRST116) nếu trùng mã RPRO
            if (!paOrder) {
                let mdRes = await supabase.from('Masterdata').select(selectCols).eq('PRO ODER', searchRpro).limit(1);
                mdOrder = (mdRes.data && mdRes.data.length > 0) ? mdRes.data[0] : null;

                // Nếu không thấy mã chính xác, mới thử tìm mờ đề phòng DB bị dư khoảng trắng
                if (!mdOrder) {
                    console.log("No exact match in MD, trying safe ilike...");
                    let mdResIlike = await supabase.from('Masterdata').select(selectCols).ilike('PRO ODER', `${searchRpro}%`).limit(1);
                    mdOrder = (mdResIlike.data && mdResIlike.data.length > 0) ? mdResIlike.data[0] : null;
                }
            }

            // CHỈ FALLBACK tìm theo nội dung mô tả nếu input KHÔNG phải là mã RPRO chuẩn và không tìm thấy kết quả
            const isLikelyRpro = searchRpro.startsWith('RPRO-') || /^\d+$/.test(searchRpro.replace(/-/g, ''));

            if (!paOrder && !mdOrder && !isLikelyRpro) {
                console.log("Fallback search by descriptions on powerapp...");
                paOrder = await supabase.from('powerapp').select(selectCols).ilike('PU DESCRIPTION', `%${searchRpro}%`).limit(1).then(r => (r.data && r.data.length > 0) ? r.data[0] : null);

                if (!paOrder) paOrder = await supabase.from('powerapp').select(selectCols).ilike('FB DESCRIPTION', `%${searchRpro}%`).limit(1).then(r => (r.data && r.data.length > 0) ? r.data[0] : null);

                // Hạn chế tối đa search Masterdata bằng ilike string dài trên description
                if (!paOrder && rpro.length > 5) {
                    console.log("Final fallback search on Masterdata...");
                    mdOrder = await supabase.from('Masterdata').select(selectCols).ilike('PU DESCRIPTION', `%${searchRpro}%`).limit(1).then(r => (r.data && r.data.length > 0) ? r.data[0] : null);
                }
            }
        }

        // Ưu tiên Masterdata nếu có (vì data thường đầy đủ hơn), nhưng merge thông tin từ powerapp nếu Masterdata bị thiếu
        let order = mdOrder || paOrder;

        if (mdOrder && paOrder) {
            // Merge các field quan trọng nếu mdOrder bị null hoặc trống
            const fieldsToMerge = ['PU DESCRIPTION', 'FB DESCRIPTION', 'Brand Code', '#MOLD', 'BOM'];
            fieldsToMerge.forEach(field => {
                if (!order[field] || order[field] === '-' || order[field] === '') {
                    order[field] = paOrder[field];
                }
            });
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

        if (currentRproType === 'pu' || currentRproType === 'fabric') {
            // For pu/fabric search, we wipe out the PRO ODER so it gets saved as a MANUAL record
            delete order['PRO ODER'];
            delete order['PRO_ODER'];
        }

        activeOrderData = order;
        displayOrderInfo(order);
        detectExtraSizes(order);
        enableInput();

        // Immediately trigger check right after auto-populating PU/Fabric from system database
        showToast("✅ Tìm thấy dữ liệu. Mời nhập số lượng dôi!", "success");
        if ((currentRproType === 'pu' || currentRproType === 'fabric') && infoPu.value.trim() && infoFabric.value.trim()) {
            await checkExistingManualEntry();
        }

    } catch (err) {
        console.error(err);
        showToast("❌ Lỗi hệ thống khi tìm dữ liệu", "error");
    }
}

async function handleScanMolding() {
    if (!currentMSNV) {
        alert("Vui lòng nhập Mã số nhân viên!");
        const modal = document.getElementById('msnv-modal');
        if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
        return;
    }
    const mold = document.getElementById('molding-mold-input').value.trim().toUpperCase();
    const pu = document.getElementById('molding-pu-input').value.trim().toUpperCase();
    const fb = document.getElementById('molding-fb-input').value.trim().toUpperCase();

    if (!mold || !pu || !fb) {
        showToast("⚠️ Vui lòng nhập đầy đủ Mã Khuôn, Mã PU, và Mã Vải!", "error");
        return;
    }

    const rproCombo = `${mold}_${pu}_${fb}`;
    rproInput.value = rproCombo; // set proxy value

    showToast("🔍 Đang tìm khớp nối MOLDING...", "info");

    try {
        const sizeFields = STANDARD_SIZES.map(s => `"size_${s.toString().replace('.', '_')}"`);
        const surplusSelectCols = ['id', 'rpro', 'brand_code', 'mold', 'bom', 'pu', 'fabric', 'note', 'dynamic_sizes', 'msnv', 'section', ...sizeFields].join(',');

        let query = supabase.from('surplusgoods')
            .select(surplusSelectCols)
            .eq('rpro', rproCombo)
            .eq('section', 'MOLDING')
            .order('created_at', { ascending: false })
            .limit(1);

        const { data } = await query;
        let existingSurplus = data && data.length > 0 ? data[0] : null;

        if (existingSurplus) {
            editingId = existingSurplus.id;
            activeOrderData = existingSurplus;
            clearFormFields();

            const mappedData = {
                'PRO ODER': existingSurplus.rpro,
                'Brand Code': existingSurplus.brand_code,
                '#MOLD': existingSurplus.mold,
                'BOM': existingSurplus.bom,
                'PU': existingSurplus.pu,
                'FB': existingSurplus.fabric,
                'note': existingSurplus.note,
                ...existingSurplus
            };

            displayOrderInfo(mappedData);
            loadSurplusDataToUI(existingSurplus);
            enableInput();
            updateSizeHighlights();
            if (btnDeleteSurplus) btnDeleteSurplus.classList.remove('hidden');
            showToast("📝 Đã tìm thấy đơn hàng MOLDING. Bạn có thể cập nhật!", "orange");
            return;
        }

        // Nếu chưa có trong surplusgoods, query powerapp để lấy Brand và BOM
        const essentialFields = ['Brand Code', 'BOM'];
        const selectCols = essentialFields.map(f => `"${f}"`).join(',');

        let paRes = await supabase.from('powerapp')
            .select(selectCols)
            .ilike('"#MOLD"', `%${mold}%`)
            .ilike('"PU"', `%${pu}%`)
            .ilike('"FB"', `%${fb}%`)
            .limit(1);

        if (paRes.error) {
            console.error("Powerapp query error:", paRes.error);
            // Don't throw if it's just a missing record, but throw if it's a 400/500 code error
            if (paRes.status >= 400) throw paRes.error;
        }

        let paOrder = (paRes.data && paRes.data.length > 0) ? paRes.data[0] : { 'Brand Code': '-', 'BOM': '-' };

        activeOrderData = {
            'PRO ODER': rproCombo,
            'Brand Code': paOrder['Brand Code'],
            'BOM': paOrder['BOM'],
            '#MOLD': mold,
            'PU': pu,
            'FB': fb
        };

        editingId = null;
        clearFormFields();
        displayOrderInfo(activeOrderData);
        enableInput();
        if (btnDeleteSurplus) btnDeleteSurplus.classList.add('hidden');
        showToast("✅ Sẵn sàng nhập liệu lưu trữ mới!", "success");

    } catch (error) {
        console.error("Scan Error Details:", error);
        if (error.code) console.error("Error Code:", error.code);
        if (error.message) console.error("Error Message:", error.message);
        showToast(`❌ Lỗi hệ thống: ${error.message || 'Không thể lấy dữ liệu'}`, "error");
    }
}

function displayOrderInfo(order) {
    const isExistingSurplus = order && order.id;

    if (!isExistingSurplus && currentRproType === 'pu') {
        infoBrand.textContent = '-';
        infoMold.textContent = '-';
        infoBom.textContent = '-';
        const puFull = order['PU DESCRIPTION'] || order['Mã dao'] || order['pu'] || '';
        infoPu.value = puFull;
        infoFabric.value = '';
        infoPu.title = puFull;
        infoFabric.title = '';
    } else if (!isExistingSurplus && currentRproType === 'fabric') {
        infoBrand.textContent = '-';
        infoMold.textContent = '-';
        infoBom.textContent = '-';
        infoPu.value = '';
        const fbFull = order['FB DESCRIPTION'] || order['Tên vải'] || order['fabric'] || '';
        infoFabric.value = fbFull;
        infoPu.title = '';
        infoFabric.title = fbFull;
    } else {
        infoBrand.textContent = order['Brand Code'] || order['brand_code'] || '-';
        infoMold.textContent = order['#MOLD'] || order['Mã Khuôn'] || order['mold'] || '-';
        infoBom.textContent = order['BOM'] || order['bom'] || '-';

        const puFull = order['PU DESCRIPTION'] || order['Mã dao'] || order['pu'] || '';
        const fbFull = order['FB DESCRIPTION'] || order['Tên vải'] || order['fabric'] || '';

        infoPu.value = puFull;
        infoFabric.value = fbFull;
        infoPu.title = puFull;
        infoFabric.title = fbFull;
    }

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

    let puReadOnly = true;
    let fabricReadOnly = true;

    const isEditingSurplus = activeOrderData && activeOrderData.id;
    const hasRproFromMaster = activeOrderData && (activeOrderData['PRO ODER'] || activeOrderData['PRO_ODER'] || activeOrderData['rpro']);

    if (!isEditingSurplus) {
        if (currentRproType === 'pu') {
            puReadOnly = true;
            fabricReadOnly = false;
        } else if (currentRproType === 'fabric') {
            puReadOnly = false;
            fabricReadOnly = true;
        } else if (!hasRproFromMaster) {
            puReadOnly = false;
            fabricReadOnly = false;
        }
    }

    infoPu.readOnly = puReadOnly;
    infoFabric.readOnly = fabricReadOnly;

    if (!puReadOnly) {
        infoPu.classList.add('bg-white', 'ring-2', 'ring-teal-100', 'p-1', 'rounded-lg');
        infoPu.classList.remove('cursor-pointer');
    } else {
        infoPu.classList.remove('bg-white', 'ring-2', 'ring-teal-100', 'p-1', 'rounded-lg');
        infoPu.classList.add('cursor-pointer');
    }

    if (!fabricReadOnly) {
        infoFabric.classList.add('bg-white', 'ring-2', 'ring-indigo-100', 'p-1', 'rounded-lg');
        infoFabric.classList.remove('cursor-pointer');
    } else {
        infoFabric.classList.remove('bg-white', 'ring-2', 'ring-indigo-100', 'p-1', 'rounded-lg');
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

function generateStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 5).toUpperCase().padStart(5, '0');
}

async function saveSurplus() {
    if (!activeOrderData) return;

    btnSaveSurplus.disabled = true;
    btnSaveSurplus.textContent = "⏳ Đang lưu...";

    let rpro = activeOrderData['rpro'] || activeOrderData['PRO ODER'] || activeOrderData['PRO_ODER'] || '';
    if (currentRproType === 'rpro' && rproInput.value.trim().toUpperCase().startsWith('RPRO-')) {
        rpro = rproInput.value.trim().toUpperCase();
    }

    const pu = infoPu.value.trim();
    const fabric = infoFabric.value.trim();

    if (!rpro || rpro.startsWith('MANUAL-') || isSplittingOrder) {
        // Fallback RPRO identifier for manual entries or splitting
        if (!pu || !fabric) {
            showToast("⚠️ Vui lòng nhập thông tin RPRO hoặc cả PU và Fabric!", "error");
            btnSaveSurplus.disabled = false;
            btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
            return;
        }
        const suffix = isSplittingOrder
            ? Math.random().toString(36).substring(2, 7).toUpperCase() // Completely random unique hash if split
            : generateStringHash(pu.toUpperCase() + "|" + fabric.toUpperCase()); // Deterministic hash otherwise
        const puPrefix = (pu.split(' ')[0] || pu).substring(0, 15);
        const fbPrefix = (fabric.split(' ')[0] || fabric).substring(0, 15);
        rpro = `MANUAL-${puPrefix}-${fbPrefix}-${suffix}`.replace(/[^a-zA-Z0-9\-]/g, '-').toUpperCase();
    }

    if (!activeSection) {
        showToast("⚠️ Vui lòng chọn Section!", "error");
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
        return;
    }

    // MOLDING requires MSNV
    let submitMsnv = null;
    if (activeSection === 'MOLDING') {
        if (!currentMSNV) {
            alert("Vui lòng nhập Mã số nhân viên!");
            const modal = document.getElementById('msnv-modal');
            if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
            btnSaveSurplus.disabled = false;
            btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
            return;
        }
        submitMsnv = currentMSNV;
    }

    const payload = {
        rpro: rpro,
        so: activeOrderData['SO'] || activeOrderData['so'] || activeOrderData['Sales Order'] || '',
        brand_code: infoBrand.textContent === '-' ? '' : infoBrand.textContent,
        mold: infoMold.textContent === '-' ? '' : infoMold.textContent,
        bom: infoBom.textContent === '-' ? '' : infoBom.textContent,
        pu: pu,
        fabric: fabric,
        pu_code: activeOrderData['PU'] || activeOrderData['pu_code'] || '',
        fb_code: activeOrderData['FB'] || activeOrderData['fb_code'] || '',
        section: activeSection,
        note: entryNote.value.trim(),
        dynamic_sizes: {}
    };

    if (submitMsnv) {
        payload.msnv = submitMsnv;
    }

    let hasAnyQty = false;
    let totalGridSizingVal = 0;

    // Collect standard sizes
    STANDARD_SIZES.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const val = parseFloat(document.getElementById(id)?.value) || 0;
        payload[`size_${size.toString().replace('.', '_')}`] = val;
        totalGridSizingVal += val;
        if (val > 0) hasAnyQty = true;
    });

    // Collect extra sizes
    extraSizes.forEach(size => {
        const id = `size_${size.toString().replace('.', '_')}`;
        const val = parseFloat(document.getElementById(id)?.value) || 0;
        payload.dynamic_sizes[size] = val;
        totalGridSizingVal += val;
        if (val > 0) hasAnyQty = true;
    });

    // Handle Total Qty Override feature
    const tOverrideObj = document.getElementById('total-qty-override');
    if (tOverrideObj) {
        const manualTotal = parseFloat(tOverrideObj.value) || 0;
        if (manualTotal > 0 && manualTotal !== totalGridSizingVal) {
            // User manually overrode the total and it doesnt match grid. Store it purely in dynamicSizes, zero out the rest
            hasAnyQty = true;
            payload.dynamic_sizes['Tổng SL (Không rõ size)'] = manualTotal;
            STANDARD_SIZES.forEach(size => {
                payload[`size_${size.toString().replace('.', '_')}`] = 0;
            });
            Object.keys(payload.dynamic_sizes).forEach(k => {
                if (k !== 'Tổng SL (Không rõ size)') delete payload.dynamic_sizes[k];
            });
        }
    }

    if (!hasAnyQty) {
        showToast("⚠️ Vui lòng nhập số lượng cho ít nhất một size hoặc nhập Tổng số lượng!", "error");
        btnSaveSurplus.disabled = false;
        btnSaveSurplus.textContent = "💾 LƯU DỮ LIỆU";
        return;
    }

    try {
        let result;

        // Final guard: Determine if user is unintentionally overwriting an existing record in the SAME section.
        if (!editingId && !isSplittingOrder) {
            const { data } = await supabase.from('surplusgoods')
                .select('id, rpro')
                .eq('rpro', payload.rpro)
                .eq('section', activeSection)
                .order('created_at', { ascending: false })
                .limit(1);

            const duplicateCheck = data && data.length > 0 ? data[0] : null;

            if (duplicateCheck) {
                editingId = duplicateCheck.id; // Automatically bind to avoid repeat checks if they click save again
                alert("⛔ CHẶN LƯU GHI ĐÈ:\nBạn đang cố lưu một đơn hàng TRÙNG LẶP vật tư ở chung một bộ phận!\n\nNút lưu đã bị chặn tạm thời. Nếu bạn chắc chắn muốn ghi đè lượng cũ, hãy bấm Lưu lần nữa.\nNếu muốn lưu thành đơn mới, hãy bấm '✂️ Tách Đơn'.");
                if (btnSplitSurplus) btnSplitSurplus.classList.remove('hidden');
                btnSaveSurplus.disabled = false;
                btnSaveSurplus.textContent = "💾 XÁC NHẬN GHI ĐÈ";
                return; // Abort this first click
            }
        }

        if (editingId) {
            // UPDATE existing
            result = await supabase.from('surplusgoods').update(payload).eq('id', editingId);
        } else {
            // Check if this exact rpro already exists in surplusgoods IN THE SAME SECTION to prevent duplicates
            const { data } = await supabase.from('surplusgoods')
                .select('id')
                .eq('rpro', payload.rpro)
                .eq('section', activeSection)
                .order('created_at', { ascending: false })
                .limit(1);

            const existData = data && data.length > 0 ? data[0] : null;

            if (existData) {
                // UPDATE existing fallback
                result = await supabase.from('surplusgoods').update(payload).eq('id', existData.id);
            } else {
                // INSERT new
                result = await supabase.from('surplusgoods').insert([payload]);
            }
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
    const dynKeys = Object.keys(dyn)
        .filter(k => !isNaN(parseFloat(k)))
        .map(k => parseFloat(k));

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
    const params = new URLSearchParams(window.location.search);
    if (!params.get('section') && data.section) {
        updateActiveSection(data.section);
    }

    updateSizeHighlights();
}

function resetEntry() {
    activeOrderData = null;
    editingId = null;
    isSplittingOrder = false;
    if (btnDeleteSurplus) btnDeleteSurplus.classList.add('hidden');
    if (btnSplitSurplus) btnSplitSurplus.classList.add('hidden');
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

    // Reset section buttons ONLY if not locked by URL
    const params = new URLSearchParams(window.location.search);
    if (!params.get('section')) {
        activeSection = null;
        sectionBtns.forEach(b => {
            b.classList.remove('bg-teal-600', 'text-white', 'border-teal-700', 'shadow-md');
            b.classList.add('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
        });
    }


    // Clear totally override if exists
    const tOverride = document.getElementById('total-qty-override');
    if (tOverride) tOverride.value = '';

    // Reset info text
    [infoBrand, infoMold, infoBom].forEach(el => el.textContent = '-');
    [infoPu, infoFabric].forEach(el => el.value = '');

    // Reset Molding Search Inputs
    const mMoldInput = document.getElementById('molding-mold-input');
    const mPuInput = document.getElementById('molding-pu-input');
    const mFbInput = document.getElementById('molding-fb-input');
    if (mMoldInput) mMoldInput.value = '';
    if (mPuInput) mPuInput.value = '';
    if (mFbInput) mFbInput.value = '';

    updateSizeHighlights();
}

function updateSizeHighlights() {
    let total = 0;
    document.querySelectorAll('.size-input').forEach(input => {
        const val = parseFloat(input.value) || 0;
        const isExtra = input.closest('#extra-size-grid');
        total += val;

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

    const totalQtyOverride = document.getElementById('total-qty-override');
    // If it's a focus update, maybe we just set the placeholder, but if total > 0, we can also set value if we want to sync
    if (totalQtyOverride && total > 0) {
        // Only auto update if it doesn't have focus to avoid interrupting user typing
        if (document.activeElement !== totalQtyOverride) {
            totalQtyOverride.value = total;
        }
    } else if (totalQtyOverride && total === 0) {
        if (document.activeElement !== totalQtyOverride) {
            totalQtyOverride.value = '';
        }
    }
}

// ==================== HISTORY & SEARCH ====================

async function loadHistory() {
    const q = historySearch ? historySearch.value.trim().toUpperCase() : "";
    const chkAll = document.getElementById('search-all-sections');
    const isSearchAll = chkAll ? chkAll.checked : false;
    const isMolding = activeSection === 'MOLDING';

    // Detect multi-RPRO
    const rproMatches = q.match(/RPRO-[\d-]+/g);
    const cleanMatches = rproMatches ? rproMatches.map(m => m.replace(/[^A-Z0-9]/g, "").toUpperCase()) : [];

    // OPTIMIZED: Select only needed columns for history list
    const historyColumns = 'id,rpro,section,created_at,bom,mold,pu,fabric,dynamic_sizes,size_3,size_3_5,size_4,size_4_5,size_5,size_5_5,size_6,size_6_5,size_7,size_7_5,size_8,size_8_5,size_9,size_9_5,size_10,size_10_5,size_11,size_11_5,size_12,size_12_5,size_13,size_13_5,size_14,size_14_5,size_15';
    let query = supabase.from('surplusgoods').select(historyColumns).order('created_at', { ascending: false });

    if (activeSection && !isSearchAll) {
        query = query.eq('section', activeSection);
    }

    if (isMolding && !isSearchAll) {
        // PREFER specialized Molding history inputs
        const mrpro = moldingHistoryRpro ? moldingHistoryRpro.value.trim().toUpperCase() : "";
        const mmold = moldingHistoryMold ? moldingHistoryMold.value.trim().toUpperCase() : "";
        const mpu = moldingHistoryPu ? moldingHistoryPu.value.trim().toUpperCase() : "";
        const mfb = moldingHistoryFb ? moldingHistoryFb.value.trim().toUpperCase() : "";

        if (mrpro) {
            query = query.ilike('rpro', `%${mrpro}%`);
        } else if (mmold || mpu || mfb) {
            if (mmold) query = query.ilike('mold', `%${mmold}%`);
            if (mpu) query = query.ilike('pu', `%${mpu}%`);
            if (mfb) query = query.ilike('fabric', `%${mfb}%`);
        }
        query = query.limit(20);
    } else if (cleanMatches.length > 0 && currentSearchType === 'rpro') {
        // Fetch more rows to ensure we find all requested RPROs if they exist
        query = query.limit(200);
    } else if (q) {
        // Targeted search based on selected type
        let rqlColumn = "rpro";
        if (currentSearchType === "bom") rqlColumn = "bom";
        if (currentSearchType === "pu") rqlColumn = "pu";
        if (currentSearchType === "fabric") rqlColumn = "fabric";

        query = query.ilike(rqlColumn, `%${q}%`).limit(20);
    } else {
        query = query.limit(20);
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return;
    }

    let filtered = data;

    if (cleanMatches.length > 0 && currentSearchType === 'rpro') {
        filtered = data.filter(item => {
            const cleanRpro = (item.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            return cleanMatches.some(m => cleanRpro.includes(m));
        });

        // Custom Sort by search order
        filtered.sort((a, b) => {
            const rproA = (a.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            const rproB = (b.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            let idxA = cleanMatches.findIndex(m => rproA.includes(m));
            let idxB = cleanMatches.findIndex(m => rproB.includes(m));
            return (idxA === -1 ? 99999 : idxA) - (idxB === -1 ? 99999 : idxB);
        });

        // Alert missing
        const foundRpros = filtered.map(item => (item.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase());
        const missing = rproMatches.filter(m => {
            const cleanM = m.replace(/[^A-Z0-9]/g, "").toUpperCase();
            return !foundRpros.some(f => f.includes(cleanM));
        });
        if (missing.length > 0) {
            alert("⚠️ Không tìm thấy các đơn trong Lịch sử nhập: " + missing.join(", "));
        }
    }

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
                    <div class="flex gap-2 items-center">
                        <span class="text-xs font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">${item.rpro}</span>
                        <span class="text-[9px] font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded uppercase">${item.section || '?'}</span>
                    </div>
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
                'MSNV Tác Động': item.msnv || '',
                'Mã RPRO': item.rpro,
                'Sales Order': item.so || '',
                'Brand': item.brand_code || '',
                'Mold': item.mold || '',
                'BOM': item.bom || '',
                'PU': item.pu || '',
                'Fabric': item.fabric || '',
                'Code PU': item.pu_code || '',
                'Code FB': item.fb_code || '',
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

// ==================== TUTORIAL ====================

function startTutorial() {
    if (typeof window.driver === 'undefined') {
        console.error("Driver.js not loaded");
        return;
    }

    const driver = window.driver.js.driver;
    const driverObj = driver({
        showProgress: true,
        nextBtnText: 'Tiếp theo',
        prevBtnText: 'Quay lại',
        doneBtnText: 'Hoàn tất',
        steps: [
            {
                element: '#btn-tutorial',
                popover: {
                    title: '🌟 Chào mừng!',
                    description: 'Đây là hệ thống Quản Lý Hàng Dư. Tôi sẽ hướng dẫn bạn cách nhập liệu và truy xuất dữ liệu chỉ trong vài bước.',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#rpro-input',
                popover: {
                    title: '1. Tìm kiếm hoặc Quét mã',
                    description: 'Nhập mã RPRO hoặc sử dụng nút Máy ảnh để quét mã QR. Bạn cũng có thể chọn tìm theo Tên PU hoặc Vải nếu không có mã RPRO.',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#order-info-container',
                popover: {
                    title: '2. Thông tin đơn hàng',
                    description: 'Hệ thống sẽ tự động hiển thị Brand, Mold, BOM, PU và Fabric sau khi tìm thấy mã. Nếu không có dữ liệu, bạn có thể tự nhập thêm vào các ô này.',
                    side: "top", align: 'start'
                }
            },
            {
                element: '#section-selector',
                popover: {
                    title: '3. Chọn Section',
                    description: 'Rất quan trọng! Hãy chọn đúng khu vực phát sinh hàng dư (LPS, Molding hoặc Leanline) để dữ liệu không bị nhầm lẫn.',
                    side: "top", align: 'start'
                }
            },
            {
                element: '#size-grid',
                popover: {
                    title: '4. Nhập số lượng theo Size',
                    description: 'Nhập số lượng đôi dôi thực tế vào các ô size tương ứng. Ô có số lượng sẽ tự động đổi màu để bạn dễ nhận biết.',
                    side: "top", align: 'start'
                }
            },
            {
                element: '#btn-save-surplus',
                popover: {
                    title: '5. Lưu dữ liệu',
                    description: 'Sau khi hoàn tất, hãy nhấn nút LƯU DỮ LIỆU. \n💡 Lưu ý: Nếu đơn đã tồn tại, hệ thống sẽ hỏi bạn muốn Ghi đè hay Tách đơn.',
                    side: "top", align: 'end'
                }
            },
            {
                element: '#history-list',
                popover: {
                    title: '6. Lịch sử & Truy xuất',
                    description: 'Danh sách 20 đơn mới nhất được hiển thị tại đây. Bạn có thể sử dụng ô tìm kiếm phía trên để truy xuất dữ liệu cũ theo RPRO, BOM, PU hoặc Vải.',
                    side: "left", align: 'start'
                }
            },
            {
                element: '#btn-export-excel',
                popover: {
                    title: '7. Xuất báo cáo Excel',
                    description: 'Cuối cùng, bạn có thể chọn khoảng ngày và nhấn nút này để tải báo cáo chi tiết về máy.',
                    side: "top", align: 'end'
                }
            },
        ]
    });

    driverObj.drive();
}

// Start everything
document.addEventListener('DOMContentLoaded', init);
