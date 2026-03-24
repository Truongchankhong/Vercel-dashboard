import { supabase } from './supabaseClient.js';

// ==================== CONFIG & STATE (REMOVED: MOVED BELOW ELEMENTS) ====================

const ELEMENTS = {
    rproInput: document.getElementById('rpro-input'),
    qtyInput: document.getElementById('qty-input'),
    btnSave: document.getElementById('btn-save'),
    btnSaveText: document.getElementById('btn-save-text'),
    btnScanIn: document.getElementById('btn-scan-in'),
    btnScanOut: document.getElementById('btn-scan-out'),
    autoSave: document.getElementById('auto-save'),
    rproDetails: document.getElementById('rpro-details'),
    details: {
        brand: document.getElementById('detail-brand'),
        pu: document.getElementById('detail-pu'),
        fb: document.getElementById('detail-fb')
    },
    scanHistory: document.getElementById('scan-history'),
    sessionCount: document.getElementById('session-count'),
    inputLoader: document.getElementById('input-loader'),
    audio: {
        success: document.getElementById('audio-success'),
        error: document.getElementById('audio-error')
    },
    scannerOverlay: document.getElementById('scanner-input-overlay'),
    // Dashboard elements
    statWip: document.getElementById('stat-wip'),
    statTotalIn: document.getElementById('stat-total-in'),
    statTotalOut: document.getElementById('stat-total-out'),
    statCompletion: document.getElementById('stat-completion'),
    statCompletionBar: document.getElementById('stat-completion-bar'),
    tableBody: document.getElementById('dashboard-table-body'),
    tableSearch: document.getElementById('table-search'),
    brandFilter: document.getElementById('brand-filter'),
    dateRange: document.getElementById('date-range'),
    btnExport: document.getElementById('btn-export'),
    btnRefreshDashboard: document.getElementById('btn-refresh-dashboard'),
    btnToggleCamera: document.getElementById('btn-toggle-camera'),
    cameraSection: document.getElementById('camera-section')
};

// ==================== CONFIG & STATE ====================
let scanMode = 'OUT'; // Default to OUT for Hotmelt
let currentStage = 'hotmelt'; // 'hotmelt', 'prefitting', 'molding', 'leanline'
let currentRproData = null;
let isProcessing = false;
let dashboardData = [];
let brandChart = null;
let productionChart = null;
let html5QrScanner = null;
let cameraActive = false;
let currentLanguage = 'vi';
let currentPage = 1;
const pageSize = 15;
let filteredData = [];

// Column Mapping for PowerApp Table
const COLUMN_MAP = {
    hotmelt: { 
        in: null, // User said ONLY Scan out for Hotmelt
        out: "Laminating (Pro)"
    },
    prefitting: {
        in: null, // User said ONLY Scan out for Prefitting
        out: "Prefitting (Pro)"
    },
    molding: {
        in: "Molding Pro (IN)",
        out: "Molding Pro"
    },
    leanline: {
        in: "IN lean Line (Pro)",
        out: "Out lean Line (Pro)"
    }
};

const UI_CONFIG = {
    hotmelt: { hasIn: false, hasOut: true },
    prefitting: { hasIn: false, hasOut: true },
    molding: { hasIn: true, hasOut: true },
    leanline: { hasIn: true, hasOut: true }
};

const TRANSLATIONS = {
    vi: {
        back: "QUAY LẠI",
        tab_scan: "QUÉT MÃ (SCAN)",
        tab_dashboard: "BÁO CÁO (DASHBOARD)",
        stat_wip: "Đang chạy (WIP)",
        stat_in: "Nhập (BẮT ĐẦU)",
        stat_out: "Xuất (HOÀN THÀNH)",
        stat_rate: "Tỷ lệ hoàn thành",
        order_unit: "ĐƠN HÀNG",
        unit: "ĐÔI",
        filter_time: "Thời gian",
        filter_brand: "Brand (Khách hàng)",
        all_brands: "Tất cả Brand",
        filter_mold: "#Mold (Lọc khuôn)",
        filter_finish_date: "Finish Date (Ngày ra hàng)",
        table_title: "DANH SÁCH CHI TIẾT ĐƠN HÀNG HOTMELT",
        search_placeholder: "Tìm kiến RPRO/Brand...",
        col_rpro: "THÔNG TIN RPRO",
        col_total: "TỔNG PO",
        col_finish: "FINISH DATE",
        click_filter_mold: "Bấm để lọc khuôn",
        click_filter_date: "Bấm để chọn ngày",
        chart_brand: "PHÂN TÍCH NHÓM THEO BRAND (TOP 5) %",
        chart_prod: "SẢN LƯỢNG HOÀN THÀNH THEO NGÀY (SỐ ĐÔI)",
        chart_prod_label: "Sản lượng (Đôi)",
        showing: "Hiển thị",
        of: "của"
    },
    en: {
        back: "BACK",
        tab_scan: "SCAN AREA",
        tab_dashboard: "DASHBOARD",
        stat_wip: "Work In Progress",
        stat_in: "Total Entry",
        stat_out: "Total Finished",
        stat_rate: "Completion Rate",
        order_unit: "ORDERS",
        unit: "PAIRS",
        filter_time: "Time Range",
        filter_brand: "Brand Filter",
        all_brands: "All Brands",
        filter_mold: "Mold Filter",
        filter_finish_date: "Finish Date",
        table_title: "DETAILED PRODUCTION LOG",
        search_placeholder: "Search RPRO/Brand...",
        col_rpro: "RPRO INFO",
        col_total: "TOTAL PO",
        col_finish: "FINISH DATE",
        click_filter_mold: "Click to filter mold",
        click_filter_date: "Click to pick date",
        chart_brand: "BRAND ANALYSIS (TOP 5) %",
        chart_prod: "DAILY PRODUCTION OUTPUT (PAIRS)",
        chart_prod_label: "Output (Pairs)",
        showing: "Showing",
        of: "of"
    }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    ELEMENTS.rproInput.focus();
    setupEventListeners();
    updateSessionCount();
    
    // Initialize Date Range Picker (Default 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    flatpickr("#date-range-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: [sevenDaysAgo, new Date()],
        onChange: () => refreshDashboard()
    });

    // Auto-refresh history from DB
    fetchRecentHistory();
    setLanguage('vi'); // Default language
});

function setupEventListeners() {
    // Scan Mode Toggle
    window.setScanMode = (mode) => {
        scanMode = mode;
        const isIN = mode === 'IN';
        ELEMENTS.btnScanIn.className = `flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${isIN ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`;
        ELEMENTS.btnScanOut.className = `flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${!isIN ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`;
        ELEMENTS.btnSaveText.textContent = isIN ? 'LƯU DỮ LIỆU (NHẬP)' : 'LƯU DỮ LIỆU (XUẤT)';
        ELEMENTS.rproInput.focus();
    };

    window.setStage = (stage) => {
        currentStage = stage;
        document.querySelectorAll('.stage-btn').forEach(btn => {
            const isTarget = btn.id === `stage-${stage}`;
            btn.className = `stage-btn flex-1 px-4 py-3 rounded-2xl text-[11px] font-black transition active:scale-95 whitespace-nowrap ${isTarget ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`;
        });

        // Toggle IN/OUT visibility based on Stage Config
        const config = UI_CONFIG[stage];
        if (config.hasIn) {
            ELEMENTS.btnScanIn.classList.remove('hidden');
        } else {
            ELEMENTS.btnScanIn.classList.add('hidden');
            setScanMode('OUT');
        }
        
        ELEMENTS.rproInput.focus();
    };

    // Manual Input Handler
    let typingTimer;
    ELEMENTS.rproInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        clearTimeout(typingTimer);
        
        if (val.startsWith('RPRO-') && val.length >= 12) {
            typingTimer = setTimeout(() => handleRproDetected(val), 300);
        }
    });

    // Qty adjustments
    window.adjustQty = (delta) => {
        let val = parseInt(ELEMENTS.qtyInput.value) || 0;
        val = Math.max(1, val + delta);
        ELEMENTS.qtyInput.value = val;
    };

    // Save Button - MODIFIED: Now acts as a Refresh/Check button
    ELEMENTS.btnSave.addEventListener('click', () => {
        const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
        if (rpro) handleRproDetected(rpro);
    });

    // Enter key support - Trigger check
    ELEMENTS.rproInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
            if (rpro) handleRproDetected(rpro);
        }
    });

    // Dashboard Events
    window.addEventListener('dashboard-active', () => {
        refreshDashboard();
    });

    ELEMENTS.tableSearch.addEventListener('input', () => { currentPage = 1; renderTable(); });
    ELEMENTS.brandFilter.addEventListener('change', () => { currentPage = 1; renderTable(); });
    
    // Header Filters Integration
    const moldHeader = document.getElementById('mold-filter-header');
    const moldSidebar = document.getElementById('mold-filter');
    const dateHeader = document.getElementById('finish-date-filter-header');
    const dateSidebar = document.getElementById('finish-date-filter');
    const dateBadge = document.getElementById('finish-date-badge-header');

    moldHeader.addEventListener('input', (e) => {
        moldSidebar.value = e.target.value;
        currentPage = 1;
        renderTable();
    });

    dateHeader.addEventListener('change', (e) => {
        dateSidebar.value = e.target.value;
        if (e.target.value) {
            const [y, m, d] = e.target.value.split('-');
            dateBadge.textContent = `${d}/${m}`;
            dateBadge.classList.remove('hidden');
        } else {
            dateBadge.classList.add('hidden');
        }
        currentPage = 1;
        renderTable();
    });

    moldSidebar.addEventListener('input', (e) => { 
        moldHeader.value = e.target.value; 
        currentPage = 1; 
        renderTable(); 
    });
    
    dateSidebar.addEventListener('change', (e) => {
        dateHeader.value = e.target.value;
        if (e.target.value) {
            const [y, m, d] = e.target.value.split('-');
            dateBadge.textContent = `${d}/${m}`;
            dateBadge.classList.remove('hidden');
        } else {
            dateBadge.classList.add('hidden');
        }
        currentPage = 1; 
        renderTable(); 
    });

    ELEMENTS.btnToggleCamera?.addEventListener('click', toggleCamera);

    window.setLanguage = (lang) => {
        currentLanguage = lang;
        document.getElementById('lang-vi').className = `px-3 py-1 rounded-lg text-[10px] font-black transition-all duration-300 ${lang === 'vi' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`;
        document.getElementById('lang-en').className = `px-3 py-1 rounded-lg text-[10px] font-black transition-all duration-300 ${lang === 'en' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`;
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (TRANSLATIONS[lang][key]) el.textContent = TRANSLATIONS[lang][key];
        });
        
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (TRANSLATIONS[lang][key]) el.placeholder = TRANSLATIONS[lang][key];
        });
    };

    // Handheld Scanner Support
    let scanBuffer = '';
    let scanTimeout;
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' && document.activeElement !== ELEMENTS.scannerOverlay) return;

        clearTimeout(scanTimeout);
        if (e.key === 'Enter') {
            if (scanBuffer.length > 5) {
                handleRproDetected(scanBuffer);
                scanBuffer = '';
            }
        } else if (e.key.length === 1) {
            scanBuffer += e.key;
            scanTimeout = setTimeout(() => scanBuffer = '', 200);
        }
    });
}

// ==================== SCAN LOGIC ====================

// Convert JS Date to Excel Serial (e.g. 46105.123)
function jsToExcelSerial(date) {
    if (!date) return null;
    return (date.getTime() / (86400 * 1000)) + 25569;
}

// Convert Excel Serial to ISO string (e.g. "2026-03-24T12:00:00Z")
function excelToISO(serial) {
    if (!serial || isNaN(serial)) return null;
    return new Date((serial - 25569) * 86400 * 1000).toISOString();
}

async function handleRproDetected(rawRpro) {
    const rpro = normalizeRPRO(rawRpro);
    if (!rpro || isProcessing) return;
    
    isProcessing = true;
    ELEMENTS.inputLoader.classList.remove('hidden');
    ELEMENTS.rproInput.value = rpro;

    try {
        const { data, error } = await supabase
            .from('powerapp')
            .select('*')
            .eq('"PRO ODER"', rpro)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // VERIFY MACHINE
            if (data['LAMINATION MACHINE (REALTIME)'] !== 'Hotmelt') {
                showToast(`⚠️ Đơn này thuộc máy ${data['LAMINATION MACHINE (REALTIME)'] || 'khác'}, không phải Hotmelt!`, 'info');
            }

            // Map columns for internal use
            data.Brand = data['Brand Code'];
            data.Mold = data['#MOLD'];
            data.PU = data['PU DESCRIPTION'];
            data.FB = data['FB DESCRIPTION'];
            
            currentRproData = data;
            showDetails(data);
            playAudio(true);
            
            // Repurpose History Row to show current status
            addStatusHistoryRow(data);

        } else {
            showToast(`⚠️ Không tìm thấy RPRO: ${rpro}`, 'error');
            playAudio(false);
            ELEMENTS.rproDetails.classList.add('hidden');
        }
    } catch (err) {
        console.error("Check error:", err);
        showToast("❌ Lỗi truy vấn dữ liệu", "error");
    } finally {
        isProcessing = false;
        ELEMENTS.inputLoader.classList.remove('hidden'); // Fix: keep it visible briefly or hide
        setTimeout(() => ELEMENTS.inputLoader.classList.add('hidden'), 500);
    }
}

// Show current progress in the history area (Read-only)
function addStatusHistoryRow(data) {
    const rpro = data['PRO ODER'];
    const row = document.createElement('div');
    row.className = `flex flex-col bg-white p-4 rounded-2xl border-l-4 border-indigo-500 shadow-sm animate__animated animate__slideInRight mb-3`;
    
    const checkTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    
    // Status indicators
    const hOUT = data[COLUMN_MAP.hotmelt.out];
    const pOUT = data[COLUMN_MAP.prefitting.out];
    const mIN = data[COLUMN_MAP.molding.in];
    const mOUT = data[COLUMN_MAP.molding.out];
    const lIN = data[COLUMN_MAP.leanline.in];
    const lOUT = data[COLUMN_MAP.leanline.out];

    row.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex flex-col">
                <span class="text-[9px] font-black text-slate-400 uppercase">Status Checked: ${checkTime}</span>
                <span class="text-sm font-black text-indigo-600">${rpro}</span>
            </div>
            <div class="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold">${data['Brand Code']}</div>
        </div>
        <div class="grid grid-cols-3 gap-2">
            <div class="p-1 bg-slate-50 rounded border ${hOUT ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100'}">
                <div class="text-[8px] font-black ${hOUT ? 'text-emerald-600' : 'text-slate-400'}">HM OUT</div>
                <div class="text-[9px] font-bold">${hOUT ? formatTime(excelToISO(hOUT)) : '---'}</div>
            </div>
            <div class="p-1 bg-slate-50 rounded border ${pOUT ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100'}">
                <div class="text-[8px] font-black ${pOUT ? 'text-emerald-600' : 'text-slate-400'}">PF OUT</div>
                <div class="text-[9px] font-bold">${pOUT ? formatTime(excelToISO(pOUT)) : '---'}</div>
            </div>
            <div class="p-1 bg-slate-50 rounded border ${mOUT ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100'}">
                <div class="text-[8px] font-black ${mOUT ? 'text-emerald-600' : 'text-slate-400'}">MD OUT</div>
                <div class="text-[9px] font-bold">${mOUT ? formatTime(excelToISO(mOUT)) : '---'}</div>
            </div>
        </div>
    `;
    
    if (ELEMENTS.scanHistory.firstChild && ELEMENTS.scanHistory.firstChild.innerText && ELEMENTS.scanHistory.firstChild.innerText.includes('Chưa có dữ liệu')) {
        ELEMENTS.scanHistory.innerHTML = '';
    }
    
    ELEMENTS.scanHistory.prepend(row);
    if (ELEMENTS.scanHistory.children.length > 5) ELEMENTS.scanHistory.lastChild.remove();
}

// Removed performSave as it's now Read-Only
async function performSave(rpro, qty) {
    showToast("ℹ️ Chế độ xem dữ liệu (Read-only)", "info");
}

function normalizeRPRO(text) {
    let clean = text.trim().toUpperCase();
    if (clean.includes('|')) {
        const parts = clean.split('|');
        clean = parts.find(p => p.startsWith('RPRO')) || clean;
    }
    const match = clean.match(/RPRO-[\d-]+/);
    return match ? match[0] : clean;
}

// ==================== DASHBOARD LOGIC ====================

async function refreshDashboard() {
    try {
        let query = supabase
            .from('powerapp')
            .select('*')
            .eq('"LAMINATION MACHINE (REALTIME)"', 'Hotmelt'); // QUOTED FOR SPACES/PARENS
        
        // Date filters from Flatpickr
        const picker = document.getElementById('date-range-picker')._flatpickr;
        if (picker && picker.selectedDates.length === 2) {
            const start = picker.selectedDates[0].toISOString();
            const end = new Date(picker.selectedDates[1].setHours(23,59,59,999)).toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Map PowerApp rows to Dashboard rows
        dashboardData = data.map(item => ({
            rpro: item['PRO ODER'],
            brand: item['Brand Code'],
            pu: item['PU DESCRIPTION'],
            fb: item['FB DESCRIPTION'],
            mold: item['#MOLD'],
            total_qty: item['Total Qty'],
            finish_date: item['Finish date'],
            // Map Stages using excelToISO
            hotmelt_out: excelToISO(item[COLUMN_MAP.hotmelt.out]),
            prefitting_out: excelToISO(item[COLUMN_MAP.prefitting.out]),
            molding_in: excelToISO(item[COLUMN_MAP.molding.in]),
            molding_out: excelToISO(item[COLUMN_MAP.molding.out]),
            leanline_in: excelToISO(item[COLUMN_MAP.leanline.in]),
            leanline_out: excelToISO(item[COLUMN_MAP.leanline.out]),
            updated_at: item.updated_at || item.created_at
        }));

        currentPage = 1; 
        updateStats();
        updateBrandFilter();
        renderTable();
        renderChart();
        
    } catch (err) {
        console.error("Dashboard error:", err);
        showToast("❌ Lỗi tải Dashboard (PowerApp)", "error");
    }
}

function updateStats() {
    let totalIn = 0;
    let totalOut = 0;
    let wipCount = 0;

    dashboardData.forEach(row => {
        // Total In at the beginning - We use hotmelt_out since there's no IN for Hotmelt
        totalIn += (row.total_qty || 0); // Or use individual stage counts
        // Total Out at the end (Leanline OUT)
        totalOut += (row.leanline_out ? row.total_qty : 0);
        
        // WIP = Started (Hotmelt OUT) but NOT finished (Leanline OUT)
        if (row.hotmelt_out && !row.leanline_out) {
            wipCount++;
        }
    });

    ELEMENTS.statTotalIn.textContent = totalIn.toLocaleString();
    ELEMENTS.statTotalOut.textContent = totalOut.toLocaleString();
    ELEMENTS.statWip.textContent = wipCount.toLocaleString();
    
    const rate = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) : 0;
    ELEMENTS.statCompletion.textContent = rate + '%';
    if (ELEMENTS.statCompletionBar) {
        ELEMENTS.statCompletionBar.style.width = rate + '%';
    }
}

function renderTable() {
    const searchTerm = ELEMENTS.tableSearch.value.toLowerCase();
    const brandFilter = ELEMENTS.brandFilter.value;
    const moldFilter = document.getElementById('mold-filter').value.toLowerCase();
    const finishDateFilter = document.getElementById('finish-date-filter').value;
    
    filteredData = dashboardData.filter(row => {
        const matchesRpro = row.rpro.toLowerCase().includes(searchTerm);
        const matchesBrand = brandFilter === 'all' || row.brand === brandFilter;
        const matchesMold = !moldFilter || (row.mold && row.mold.toLowerCase().includes(moldFilter));
        const matchesFinish = !finishDateFilter || (row.finish_date === finishDateFilter);
        return matchesRpro && matchesBrand && matchesMold && matchesFinish;
    });

    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const paginated = filteredData.slice(startIdx, startIdx + pageSize);

    // Update pagination labels
    document.getElementById('page-start').textContent = totalRecords > 0 ? startIdx + 1 : 0;
    document.getElementById('page-end').textContent = Math.min(startIdx + pageSize, totalRecords);
    document.getElementById('total-records').textContent = totalRecords;

    renderPaginationControls(totalPages);

    if (paginated.length === 0) {
        ELEMENTS.tableBody.innerHTML = `<tr><td colspan="9" class="px-6 py-20 text-center text-slate-300 italic">No data matching filters...</td></tr>`;
        return;
    }

    ELEMENTS.tableBody.innerHTML = paginated.map((row, idx) => {
        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-3 py-4 text-xs font-black text-slate-300 border-r">${String(startIdx + idx + 1).padStart(3, '0')}</td>
                <td class="px-4 py-4 border-r">
                    <div class="text-[12px] font-black text-slate-800">${row.rpro}</div>
                    <div class="text-[9px] text-slate-400 uppercase tracking-tighter">${row.brand || '---'} | ${row.pu || '---'}</div>
                </td>
                <td class="px-4 py-4 border-r text-center">
                    <div class="text-[11px] font-bold text-slate-700">${row.mold || '---'}</div>
                </td>
                <td class="px-4 py-4 border-r text-center font-black text-slate-400">
                    <span class="text-xs">${row.total_qty || '0'}</span>
                </td>
                <td class="px-3 py-4 border-r text-center ${row.hotmelt_out ? 'bg-emerald-50/20' : ''}">
                    ${renderMappingCell(row, 'hotmelt')}
                </td>
                <!-- STAGE: PREFITTING -->
                <td class="px-3 py-4 border-r text-center ${row.prefitting_out ? 'bg-blue-50/20' : ''}">
                    ${renderMappingCell(row, 'prefitting')}
                </td>
                <!-- STAGE: MOLDING -->
                <td class="px-3 py-4 border-r ${row.molding_in ? 'bg-orange-50/20' : ''}">
                    ${renderMappingCell(row, 'molding')}
                </td>
                <!-- STAGE: LEANLINE -->
                <td class="px-3 py-4 border-r ${row.leanline_in ? 'bg-rose-50/20' : ''}">
                    ${renderMappingCell(row, 'leanline')}
                </td>
                <td class="px-4 py-4 text-center text-[10px] text-slate-400">
                    ${row.finish_date ? formatDate(row.finish_date) : '---'}
                </td>
            </tr>
        `;
    }).join('');
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('pagination-controls');
    if (!container) return;
    
    let html = '';
    
    // Prev
    html += `<button onclick="changePage(${currentPage - 1})" class="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black hover:bg-slate-50 transition ${currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}">PREV</button>`;
    
    // Pages (Simplified)
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
        html += `<button onclick="changePage(${i})" class="w-8 h-8 rounded-lg text-[10px] font-black transition ${currentPage === i ? 'bg-red-500 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}">${i}</button>`;
    }
    
    if (totalPages > 5) html += `<span class="text-slate-300">...</span><button onclick="changePage(${totalPages})" class="w-8 h-8 rounded-lg text-[10px] font-black transition ${currentPage === totalPages ? 'bg-red-500 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}">${totalPages}</button>`;

    // Next
    html += `<button onclick="changePage(${currentPage + 1})" class="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black hover:bg-slate-50 transition ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}">NEXT</button>`;
    
    container.innerHTML = html;
}

window.changePage = (page) => {
    currentPage = page;
    renderTable();
};

function renderMappingCell(row, stage) {
    const timeIn = row[`${stage}_in`] || null;
    const timeOut = row[`${stage}_out`] || null;
    const config = UI_CONFIG[stage];
    
    if (!timeIn && !timeOut) return '<div class="text-center text-slate-200">---</div>';

    return `
        <div class="flex flex-col gap-1">
            ${config.hasIn ? `
            <div class="flex justify-between items-center bg-white/50 p-1 rounded-md border border-slate-100">
                <span class="text-[8px] text-emerald-600 font-black">IN:</span>
                <span class="text-[10px] font-bold">${formatTime(timeIn)}</span>
            </div>` : ''}
            <div class="flex justify-between items-center bg-white/50 p-1 rounded-md border border-slate-100">
                <span class="text-[8px] text-rose-600 font-black">OUT:</span>
                <span class="text-[10px] font-bold">${formatTime(timeOut)}</span>
            </div>
        </div>
    `;
}

function renderStatusBadge(row) {
    if (row.hotmelt_scan_in && row.hotmelt_scan_out) {
        return `<span class="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black italic">FINISHED</span>`;
    } else if (row.hotmelt_scan_in) {
        return `<span class="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-[10px] font-black animate-pulse uppercase">In Progress</span>`;
    }
    return `<span class="text-slate-200">---</span>`;
}

function renderChart() {
    // 1. Brand Analysis (Top 5 Percentage)
    const brandCounts = {};
    const brandVolumes = {}; // Sum of total_qty
    
    // We use filteredData to reflect current filters, or dashboardData if we want global?
    // User wants "theo các Brand đang chọn" -> use filteredData
    filteredData.forEach(row => {
        if (row.brand) {
            brandCounts[row.brand] = (brandCounts[row.brand] || 0) + 1;
            brandVolumes[row.brand] = (brandVolumes[row.brand] || 0) + (row.total_qty || 0);
        }
    });
    
    const topBrands = Object.keys(brandVolumes)
        .sort((a,b) => brandVolumes[b] - brandVolumes[a])
        .slice(0, 5);
        
    const totalVolume = topBrands.reduce((sum, b) => sum + brandVolumes[b], 0);
    const brandLabels = topBrands.map(b => {
        const pct = totalVolume > 0 ? Math.round((brandVolumes[b] / totalVolume) * 100) : 0;
        return `${b} (${pct}%)`;
    });
    const brandValues = topBrands.map(b => brandVolumes[b]);

    if (brandChart) brandChart.destroy();
    const ctxBrand = document.getElementById('chart-brands')?.getContext('2d');
    if (ctxBrand) {
        brandChart = new Chart(ctxBrand, {
            type: 'doughnut',
            data: {
                labels: brandLabels,
                datasets: [{
                    data: brandValues,
                    backgroundColor: [
                        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444'
                    ],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            font: { weight: 'bold', size: 10 },
                            padding: 20
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // 2. Production stats (Daily Volume - Using Leanline OUT for Finished Production)
    const dailyStats = {};
    filteredData.forEach(row => {
        if (row.updated_at) {
            const date = row.updated_at.split('T')[0];
            // Since we don't have separate hotmelt_qty_in anymore, we use total_qty if the order started
            if (row.hotmelt_out) {
                dailyStats[date] = (dailyStats[date] || 0) + (row.total_qty || 0);
            }
        }
    });

    const dates = Object.keys(dailyStats).sort();
    const productionValues = dates.map(d => dailyStats[d]);

    if (productionChart) productionChart.destroy();
    const ctxProd = document.getElementById('chart-production')?.getContext('2d');
    if (ctxProd) {
        productionChart = new Chart(ctxProd, {
            type: 'bar',
            data: {
                labels: dates.map(d => {
                    const [y, m, d_part] = d.split('-');
                    return `${d_part}/${m}`;
                }),
                datasets: [{
                    label: TRANSLATIONS[currentLanguage].chart_prod_label,
                    data: productionValues,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 8,
                    barThickness: 24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { weight: 'bold' } }
                    }
                }
            }
        });
    }
}

function updateBrandFilter() {
    const brands = [...new Set(dashboardData.map(r => r.brand).filter(Boolean))];
    ELEMENTS.brandFilter.innerHTML = '<option value="all">Tất cả Brand</option>' + 
        brands.map(b => `<option value="${b}">${b}</option>`).join('');
}

// ==================== UTILS ====================

function showDetails(data) {
    ELEMENTS.details.brand.textContent = data.Brand || '---';
    ELEMENTS.details.pu.textContent = data.PU || '---';
    ELEMENTS.details.fb.textContent = data.FB || '---';
    ELEMENTS.rproDetails.classList.remove('hidden');
    ELEMENTS.rproDetails.classList.add('animate__fadeInRight');
}

function addHistoryRow(rpro, qty, mode, stage) {
    const row = document.createElement('div');
    const stageName = (stage || currentStage).toUpperCase();
    row.className = `flex justify-between items-center bg-white p-4 rounded-2xl border-l-4 shadow-sm animate__animated animate__slideInRight ${mode === 'IN' ? 'border-emerald-500' : 'border-rose-500'}`;
    
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    
    row.innerHTML = `
        <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${time} - ${stageName} [${mode}]</span>
            <span class="text-sm font-black text-slate-800">${rpro}</span>
        </div>
        <div class="flex items-center gap-3">
            <div class="px-3 py-1 bg-slate-100 rounded-lg text-xs font-black">SL: ${qty}</div>
            <div class="w-8 h-8 flex items-center justify-center rounded-full ${mode === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        </div>
    `;
    
    if (ELEMENTS.scanHistory.firstChild && ELEMENTS.scanHistory.firstChild.innerText && ELEMENTS.scanHistory.firstChild.innerText.includes('Chưa có dữ liệu')) {
        ELEMENTS.scanHistory.innerHTML = '';
    }
    
    ELEMENTS.scanHistory.prepend(row);
    updateSessionCount();
}

async function fetchRecentHistory() {
    try {
        const { data } = await supabase
            .from('hotmelt')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(10);
            
        if (data && data.length > 0) {
            ELEMENTS.scanHistory.innerHTML = '';
            data.forEach(item => {
                // Determine latest stage activity
                const stages = ['hotmelt', 'prefitting', 'molding', 'leanline'];
                let latestStage = 'hotmelt';
                let latestTime = 0;
                
                stages.forEach(s => {
                    const tIn = item[`${s}_in`] ? new Date(item[`${s}_in`]).getTime() : 0;
                    const tOut = item[`${s}_out`] ? new Date(item[`${s}_out`]).getTime() : 0;
                    if (tIn > latestTime) { latestTime = tIn; latestStage = s; }
                    if (tOut > latestTime) { latestTime = tOut; latestStage = s; }
                });

                const mode = item[`${latestStage}_out`] ? 'OUT' : 'IN';
                const qty = mode === 'IN' ? (item[`${latestStage}_qty_in`] || 1) : (item[`${latestStage}_qty_out`] || 1);
                addHistoryRow(item.rpro, qty, mode, latestStage);
            });
        }
    } catch (e) {}
}

function updateSessionCount() {
    const count = ELEMENTS.scanHistory.children.length;
    ELEMENTS.sessionCount.textContent = count;
}

function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = `fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl text-white font-black text-lg animate__animated animate__bounceIn border-4 border-white ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('animate__bounceIn', 'animate__fadeOutUp');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function playAudio(isSuccess) {
    try {
        if (isSuccess) ELEMENTS.audio.success.play().catch(e => console.warn("Audio play failed:", e));
        else ELEMENTS.audio.error.play().catch(e => console.warn("Audio play failed:", e));
    } catch (e) {
        console.warn("Audio playback error:", e);
    }
}

function formatTime(iso) {
    if (!iso) return '--:--';
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const timePart = d.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(dashboardData.map(row => ({
        "PRO ORDER": row.rpro,
        "Brand": row.brand,
        "PU Code": row.pu,
        "FB": row.fb,
        "#Mold": row.mold,
        "Total Qty": row.total_qty,
        "Hotmelt Scan In": row.hotmelt_scan_in,
        "Hotmelt Scan Out": row.hotmelt_scan_out,
        "Qty In": row.hotmelt_qty_in,
        "Qty Out": row.hotmelt_qty_out,
        "DC": row.dc,
        "Finish Date": row.finish_date,
        "Created At": row.created_at,
        "Updated At": row.updated_at
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hotmelt Tracking");
    XLSX.writeFile(wb, `Hotmelt_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ==================== CAMERA SCANNER ====================

function toggleCamera() {
    if (cameraActive) {
        stopCamera();
    } else {
        startCamera();
    }
}

function startCamera() {
    ELEMENTS.cameraSection.classList.remove('hidden');
    ELEMENTS.btnToggleCamera.classList.add('bg-red-500', 'text-white');
    
    if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode("qr-reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess
    ).then(() => {
        cameraActive = true;
    }).catch(err => {
        console.error("Camera error:", err);
        showToast("⚠️ Không thể bật camera. Kiểm tra quyền truy cập!", "error");
        stopCamera();
    });
}

function stopCamera() {
    ELEMENTS.cameraSection.classList.add('hidden');
    ELEMENTS.btnToggleCamera.classList.remove('bg-red-500', 'text-white');
    
    if (html5QrScanner && cameraActive) {
        html5QrScanner.stop().then(() => {
            cameraActive = false;
        }).catch(err => console.error("Stop camera error:", err));
    } else {
        cameraActive = false;
    }
}

function onScanSuccess(decodedText) {
    if (isProcessing) return;
    handleRproDetected(decodedText);
}

window.toggleCamera = toggleCamera;
