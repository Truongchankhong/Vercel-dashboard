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
    statTotalBrands: document.getElementById('stat-total-brands'),
    statTotalOut: document.getElementById('stat-total-out'),
    statCompletion: document.getElementById('stat-completion'),
    statCompletionBar: document.getElementById('stat-completion-bar'),
    statHotmeltOrders: document.getElementById('stat-hotmelt-orders'),
    statProductivity: document.getElementById('stat-productivity'),
    statAvgDaily: document.getElementById('stat-avg-daily'),
    statHotmeltRatio: document.getElementById('stat-hotmelt-ratio'),
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
let productivityTrendChart = null;
let brandProductivityChart = null;
let html5QrScanner = null;
let cameraActive = false;
let currentLanguage = 'vi';
let currentPage = 1;
const pageSize = 15;
let filteredData = [];
let totalPowerAppVolume = 0; // Cumulative PO across all machines for ratio
let allOrdersData = []; // All PowerApp records for Check Order tab

const MOCK_DATA = [
    { 'PRO ODER': 'RPRO-NIKE-01', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'PU-AIR-01', 'FB DESCRIPTION': 'FLYKNIT-RED', '#MOLD': 'M-001', 'Total Qty': 550, 'Finish date': 46105, 'Laminating (Pro)': 46098.33, 'Prefitting (Pro)': 46098.50, 'Molding Pro (IN)': 46098.60, 'Molding Pro': 46098.70, 'IN lean Line (Pro)': 46098.80, 'Out lean Line (Pro)': 46098.90, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-NIKE-02', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'PU-AIR-02', 'FB DESCRIPTION': 'FLYKNIT-BLUE', '#MOLD': 'M-002', 'Total Qty': 320, 'Finish date': 46105, 'Laminating (Pro)': 46098.35, 'Prefitting (Pro)': 46098.55, 'Molding Pro (IN)': 46098.65, 'Molding Pro': 46098.75, 'IN lean Line (Pro)': 46098.85, 'Out lean Line (Pro)': 46098.95, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-ASICS-01', 'Brand Code': 'ASICS', 'PU DESCRIPTION': 'GEL-KAYANO', 'FB DESCRIPTION': 'MESH-SLV', '#MOLD': 'A-101', 'Total Qty': 480, 'Finish date': 46106, 'Laminating (Pro)': 46099.33, 'Prefitting (Pro)': 46099.50, 'Molding Pro (IN)': 46099.60, 'Molding Pro': 46099.70, 'IN lean Line (Pro)': 46099.80, 'Out lean Line (Pro)': 46099.90, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-ASICS-02', 'Brand Code': 'ASICS', 'PU DESCRIPTION': 'NIMBUS-25', 'FB DESCRIPTION': 'MESH-BLK', '#MOLD': 'A-102', 'Total Qty': 620, 'Finish date': 46106, 'Laminating (Pro)': 46099.35, 'Prefitting (Pro)': 46099.55, 'Molding Pro (IN)': 46099.65, 'Molding Pro': 46099.75, 'IN lean Line (Pro)': 46099.85, 'Out lean Line (Pro)': 46099.95, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-NIKE-03', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'REACT-01', 'FB DESCRIPTION': 'FLY-V2', '#MOLD': 'M-003', 'Total Qty': 280, 'Finish date': 46105, 'Laminating (Pro)': 46098.40, 'Prefitting (Pro)': 46098.60, 'Molding Pro (IN)': 46098.70, 'Molding Pro': 46098.80, 'IN lean Line (Pro)': 46098.90, 'Out lean Line (Pro)': 46098.98, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-NIKE-04', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'PEGASUS-40', 'FB DESCRIPTION': 'MESH-GRY', '#MOLD': 'M-004', 'Total Qty': 410, 'Finish date': 46107, 'Laminating (Pro)': 46100.33, 'Prefitting (Pro)': 46100.50, 'Molding Pro (IN)': 46100.60, 'Molding Pro': 46100.70, 'IN lean Line (Pro)': 46100.80, 'Out lean Line (Pro)': 46100.90, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-ASICS-03', 'Brand Code': 'ASICS', 'PU DESCRIPTION': 'GT-2000', 'FB DESCRIPTION': 'FABRIC-NAVY', '#MOLD': 'A-103', 'Total Qty': 350, 'Finish date': 46107, 'Laminating (Pro)': 46100.35, 'Prefitting (Pro)': 46100.55, 'Molding Pro (IN)': 46100.65, 'Molding Pro': 46100.75, 'IN lean Line (Pro)': 46100.85, 'Out lean Line (Pro)': 46100.95, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-NIKE-05', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'VAPORFLY', 'FB DESCRIPTION': 'FLYWEAVE-GRN', '#MOLD': 'M-005', 'Total Qty': 150, 'Finish date': 46108, 'Laminating (Pro)': 46101.33, 'Prefitting (Pro)': 46101.50, 'Molding Pro (IN)': 46101.60, 'Molding Pro': 46101.70, 'IN lean Line (Pro)': 46101.80, 'Out lean Line (Pro)': 46101.90, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-ASICS-04', 'Brand Code': 'ASICS', 'PU DESCRIPTION': 'NOVABLAST', 'FB DESCRIPTION': 'MESH-ORG', '#MOLD': 'A-104', 'Total Qty': 290, 'Finish date': 46108, 'Laminating (Pro)': 46101.35, 'Prefitting (Pro)': 46101.55, 'Molding Pro (IN)': 46101.65, 'Molding Pro': 46101.75, 'IN lean Line (Pro)': 46101.85, 'Out lean Line (Pro)': 46101.95, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() },
    { 'PRO ODER': 'RPRO-NIKE-06', 'Brand Code': 'NIKE', 'PU DESCRIPTION': 'ZOM-FLY', 'FB DESCRIPTION': 'FLYKNIT-BLK', '#MOLD': 'M-006', 'Total Qty': 440, 'Finish date': 46109, 'Laminating (Pro)': 46102.33, 'Prefitting (Pro)': 46102.50, 'Molding Pro (IN)': 46102.60, 'Molding Pro': 46102.70, 'IN lean Line (Pro)': 46102.80, 'Out lean Line (Pro)': 46102.90, 'LAMINATION MACHINE (REALTIME)': 'Hotmelt', created_at: new Date().toISOString() }
];

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
        title: "BÁO CÁO THEO DÕI HOTMELT",
        back: "QUAY LẠI",
        tab_scan: "CHECK ĐƠN",
        tab_check: "CHECK ĐƠN",
        tab_dashboard: "DASHBOARD",
        stat_wip: "HÀNG ĐANG CHẠY (WIP)",
        stat_total_out: "TỔNG HOÀN THÀNH (ĐÔI)",
        stat_completion: "TỈ LỆ HOÀN THÀNH",
        stat_hotmelt_orders: "ĐƠN SCAN OUT HOTMELT",
        stat_productivity: "NĂNG SUẤT (ĐÔI/GIỜ)",
        stat_avg_daily: "TB SẢN LƯỢNG/NGÀY",
        stat_hotmelt_ratio: "TỈ LỆ HOTMELT (%)",
        stat_total_brands: "TỔNG BRAND ÁP DỤNG",
        filter_time: "Thời gian",
        filter_brand: "Tất cả Brand",
        filter_mold: "Tất cả khuôn",
        filter_finish: "Finish date",
        col_rpro: "THÔNG TIN RPRO",
        col_brand: "BRAND",
        col_qty: "SỐ LƯỢNG",
        col_total: "TỔNG PO",
        col_finish: "FINISH DATE",
        col_hotmelt: "01. HOTMELT",
        col_prefitting: "02. PREFITTING",
        col_molding: "03. MOLDING",
        col_pu: "CHI TIẾT PU",
        col_fb: "CHI TIẾT FB",
        col_leanline: "04. LEANLINE",
        chart_prod_label: "Sản lượng hoàn thành",
        status_finished: "HOÀN THÀNH",
        search_placeholder: "Tìm kiếm RPRO/Brand...",
        showing: "Hiển thị",
        no_data: "Không có dữ liệu phù hợp...",
        of: "của",
        unit: "ĐÔI",
        click_filter_date: "Bấm để chọn ngày",
        table_title: "DANH SÁCH CHI TIẾT ĐƠN HÀNG HOTMELT",
        chart_brand_ratio: "PHÂN TÍCH THEO BRAND (%)",
        chart_prod_hourly: "BIỂU ĐỒ NĂNG SUẤT HOTMELT (ĐÔI/GIỜ)",
        chart_brand_prod: "NĂNG SUẤT HOTMELT THEO BRAND",
        chart_prod_finished: "SẢN LƯỢNG HOÀN THÀNH LEANLINE (SỐ ĐÔI)"
    },
    en: {
        title: "HOTMELT MONITORING DASHBOARD",
        back: "BACK",
        tab_scan: "CHECK ORDERS",
        tab_check: "CHECK ORDERS",
        tab_dashboard: "DASHBOARD",
        stat_wip: "WORK IN PROGRESS (WIP)",
        stat_total_out: "TOTAL FINISHED (PAIRS)",
        stat_completion: "COMPLETION RATE",
        stat_hotmelt_orders: "HOTMELT ORDERS",
        stat_productivity: "PRODUCTIVITY (P/H)",
        stat_avg_daily: "AVG DAILY OUTPUT",
        stat_hotmelt_ratio: "HOTMELT RATIO (%)",
        stat_total_brands: "TOTAL BRANDS",
        filter_time: "Time Range",
        filter_brand: "All Brands",
        filter_mold: "All Molds",
        filter_finish: "Finish date",
        col_rpro: "RPRO INFO",
        col_brand: "BRAND",
        col_qty: "QUANTITY",
        col_total: "TOTAL PO",
        col_finish: "FINISH DATE",
        col_hotmelt: "01. HOTMELT",
        col_prefitting: "02. PREFITTING",
        col_molding: "03. MOLDING",
        col_pu: "PU DESCRIPTION",
        col_fb: "FB DESCRIPTION",
        col_leanline: "04. LEANLINE",
        chart_prod_label: "Finished Production",
        status_finished: "FINISHED",
        search_placeholder: "Search RPRO/Brand...",
        showing: "Showing",
        no_data: "No data matching filters...",
        of: "of",
        unit: "PAIRS",
        click_filter_date: "Click to filter date",
        table_title: "HOTMELT ORDER DETAILED LIST",
        chart_brand_ratio: "BRAND ANALYSIS (%)",
        chart_prod_hourly: "HOTMELT PRODUCTIVITY TREND (P/H)",
        chart_brand_prod: "HOTMELT PRODUCTIVITY BY BRAND",
        chart_prod_finished: "FINISHED PRODUCTION VOLUME (PAIRS)"
    }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    if (ELEMENTS.rproInput) ELEMENTS.rproInput.focus();
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
    
    // Default to dashboard as requested by user
    if (typeof switchTab === 'function') {
        switchTab('dashboard');
    } else {
        // Fallback if switchTab is not yet available (unlikely)
        window.dispatchEvent(new CustomEvent('dashboard-active'));
    }
});

function setupEventListeners() {
    // Scan Mode Toggle
    window.setScanMode = (mode) => {
        scanMode = mode;
        const isIN = mode === 'IN';
        if (ELEMENTS.btnScanIn) ELEMENTS.btnScanIn.className = `flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${isIN ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`;
        if (ELEMENTS.btnScanOut) ELEMENTS.btnScanOut.className = `flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${!isIN ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`;
        if (ELEMENTS.btnSaveText) ELEMENTS.btnSaveText.textContent = isIN ? 'LƯU DỮ LIỆU (NHẬP)' : 'LƯU DỮ LIỆU (XUẤT)';
        if (ELEMENTS.rproInput) ELEMENTS.rproInput.focus();
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
            if (ELEMENTS.btnScanIn) ELEMENTS.btnScanIn.classList.remove('hidden');
        } else {
            if (ELEMENTS.btnScanIn) ELEMENTS.btnScanIn.classList.add('hidden');
            setScanMode('OUT');
        }
        
        if (ELEMENTS.rproInput) ELEMENTS.rproInput.focus();
    };

    // Manual Input Handler
    let typingTimer;
    if (ELEMENTS.rproInput) {
        ELEMENTS.rproInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toUpperCase();
            clearTimeout(typingTimer);
            
            if (val.startsWith('RPRO-') && val.length >= 12) {
                typingTimer = setTimeout(() => handleRproDetected(val), 300);
            }
        });
    }

    // Qty adjustments
    window.adjustQty = (delta) => {
        if (!ELEMENTS.qtyInput) return;
        let val = parseInt(ELEMENTS.qtyInput.value) || 0;
        val = Math.max(1, val + delta);
        ELEMENTS.qtyInput.value = val;
    };

    // Save Button - MODIFIED: Now acts as a Refresh/Check button
    if (ELEMENTS.btnSave) {
        ELEMENTS.btnSave.addEventListener('click', () => {
            if (ELEMENTS.rproInput) {
                const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
                if (rpro) handleRproDetected(rpro);
            }
        });
    }

    // Enter key support - Trigger check
    if (ELEMENTS.rproInput) {
        ELEMENTS.rproInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const rpro = ELEMENTS.rproInput.value.trim().toUpperCase();
                if (rpro) handleRproDetected(rpro);
            }
        });
    }

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
    if (serial === null || serial === undefined) return null;
    const s = String(serial).trim();
    if (s === '' || s.toUpperCase() === 'NULL' || isNaN(serial)) return null;
    const num = parseFloat(serial);
    if (num <= 0) return null; // 0 or negative serial is not a valid date
    return new Date((num - 25569) * 86400 * 1000).toISOString();
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
            if (ELEMENTS.rproDetails) showDetails(data);
            playAudio(true);
            
            // Repurpose History Row to show current status
            if (ELEMENTS.scanHistory) addStatusHistoryRow(data);

        } else {
            showToast(`⚠️ Không tìm thấy RPRO: ${rpro}`, 'error');
            playAudio(false);
            if (ELEMENTS.rproDetails) ELEMENTS.rproDetails.classList.add('hidden');
        }
    } catch (err) {
        console.error("Check error:", err);
        showToast("❌ Lỗi truy vấn dữ liệu", "error");
    } finally {
        isProcessing = false;
        if (ELEMENTS.inputLoader) setTimeout(() => ELEMENTS.inputLoader.classList.add('hidden'), 500);
    }
}

// Show current progress in the history area (Read-only)
function addStatusHistoryRow(data) {
    if (!ELEMENTS.scanHistory) return;
    const rpro = data['PRO ODER'];
    const row = document.createElement('div');
    row.className = `flex flex-col bg-white p-4 rounded-2xl border-l-4 border-indigo-500 shadow-sm animate__animated animate__slideInRight mb-3`;
    
    const checkTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    
    // Status indicators
    const hOUT = data[COLUMN_MAP.hotmelt.out];
    const pOUT = data[COLUMN_MAP.prefitting.out];
    const mOUT = data[COLUMN_MAP.molding.out];

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
        // Use select('*') to avoid Supabase 400 errors caused by column names
        // with special characters (parentheses, spaces) in the select string.
        // Filtering is done client-side after fetch.
        const { data: rawData, error } = await supabase
            .from('powerapp')
            .select('*');
        
        if (error) throw error;

        // Client-side filter: only rows related to Hotmelt (planned or realtime)
        let data = (rawData || []).filter(item => 
            item['LAMINATION MACHINE (REALTIME)'] === 'Hotmelt' ||
            item['LAMINATION MACHINE (PLAN)'] === 'Hotmelt'
        );
        
        // COMBINE: Always add Mock Data for RPROs not yet in DB
        const realRpros = new Set(data.map(item => item['PRO ODER']));
        const uniqueMock = MOCK_DATA.filter(m => !realRpros.has(m['PRO ODER']));
        data = [...data, ...uniqueMock];
        
        // Calculate total volume from fetched data directly
        totalPowerAppVolume = data.reduce((sum, row) => sum + (parseFloat(String(row['Total Qty'] || '0').replace(/,/g,'')) || 0), 0) || 10000;

        // Map PowerApp rows to Dashboard rows
        dashboardData = data.map(item => {
            const brandRaw = item['Brand Code'] || item['Brand'] || 'N/A';
            const qtyRaw = item['Total Qty'] || '0';
            
            return {
                rpro: item['PRO ODER'] || '---',
                brand: String(brandRaw).trim(),
                pu: item['PU DESCRIPTION'] || '---',
                fb: item['FB DESCRIPTION'] || '---',
                mold: item['#MOLD'] || '---',
                total_qty: parseFloat(String(qtyRaw).replace(/,/g, '')) || 0,
                finish_date: item['Finish date'],
                // Map Stages using excelToISO and COLUMN_MAP
                hotmelt_out: excelToISO(item[COLUMN_MAP.hotmelt.out]),
                prefitting_out: excelToISO(item[COLUMN_MAP.prefitting.out]),
                molding_in: excelToISO(item[COLUMN_MAP.molding.in]),
                molding_out: excelToISO(item[COLUMN_MAP.molding.out]),
                leanline_in: excelToISO(item[COLUMN_MAP.leanline.in]),
                leanline_out: excelToISO(item[COLUMN_MAP.leanline.out]),
                updated_at: item.updated_at || item.created_at
            };
        });

        currentPage = 1; 
        updateBrandFilter();
        calculateCheckOrderStats();
        renderTable(); // renderTable will now call updateStats and renderChart internally to stay in sync
        
    } catch (err) {
        console.error("Dashboard error:", err);
        showToast("❌ Lỗi tải Dashboard (PowerApp)", "error");
    }
}

function updateStats() {
    let hotmeltOutOrders = 0;
    let totalHotmeltVolume = 0;
    let totalFinishedVolume = 0;
    let wipCount = 0;
    let brands = new Set();
    let distinctDays = new Set();
    let firstScanTime = Infinity;
    let lastScanTime = -Infinity;

    filteredData.forEach(row => {
        const rowVol = row.total_qty || 0;
        totalHotmeltVolume += rowVol;
        
        if (row.brand) brands.add(row.brand);
        
        if (row.hotmelt_out) {
            hotmeltOutOrders++;
            const t = new Date(row.hotmelt_out).getTime();
            if (t < firstScanTime) firstScanTime = t;
            if (t > lastScanTime) lastScanTime = t;
            distinctDays.add(new Date(row.hotmelt_out).toLocaleDateString());
        }

        if (row.leanline_out) {
            totalFinishedVolume += rowVol;
        }
        
        if (row.hotmelt_out && !row.leanline_out) {
            wipCount++;
        }
    });

    // 1. Core metrics
    ELEMENTS.statHotmeltOrders.textContent = hotmeltOutOrders.toLocaleString();
    ELEMENTS.statTotalOut.textContent = totalFinishedVolume.toLocaleString();
    ELEMENTS.statWip.textContent = wipCount.toLocaleString();
    ELEMENTS.statTotalBrands.textContent = brands.size.toLocaleString();

    // 2. Productivity (Pairs/h)
    // Assume 8 hours/day if only 1 day, or actual elapsed if multiday.
    // Or simplified: Total Output / (elapsed hours or 8h minimum)
    let productivity = 0;
    if (hotmeltOutOrders > 0 && lastScanTime > firstScanTime) {
        let hours = (lastScanTime - firstScanTime) / (1000 * 60 * 60);
        if (hours < 1) hours = 1; 
        productivity = Math.round(totalHotmeltVolume / hours);
    }
    ELEMENTS.statProductivity.textContent = productivity.toLocaleString();

    // 3. Avg Daily Output
    const dayCount = Math.max(1, distinctDays.size);
    const avgDaily = Math.round(totalFinishedVolume / dayCount);
    ELEMENTS.statAvgDaily.textContent = avgDaily.toLocaleString();

    // 4. Hotmelt Ratio
    const ratio = totalPowerAppVolume > 0 ? Math.round((totalHotmeltVolume / totalPowerAppVolume) * 100) : 0;
    ELEMENTS.statHotmeltRatio.textContent = ratio + '%';
    
    // 5. Completion Rate
    const completionRate = totalHotmeltVolume > 0 ? Math.round((totalFinishedVolume / totalHotmeltVolume) * 100) : 0;
    ELEMENTS.statCompletion.textContent = completionRate + '%';
    if (ELEMENTS.statCompletionBar) {
        ELEMENTS.statCompletionBar.style.width = completionRate + '%';
    }
}

function renderTable() {
    const searchTerm = ELEMENTS.tableSearch.value.toLowerCase();
    const brandFilter = ELEMENTS.brandFilter.value;
    const moldFilter = document.getElementById('mold-filter').value.toLowerCase();
    const finishDateFilter = document.getElementById('finish-date-filter').value;
    
    const picker = document.getElementById('date-range-picker')._flatpickr;
    let startDate = null;
    let endDate = null;
    if (picker && picker.selectedDates.length === 2) {
        startDate = picker.selectedDates[0];
        endDate = new Date(picker.selectedDates[1].setHours(23,59,59,999));
    }

    filteredData = dashboardData.filter(row => {
        // 1. RPRO Search
        const matchesRpro = row.rpro.toLowerCase().includes(searchTerm);
        
        // 2. Brand Filter
        const matchesBrand = brandFilter === 'all' || row.brand === brandFilter;
        
        // 3. Mold Filter
        const matchesMold = !moldFilter || (row.mold && row.mold.toLowerCase().includes(moldFilter));
        
        // 4. Finish Date Filter
        let matchesFinish = true;
        if (finishDateFilter) {
            const rowDate = row.finish_date ? excelToISO(row.finish_date).split('T')[0] : '';
            matchesFinish = (rowDate === finishDateFilter);
        }

        // 5. Global Time Range Filter (Applied locally for Mock Data compatibility)
        let matchesTime = true;
        if (startDate && endDate) {
            const rowTime = new Date(row.updated_at || row.created_at);
            matchesTime = (rowTime >= startDate && rowTime <= endDate);
        }
        
        return matchesRpro && matchesBrand && matchesMold && matchesFinish && matchesTime;
    });

    updateStats();
    renderChart();

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
        ELEMENTS.tableBody.innerHTML = `<tr><td colspan="12" class="px-6 py-20 text-center text-slate-400 italic">${TRANSLATIONS[currentLanguage].no_data}</td></tr>`;
        return;
    }

    ELEMENTS.tableBody.innerHTML = paginated.map((row, idx) => {
        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-3 py-4 text-xs font-black text-slate-300 border-r">${String(startIdx + idx + 1).padStart(3, '0')}</td>
                <td class="px-4 py-4 border-r">
                    <div class="text-[12px] font-black text-slate-800">${row.rpro}</div>
                </td>
                <td class="px-4 py-4 border-r text-center">
                    <div class="text-[11px] font-bold text-slate-600">${row.brand || '---'}</div>
                </td>
                <td class="px-4 py-4 border-r">
                    <div class="text-[11px] font-bold text-slate-600">${row.pu || '---'}</div>
                </td>
                <td class="px-4 py-4 border-r">
                    <div class="text-[11px] font-bold text-slate-600">${row.fb || '---'}</div>
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
                        '#6366f1', // Indigo (Nike)
                        '#10b981', // Emerald (Asics)
                        '#f59e0b', // Amber
                        '#f43f5e', // Rose
                        '#06b6d4'  // Cyan
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
    // 3. Hotmelt Hourly Productivity Trend
    const hourStats = Array(24).fill(0);
    filteredData.forEach(row => {
        if (row.hotmelt_out) {
            const hour = new Date(row.hotmelt_out).getHours();
            hourStats[hour] += (row.total_qty || 0);
        }
    });

    if (productivityTrendChart) productivityTrendChart.destroy();
    const ctxTrend = document.getElementById('chart-productivity-trend')?.getContext('2d');
    if (ctxTrend) {
        productivityTrendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}h`),
                datasets: [{
                    label: 'Sản lượng/Giờ',
                    data: hourStats,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
                }
            }
        });
    }

    // 4. Productivity by Brand (Hotmelt Output Volume)
    const brandProdValues = Object.keys(brandVolumes).map(b => brandVolumes[b]);
    
    if (brandProductivityChart) brandProductivityChart.destroy();
    const ctxBrandProd = document.getElementById('chart-brand-productivity')?.getContext('2d');
    if (ctxBrandProd) {
        brandProductivityChart = new Chart(ctxBrandProd, {
            type: 'bar',
            data: {
                labels: topBrands,
                datasets: [{
                    label: 'Sản lượng Hotmelt (Đôi)',
                    data: brandValues,
                    backgroundColor: '#10b981',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
                }
            }
        });
    }
}

function updateBrandFilter() {
    const brands = [...new Set(dashboardData.map(r => r.brand).filter(Boolean))].sort();
    
    // 1. Sidebar Filter
    ELEMENTS.brandFilter.innerHTML = '<option value="all">Tất cả Brand</option>' + 
        brands.map(b => `<option value="${b}">${b}</option>`).join('');

    // 2. Check Order Card Checkboxes (Integrated)
    const container = document.getElementById('check-brand-container');
    if (container) {
        container.innerHTML = brands.map(b => `
            <label class="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50 transition-all select-none">
                <input type="checkbox" class="brand-check-item w-4 h-4 text-red-600 rounded cursor-pointer" value="${b}" onchange="calculateCheckOrderStats()">
                <span class="text-[11px] font-black text-slate-700 uppercase">${b}</span>
            </label>
        `).join('');
    }
}

// Global functions for Check Order Stats
window.calculateCheckOrderStats = () => {
    const sel = document.getElementById('check-brand-select');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => o.value) : [];
    
    // Use allOrdersData (all PowerApp records, no Hotmelt filter)
    const source = allOrdersData;
    const filtered = selected.length === 0 ? source : source.filter(r => selected.includes(r.brand));

    let totalRunning = 0;
    let totalPending = 0;
    const pendingRows = [];

    filtered.forEach(row => {
        const qty = row.total_qty || 0;
        // Strictly: Laminating (Pro) has value = Đang chạy, NULL = Chưa chạy
        if (row.hotmelt_out) {
            totalRunning += qty;
        } else {
            totalPending += qty;
            pendingRows.push(row);
        }
    });

    // Update summary stats
    const elRunning = document.getElementById('check-stat-running');
    const elPending = document.getElementById('check-stat-pending');
    if (elRunning) elRunning.textContent = totalRunning.toLocaleString();
    if (elPending) elPending.textContent = totalPending.toLocaleString();

    // Update pending table header counts
    const elCount = document.getElementById('check-pending-count');
    const elTotalQty = document.getElementById('check-pending-total-qty');
    if (elCount) elCount.textContent = `${pendingRows.length} ĐƠN`;
    if (elTotalQty) elTotalQty.textContent = `${totalPending.toLocaleString()} ĐÔI`;

    // Render pending orders table
    const tbody = document.getElementById('check-pending-table-body');
    if (!tbody) return;

    if (pendingRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-16 text-center text-slate-300 text-xs italic">
            ${selected.length === 0 ? 'Vui lòng chọn Brand để xem danh sách...' : 'Không có đơn nào chưa chạy cho brand đã chọn.'}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = pendingRows.map((row, idx) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-3 py-3 text-xs font-black text-slate-300 border-r">${String(idx + 1).padStart(3, '0')}</td>
            <td class="px-4 py-3 border-r">
                <div class="text-[12px] font-black text-slate-800">${row.rpro}</div>
            </td>
            <td class="px-4 py-3 border-r">
                <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase">${row.brand}</span>
            </td>
            <td class="px-4 py-3 border-r">
                <span class="text-[11px] font-bold text-slate-600">${row.mold || '---'}</span>
            </td>
            <td class="px-4 py-3 border-r text-center">
                <span class="text-[12px] font-black text-slate-700">${(row.total_qty || 0).toLocaleString()}</span>
                <span class="text-[9px] text-slate-400 ml-1">đôi</span>
            </td>
            <td class="px-4 py-3 border-r text-[11px] text-slate-600">${row.pu || '---'}</td>
            <td class="px-4 py-3 border-r text-[11px] text-slate-600">${row.fb || '---'}</td>
            <td class="px-4 py-3 text-center text-[11px] text-slate-500">${row.finish_date ? formatDate(row.finish_date) : '---'}</td>
        </tr>
    `).join('');
};

window.toggleAllBrandsCheck = (isSelected) => {
    const sel = document.getElementById('check-brand-select');
    if (sel) Array.from(sel.options).forEach(o => o.selected = isSelected);
    calculateCheckOrderStats();
};

// Load ALL PowerApp orders for the Check tab (no filter)
async function loadCheckOrderData() {
    try {
        const elRunning = document.getElementById('check-stat-running');
        const elPending = document.getElementById('check-stat-pending');
        if (elRunning) elRunning.textContent = '...';
        if (elPending) elPending.textContent = '...';

        const tbody = document.getElementById('check-pending-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-16 text-center text-slate-300 text-xs italic">Đang tải dữ liệu từ PowerApp...</td></tr>`;

        // Supabase limits to 1000 rows by default. Use pagination to fetch ALL rows.
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
            const { data: batch, error } = await supabase
                .from('powerapp')
                .select('*')
                .range(from, from + batchSize - 1);
            if (error) throw error;
            if (!batch || batch.length === 0) break;
            allData = allData.concat(batch);
            if (batch.length < batchSize) break; // Last page
            from += batchSize;
        }
        const data = allData;

        // Map ALL records — no Hotmelt filter. Classify only by Laminating (Pro)
        allOrdersData = (data || []).map(item => ({
            rpro: item['PRO ODER'] || '---',
            brand: String(item['Brand Code'] || item['Brand'] || 'N/A').trim(),
            mold: item['#MOLD'] || '---',
            total_qty: parseFloat(String(item['Total Qty'] || '0').replace(/,/g,'')) || 0,
            pu: item['PU DESCRIPTION'] || '---',
            fb: item['FB DESCRIPTION'] || '---',
            finish_date: item['Finish date'],
            // Running = has a valid numeric value in Laminating (Pro)
            hotmelt_out: excelToISO(item['Laminating (Pro)'])
        }));

        // Build brand list from ALL orders → populate dropdown
        const allBrands = [...new Set(allOrdersData.map(r => r.brand).filter(b => b && b !== 'N/A' && b !== '---'))].sort();
        const sel = document.getElementById('check-brand-select');
        if (sel) {
            sel.innerHTML = allBrands.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        // Reset stats
        if (elRunning) elRunning.textContent = '0';
        if (elPending) elPending.textContent = '0';
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-16 text-center text-slate-300 text-xs italic">Vui lòng chọn Brand để xem danh sách...</td></tr>`;

    } catch(err) {
        console.error('Check Order load error:', err);
        const tbody = document.getElementById('check-pending-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-400 text-xs">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// Expose to global scope (required because hotmelt.js is an ES module)
window.loadCheckOrderData = loadCheckOrderData;

function showDetails(data) {
    ELEMENTS.details.brand.textContent = data.Brand || '---';
    ELEMENTS.details.pu.textContent = data.PU || '---';
    ELEMENTS.details.fb.textContent = data.FB || '---';
    ELEMENTS.rproDetails.classList.remove('hidden');
    ELEMENTS.rproDetails.classList.add('animate__fadeInRight');
}

function addHistoryRow(rpro, qty, mode, stage) {
    if (!ELEMENTS.scanHistory) return;
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
            if (ELEMENTS.scanHistory) ELEMENTS.scanHistory.innerHTML = '';
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
    if (ELEMENTS.scanHistory && ELEMENTS.sessionCount) {
        const count = ELEMENTS.scanHistory.children.length;
        ELEMENTS.sessionCount.textContent = count;
    }
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
// Theme Toggle Logic
const themeBtn = document.getElementById('theme-toggle');
const themeSun = document.getElementById('theme-sun');
const themeMoon = document.getElementById('theme-moon');

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcons(isDark);
    renderChart(); // Redraw charts for possible color context
}

function updateThemeIcons(isDark) {
    if (isDark) {
        themeSun.classList.remove('hidden');
        themeMoon.classList.add('hidden');
    } else {
        themeSun.classList.add('hidden');
        themeMoon.classList.remove('hidden');
    }
}

// Init theme
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    updateThemeIcons(true);
}

if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
