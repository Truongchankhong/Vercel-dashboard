import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const tableBody = document.getElementById('progress-table-body');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const searchInput = document.getElementById('search-input');
const dateStartInput = document.getElementById('date-start');
const dateEndInput = document.getElementById('date-end');
const btnExport = document.getElementById('btn-export');

// Modal Elements
// Modal Elements
const detailModal = document.getElementById('detail-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalContent = document.getElementById('modal-content');

// Note Modal Elements
const noteModal = document.getElementById('note-modal');
const noteInput = document.getElementById('note-input');
const noteTitle = document.getElementById('note-modal-title');
const btnSaveNote = document.getElementById('btn-save-note');

// Stats Modal Elements
const btnShowStats = document.getElementById('btn-show-stats');
const btnCloseStats = document.getElementById('btn-close-stats');
const statsModal = document.getElementById('stats-modal');

let currentNoteTarget = null; // {rpro, section}
let monitorCharts = {}; // Store Chart instances

// ==================== STATE ====================
let progressMap = {};
let orderDetailsCache = {}; // Cache order details to save egress
let progressData = [];
let currentPage = 1;
const itemsPerPage = 100;
let currentSort = { column: 'last_updated', direction: 'desc' }; // Default sort
let moldFilter = ""; // State for Mold search
const stageSequence = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
let pendingListStore = {}; // Global store for pending RPROs per stage
let activePendingStage = null; // Currently viewed stage in pending modal
const pendingSearchInput = document.getElementById('pending-search-input');

// Loading State Elements
const loadingOverlay = document.getElementById('loading-overlay');
const progressBarFill = document.getElementById('progress-bar-fill');
const loadingPercentage = document.getElementById('loading-percentage');
const loadingSubtext = document.getElementById('loading-subtext');

// Pagination Elements
const paginationControls = document.getElementById('pagination-controls');
const showingRangeText = document.getElementById('showing-range');
const totalCountText = document.getElementById('total-count');
const currentRangeLabel = document.getElementById('current-range-label');

// Finish Date Filter Elements
const finishDateFilterInput = document.getElementById('finish-date-filter');
const finishDateBadgeContainer = document.getElementById('finish-date-badge-container');
const finishDateBadge = document.getElementById('finish-date-badge');
const btnClearDateFilter = document.getElementById('btn-clear-date-filter');

let lastFetchedRange = "";

// Expose to window for HTML onclick
window.openMoldFilter = () => {
    const val = prompt("🔍 Nhập mã khuôn (#MOLD) để tìm kiếm (tương đối):", moldFilter);
    if (val !== null) {
        moldFilter = val.trim();
        currentPage = 1; // Reset to page 1
        renderTable(); // Re-render
    }
};

// ==================== HELPERS ====================
// Helper to get YYYY-MM-DD from any date value for comparison
const getComparableDateStr = (serial) => {
    if (!serial) return null;
    let d;
    const num = Number(serial);
    if (!isNaN(num) && num > 20000) {
        d = new Date((num - 25569) * 86400 * 1000);
    } else {
        d = new Date(serial);
    }
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};

// Helper to format Excel Serial Date or String Date
const formatExcelDate = (serial) => {
    if (!serial) return '-';
    const num = Number(serial);
    // If numeric and looks like Excel Serial (e.g. 45000+)
    if (!isNaN(num) && num > 20000) {
        // 25569 is offset for 1970-01-01
        const date = new Date((num - 25569) * 86400 * 1000);
        return date.toLocaleDateString('vi-VN'); // DD/MM/YYYY
    }
    // Fallback
    const d = new Date(serial);
    return isNaN(d.getTime()) ? serial : d.toLocaleDateString('vi-VN');
};

// ==================== LOADING LOGIC ====================
function updateLoading(percent, text) {
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    if (loadingPercentage) loadingPercentage.textContent = percent;
    if (loadingSubtext && text) loadingSubtext.textContent = text;
}

function showLoading() {
    currentPage = 1; // Reset page on refresh
    loadingOverlay.classList.remove('hidden');
    updateLoading(0, 'Đang chuẩn bị kết nối dữ liệu...');
}

function hideLoading() {
    updateLoading(100, 'Tải dữ liệu hoàn tất!');
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 500);
}

// ==================== INIT DATES ====================
function initDates() {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    // Set start to beginning of day (00:00) 7 days ago
    lastWeek.setHours(0, 0, 0, 0);

    // Set end to end of today (23:59)
    today.setHours(23, 59, 59, 999);

    const formatForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    dateStartInput.value = formatForInput(lastWeek);
    dateEndInput.value = formatForInput(today);
}

// ==================== FETCH DATA ====================
// Shared helper to compile and match tracking scans with confirmation rows
function compileProgressData(trackingList, confirmList, startRange, endRange) {
    const targetMap = {};

    // Group confirmations by RPRO, sorted by created_at ascending
    const confirmsByRpro = {};
    confirmList.forEach(c => {
        if (!confirmsByRpro[c.rpro]) {
            confirmsByRpro[c.rpro] = [];
        }
        confirmsByRpro[c.rpro].push(c);
    });
    Object.keys(confirmsByRpro).forEach(rpro => {
        confirmsByRpro[rpro].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });

    // Extract all unique RPROs from tracking
    const trackingRpros = new Set(trackingList.map(r => r.rpro));

    // Pre-populate targetMap with ALL confirmation records
    confirmList.forEach(c => {
        const key = `${c.rpro}_${c.id}`;
        targetMap[key] = {
            key: key,
            rpro: c.rpro,
            confirm_id: c.id,
            created_at: c.created_at,
            remark2: c.remark2,
            total: c.total,
            qty_sup: (c.available_supplement !== null) ? c.available_supplement : c.total,
            confirm_date: c.updated_at,
            confirm_status: c.confirm,
            so: null,
            brand: null,
            customer: null,
            total_qty: null,
            mold: null,
            finish_date: null,
            
            last_updated: c.created_at,
            stages: {
                'Dán': { in: null, out: null, note: null, note_time: null },
                'Cắt': { in: null, out: null, note: null, note_time: null },
                'Molding': { in: null, out: null, note: null, note_time: null },
                'DC': { in: null, out: null, note: null, note_time: null },
                'Molded': { in: null, out: null, note: null, note_time: null }
            },
            has_scans_in_range: false,
            is_confirm_in_range: (new Date(c.created_at) >= new Date(startRange) && new Date(c.created_at) <= new Date(endRange))
        };
    });

    // Pre-populate targetMap with virtual rows for RPROs with scans but no confirmations
    trackingRpros.forEach(rpro => {
        if (!confirmsByRpro[rpro] || confirmsByRpro[rpro].length === 0) {
            const key = `${rpro}_none`;
            targetMap[key] = {
                key: key,
                rpro: rpro,
                confirm_id: null,
                created_at: null,
                remark2: null,
                total: 0,
                qty_sup: null,
                confirm_date: null,
                confirm_status: null,
                so: null,
                brand: null,
                customer: null,
                total_qty: null,
                mold: null,
                finish_date: null,
                
                last_updated: null,
                stages: {
                    'Dán': { in: null, out: null, note: null, note_time: null },
                    'Cắt': { in: null, out: null, note: null, note_time: null },
                    'Molding': { in: null, out: null, note: null, note_time: null },
                    'DC': { in: null, out: null, note: null, note_time: null },
                    'Molded': { in: null, out: null, note: null, note_time: null }
                },
                has_scans_in_range: false,
                is_confirm_in_range: false
            };
        }
    });

    // Sort tracking list ascending (chronological) to process oldest to newest
    const sortedTracking = [...trackingList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Distribute scans to correct confirmation rows
    sortedTracking.forEach(record => {
        const rpro = record.rpro;
        const scanTime = new Date(record.created_at);

        let matchedConfirmId = null;
        const confirms = confirmsByRpro[rpro] || [];
        if (confirms.length > 0) {
            let bestConfirm = null;
            for (let i = 0; i < confirms.length; i++) {
                const confTime = new Date(confirms[i].created_at);
                if (confTime <= scanTime) {
                    bestConfirm = confirms[i];
                }
            }
            if (!bestConfirm) {
                bestConfirm = confirms[0];
            }
            matchedConfirmId = bestConfirm.id;
        }

        const key = matchedConfirmId ? `${rpro}_${matchedConfirmId}` : `${rpro}_none`;
        const item = targetMap[key];

        if (item) {
            item.has_scans_in_range = true;
            if (!item.last_updated || new Date(record.created_at) > new Date(item.last_updated)) {
                item.last_updated = record.created_at;
            }

            const stage = item.stages[record.section];
            if (stage) {
                if (record.action !== 'NOTE' && (!item.last_scan || new Date(record.created_at) > new Date(item.last_scan.time))) {
                    item.last_scan = {
                        section: record.section,
                        action: record.action,
                        time: record.created_at
                    };
                }

                if (record.action === 'NOTE') {
                    if (!stage.note_time || new Date(record.created_at) > new Date(stage.note_time)) {
                        stage.note = record.note;
                        stage.note_time = record.created_at;
                    }
                } else {
                    if (record.note && record.note.trim() !== '') {
                        if (!stage.note_time || new Date(record.created_at) > new Date(stage.note_time)) {
                            stage.note = record.note;
                            stage.note_time = record.created_at;
                        }
                    }

                    const dataPoint = {
                        time: record.created_at,
                        qty: record.quantity || 0
                    };

                    if (record.action === 'IN') {
                        if (!stage.in || new Date(record.created_at) > new Date(stage.in.time)) {
                            stage.in = dataPoint;
                        }
                    } else if (record.action === 'OUT') {
                        if (!stage.out || new Date(record.created_at) > new Date(stage.out.time)) {
                            stage.out = dataPoint;
                        }
                    }
                }
            }
        }
    });

    // Filter to keep only active rows (either had scans in range or confirmation in range)
    const filteredMap = {};
    Object.entries(targetMap).forEach(([key, item]) => {
        if (item.has_scans_in_range || item.is_confirm_in_range) {
            filteredMap[key] = item;
        }
    });

    return filteredMap;
}

// ==================== FETCH DATA ====================
async function fetchProgressData() {
    const fromDateTime = dateStartInput.value;
    const toDateTime = dateEndInput.value;

    if (!fromDateTime || !toDateTime) return;

    showLoading();

    try {
        updateLoading(10, 'Đang truy vấn lịch sử quét (Tracking) và danh sách xác nhận...');
        
        const fromIso = new Date(fromDateTime).toISOString();
        const toIso = new Date(toDateTime).toISOString();

        // 1. Fetch tracking scans in range
        const { data: trackingData, error: trackingError } = await supabase
            .from('supplement_tracking')
            .select('id, rpro, section, action, quantity, note, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (trackingError) throw trackingError;

        // 2. Fetch confirmations in range
        const { data: confirmationsInRange, error: confirmError } = await supabase
            .from('supplement_confirm')
            .select('id, rpro, total, available_supplement, confirm, updated_at, remark2, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .limit(5000);

        if (confirmError) throw confirmError;

        // Extract all unique RPROs from both sources
        const rproSet = new Set();
        trackingData.forEach(r => rproSet.add(r.rpro));
        confirmationsInRange.forEach(c => rproSet.add(c.rpro));
        const rproList = Array.from(rproSet);

        // Fetch ALL confirmations for all these RPROs (to have complete history for matching scans)
        let allConfirmations = [];
        if (rproList.length > 0) {
            for (let i = 0; i < rproList.length; i += 100) {
                const chunk = rproList.slice(i, i + 100);
                const { data: confirmBatch, error: err } = await supabase
                    .from('supplement_confirm')
                    .select('id, rpro, total, available_supplement, confirm, updated_at, remark2, created_at')
                    .in('rpro', chunk);
                if (confirmBatch) {
                    allConfirmations = allConfirmations.concat(confirmBatch);
                }
            }
        }

        updateLoading(35, 'Đang tổng hợp danh sách đơn hàng...');
        
        // Compile the progressMap
        progressMap = compileProgressData(trackingData, allConfirmations, fromDateTime, toDateTime);

        // Enrich missing details (powerapp / Masterdata)
        if (rproList.length > 0) {
            updateLoading(50, `Đang tải chi tiết cho ${rproList.length} đơn hàng...`);
            await enrichProgressMapMetadata(progressMap, rproList);
        }

        updateLoading(95, 'Đang chuẩn bị hiển thị...');

        // Save current range for display
        const formatDate = (val) => {
            const d = new Date(val);
            return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };
        lastFetchedRange = `${formatDate(fromDateTime)} - ${formatDate(toDateTime)}`;

        refreshTableData();
        hideLoading();

    } catch (err) {
        console.error("Error fetching data:", err);
        hideLoading();
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-600">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

async function enrichProgressMapMetadata(targetMap, rproList) {
    if (!rproList || rproList.length === 0) return;

    // Find which RPROs actually need fetching (not in cache or incomplete)
    const missingInfoRpros = rproList.filter(rpro => !orderDetailsCache[rpro] || !orderDetailsCache[rpro].so);

    // 1. Fetch missing PowerApp Details
    if (missingInfoRpros.length > 0) {
        // Chunk requests of 100 to avoid URL length issues
        for (let i = 0; i < missingInfoRpros.length; i += 100) {
            const chunk = missingInfoRpros.slice(i, i + 100);
            const { data: orderDetails } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "Finish date", "SO", "Brand Code", "CUSTOMERS", "Total Qty", "#MOLD"')
                .in('"PRO ODER"', chunk);

            if (orderDetails) {
                orderDetails.forEach(item => {
                    const code = item['PRO ODER'];
                    if (!orderDetailsCache[code]) orderDetailsCache[code] = {};
                    Object.assign(orderDetailsCache[code], {
                        finish_date: item['Finish date'],
                        so: item['SO'],
                        brand: item['Brand Code'],
                        customer: item['CUSTOMERS'],
                        total_qty: item['Total Qty'],
                        mold: item['#MOLD']
                    });
                });
            }
        }

        // Fallback for Masterdata
        const stillMissingInfo = missingInfoRpros.filter(rpro => !orderDetailsCache[rpro] || !orderDetailsCache[rpro].so);
        if (stillMissingInfo.length > 0) {
            for (let i = 0; i < stillMissingInfo.length; i += 100) {
                const chunk = stillMissingInfo.slice(i, i + 100);
                const { data: masterDetails } = await supabase
                    .from('Masterdata')
                    .select('"PRO ODER", "Finish date", "SO", "Brand Code", "CUSTOMERS", "Total Qty", "#MOLD"')
                    .in('"PRO ODER"', chunk);

                if (masterDetails) {
                    masterDetails.forEach(item => {
                        const code = item['PRO ODER'];
                        if (!orderDetailsCache[code]) orderDetailsCache[code] = {};
                        Object.assign(orderDetailsCache[code], {
                            finish_date: item['Finish date'],
                            so: item['SO'],
                            brand: item['Brand Code'],
                            customer: item['CUSTOMERS'],
                            total_qty: item['Total Qty'],
                            mold: item['#MOLD']
                        });
                    });
                }
            }
        }
    }

    // 2. Apply Cache to targetMap
    Object.keys(targetMap).forEach(key => {
        const item = targetMap[key];
        const rpro = item.rpro;
        if (orderDetailsCache[rpro]) {
            Object.assign(item, orderDetailsCache[rpro]);
        }
    });
}

function refreshTableData() {
    progressData = Object.values(progressMap).sort((a, b) => {
        let valA, valB;

        if (currentSort.column === 'rpro') {
            valA = a.rpro + '_' + String(a.confirm_id || 0).padStart(10, '0');
            valB = b.rpro + '_' + String(b.confirm_id || 0).padStart(10, '0');
        } else if (currentSort.column === 'finish_date') {
            valA = a.finish_date ? Number(a.finish_date) : 0;
            valB = b.finish_date ? Number(b.finish_date) : 0;
        } else if (['Dán', 'Cắt', 'Molding', 'DC', 'Molded'].includes(currentSort.column)) {
            // Sort by latest activity in this section
            const stageA = a.stages[currentSort.column];
            const stageB = b.stages[currentSort.column];

            const getStageTime = (s) => {
                const times = [];
                if (s.in) times.push(new Date(s.in.time).getTime());
                if (s.out) times.push(new Date(s.out.time).getTime());
                return times.length > 0 ? Math.max(...times) : 0;
            };

            valA = getStageTime(stageA);
            valB = getStageTime(stageB);
        } else {
            // Default: last_updated
            valA = new Date(a.last_updated).getTime();
            valB = new Date(b.last_updated).getTime();
        }

        if (currentSort.direction === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });

    updateSortIcons();
    updatePendingCounts();
    renderTable();
}

// ==================== PENDING COUNT LOGIC ====================
function updatePendingCounts() {
    // Explicit connections [Current Stage]: [Previous Stage]
    const connections = {
        'Cắt': 'Dán',
        'Molding': 'Cắt',
        'Molded': 'Molding'
        // 'DC': 'Molding' // User requested: No pending count display for DC
    };

    const pending = { 'Dán': [], 'Cắt': [], 'Molding': [], 'DC': [], 'Molded': [] };

    // Calculate pending for each order
    Object.values(progressMap).forEach(item => {
        for (const [currStage, prevStage] of Object.entries(connections)) {
            const prevData = item.stages[prevStage];
            const currData = item.stages[currStage];

            // PENDING IF: Previous stage has OUT, and Current stage has NEITHER IN nor OUT
            const isProcessed = currData && (currData.in || currData.out);
            if (prevData && prevData.out && !isProcessed) {
                pending[currStage].push({
                    rpro: item.rpro,
                    mold: item.mold || '-',
                    prevTime: prevData.out.time,
                    qty: prevData.out.qty,
                    remark2: item.remark2 || ''
                });
            }
        }
    });

    pendingListStore = pending;

    // Calculate Average Latencies for UI speed display
    const latencies = { 'Cắt': { total: 0, count: 0 }, 'Molding': { total: 0, count: 0 }, 'Molded': { total: 0, count: 0 } };
    Object.values(progressMap).forEach(item => {
        for (const [curr, prev] of Object.entries(connections)) {
            if (!latencies[curr]) continue;
            const prevStage = item.stages[prev];
            const currStage = item.stages[curr];
            if (prevStage && prevStage.out && currStage) {
                const currTimeVal = currStage.in ? currStage.in.time : (currStage.out ? currStage.out.time : null);
                if (currTimeVal) {
                    const diff = (new Date(currTimeVal) - new Date(prevStage.out.time)) / (1000 * 60 * 60);
                    if (diff > 0) {
                        latencies[curr].total += diff;
                        latencies[curr].count++;
                    }
                }
            }
        }
    });

    // Update UI headers
    ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'].forEach(stage => {
        const container = document.getElementById(`pending-${stage}`);
        if (!container) return;

        const list = pending[stage] || [];
        const stats = latencies[stage];
        const avgText = (stats && stats.count > 0) ? `⚡ ${(stats.total / stats.count).toFixed(1)}h` : '';

        if (list.length > 0) {
            container.innerHTML = `
                <div class="pending-badge" onclick="event.stopPropagation(); window.openPendingModal('${stage}')">⏳ ${list.length} đơn chờ</div>
                ${avgText ? `<div class="text-[10px] font-black text-blue-600 mt-1 animate-pulse" title="Tốc độ chuyển đổi trung bình">${avgText}</div>` : ''}
            `;
            container.classList.remove('hidden');
        } else {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    });
}

window.openPendingModal = (stage) => {
    activePendingStage = stage;
    const modal = document.getElementById('pending-modal');
    const title = document.getElementById('pending-modal-title');

    // Reset search
    if (pendingSearchInput) pendingSearchInput.value = '';

    title.textContent = stage;
    renderPendingList();
    modal.classList.remove('hidden');
    if (pendingSearchInput) pendingSearchInput.focus();
};

function renderPendingList() {
    const listContainer = document.getElementById('pending-modal-list');
    if (!listContainer || !activePendingStage) return;

    const list = pendingListStore[activePendingStage] || [];
    const filterText = (pendingSearchInput ? pendingSearchInput.value : '').toUpperCase().trim();

    // Sort by previous stage out time (oldest first)
    const sorted = [...list].sort((a, b) => new Date(a.prevTime) - new Date(b.prevTime));

    // Filter
    const filtered = sorted.filter(item =>
        item.rpro.toUpperCase().includes(filterText) || (item.mold && item.mold.toUpperCase().includes(filterText))
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-gray-400 font-bold italic">Không tìm thấy đơn nào phù hợp...</div>`;
        return;
    }

    listContainer.innerHTML = filtered.map(item => {
        let redoBadge = '';
        if (item.remark2) {
            redoBadge = `<span class="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">${item.remark2}</span>`;
        }
        return `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-red-50 transition-colors">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="font-mono font-black text-blue-600">${item.rpro}</span>
                        <span class="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-bold">Khuôn: ${item.mold}</span>
                        ${redoBadge}
                    </div>
                    <div class="text-[11px] text-gray-500">
                        Hoàn thành công đoạn trước: <span class="font-bold text-gray-700">${new Date(item.prevTime).toLocaleString('vi-VN')}</span>
                    </div>
                </div>
                <div class="mt-2 sm:mt-0 flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Số lượng</p>
                        <p class="font-black text-red-600">${item.qty} đôi</p>
                    </div>
                    <button onclick="window.location.href='supplement-count.html?rpro=${item.rpro}'" 
                            class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                        Scan In
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Add search listener
if (pendingSearchInput) {
    pendingSearchInput.addEventListener('input', renderPendingList);
}

window.toggleSort = (column) => {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
    }
    refreshTableData();
};

function updateSortIcons() {
    const columns = ['rpro', 'Dán', 'Cắt', 'Molding', 'DC', 'Molded', 'finish_date'];
    columns.forEach(col => {
        const icon = document.getElementById(`sort-icon-${col}`);
        if (icon) {
            if (currentSort.column === col) {
                icon.innerHTML = currentSort.direction === 'asc' ? '🔼' : '🔽';
                icon.className = "inline-block ml-1 text-[10px]";
            } else {
                icon.innerHTML = '↕️';
                icon.className = "inline-block ml-1 text-[10px] opacity-20";
            }
        }
    });
}

// ==================== RENDER TABLE ====================
function renderTable() {
    const searchTerm = searchInput.value.trim().toUpperCase();

    const finishDateFilterVal = finishDateFilterInput ? finishDateFilterInput.value : '';

    // Update UI Badge
    if (finishDateFilterVal) {
        if (finishDateBadge) {
            const [y, m, d] = finishDateFilterVal.split('-');
            finishDateBadge.textContent = `${d}/${m}/${y}`;
        }
        if (finishDateBadgeContainer) finishDateBadgeContainer.classList.remove('hidden');
    } else {
        if (finishDateBadgeContainer) finishDateBadgeContainer.classList.add('hidden');
    }

    const rproMatches = searchTerm.match(/RPRO-[\d-]+/g);
    const cleanMatches = rproMatches ? rproMatches.map(m => m.replace(/[^A-Z0-9]/g, "").toUpperCase()) : [];

    let filtered = progressData.filter(item => {
        let codeMatch = true;

        if (cleanMatches.length > 0) {
            const cleanRpro = (item.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            codeMatch = cleanMatches.some(m => cleanRpro.includes(m));
        } else if (searchTerm) {
            const cleanSearch = searchTerm.replace(/[^A-Z0-9]/g, "");
            const cleanRpro = (item.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            codeMatch = cleanRpro.includes(cleanSearch);
        }

        // Mold Filter (Relative search)
        const cleanMoldSearch = moldFilter.replace(/[^A-Z0-9]/g, "").toUpperCase();
        const cleanItemMold = (item.mold || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        const moldMatch = cleanMoldSearch ? cleanItemMold.includes(cleanMoldSearch) : true;

        if (!finishDateFilterVal) return codeMatch && moldMatch;

        const itemDateStr = getComparableDateStr(item.finish_date);
        return codeMatch && moldMatch && itemDateStr === finishDateFilterVal;
    });

    // Custom Sort by search order
    if (cleanMatches.length > 0) {
        filtered.sort((a, b) => {
            const rproA = (a.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            const rproB = (b.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            let idxA = cleanMatches.findIndex(m => rproA.includes(m));
            let idxB = cleanMatches.findIndex(m => rproB.includes(m));
            return (idxA === -1 ? 99999 : idxA) - (idxB === -1 ? 99999 : idxB);
        });

        // Show alert for missing RPROs
        const foundRpros = filtered.map(item => (item.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase());
        const missing = rproMatches.filter(m => {
            const cleanM = m.replace(/[^A-Z0-9]/g, "").toUpperCase();
            return !foundRpros.some(f => f.includes(cleanM));
        });
        if (missing.length > 0) {
            alert("⚠️ Không tìm thấy các đơn: " + missing.join(", "));
        }
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        if (paginationControls) paginationControls.innerHTML = '';
        if (showingRangeText) showingRangeText.textContent = '0 - 0';
        if (totalCountText) totalCountText.textContent = '0';
        return;
    }

    emptyState.classList.add('hidden');

    // Pagination Logic
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Ensure currentPage is within bounds
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIdx, endIdx);

    // Update range text
    if (showingRangeText) showingRangeText.textContent = `${startIdx + 1} - ${endIdx}`;

    // Detailed total count
    if (totalCountText) {
        if (searchTerm && filtered.length !== progressData.length) {
            totalCountText.innerHTML = `${filtered.length} <span class="text-[10px] text-gray-400 font-normal">(trong ${progressData.length})</span>`;
        } else {
            totalCountText.textContent = totalItems;
        }
    }

    if (currentRangeLabel) {
        currentRangeLabel.textContent = `📅 Bộ lọc: ${lastFetchedRange}`;
        currentRangeLabel.classList.remove('hidden');
    }

    // Render pagination buttons
    renderPaginationControls(totalPages);

    tableBody.innerHTML = paginatedItems.map(item => {
        let redoNoteHtml = '';
        if (item.remark2) {
            const match = item.remark2.match(/lần\s+thứ\s+(\d+)/i) || item.remark2.match(/lần\s+(\d+)/i);
            if (match) {
                const times = parseInt(match[1], 10);
                if (times > 1) {
                    redoNoteHtml = `<div class="text-[10px] text-red-500 font-extrabold mt-1 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 inline-block">Đơn làm lần ${times}</div>`;
                }
            } else if (item.remark2.toLowerCase().includes('làm lại') || item.remark2.toLowerCase().includes('làm lần')) {
                redoNoteHtml = `<div class="text-[10px] text-red-500 font-extrabold mt-1 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 inline-block">${item.remark2}</div>`;
            }
        }

        return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 group">
                <td onclick="window.openDetailModal('${item.key}')" 
                    class="p-4 border-r font-mono font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline bg-white group-hover:bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div class="flex flex-col items-start gap-0.5">
                        <div class="flex items-center">
                            <span>${item.rpro}</span>
                            <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                        </div>
                        ${redoNoteHtml}
                    </div>
                </td>
                <td class="p-3 border-r text-center font-bold text-gray-700 bg-gray-50 text-xs">
                    ${item.mold || '-'}
                </td>
                ${renderStageCell(item.stages['Dán'], item.key, 'Dán')}
                ${renderStageCell(item.stages['Cắt'], item.key, 'Cắt')}
                ${renderStageCell(item.stages['Molding'], item.key, 'Molding')}
                ${renderStageCell(item.stages['DC'], item.key, 'DC')}
                ${renderStageCell(item.stages['Molded'], item.key, 'Molded')}
                <td class="p-3 text-center text-gray-700 font-bold bg-gray-50 text-xs">
                    ${formatExcelDate(item.finish_date)}
                </td>
            </tr>
        `;
    }).join('');
}

function renderStageCell(stageData, key, section) {
    const hasNote = stageData.note;
    const noteIcon = hasNote
        ? `<div onclick="window.openNoteModal('${key}', '${section}')" class="absolute top-1 right-1 cursor-pointer text-base hover:scale-110 transition z-20" title="${hasNote}">📒</div>`
        : `<div onclick="window.openNoteModal('${key}', '${section}')" class="absolute top-1 right-1 cursor-pointer text-gray-400 hover:text-yellow-600 opacity-0 group-hover/cell:opacity-100 transition z-20">📝</div>`;

    if (!stageData.in && !stageData.out) {
        return `<td class="p-3 border-r text-center text-gray-300 bg-gray-50/30 relative group/cell">
            ${noteIcon}
            -
        </td>`;
    }

    let statusHtml = '';
    let bgClass = '';

    const formatFull = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const inTime = stageData.in ? formatFull(stageData.in.time) : '';
    const outTime = stageData.out ? formatFull(stageData.out.time) : '';
    const inQty = stageData.in ? stageData.in.qty : 0;
    const outQty = stageData.out ? stageData.out.qty : 0;
    const gap = inQty - outQty;

    const noteMarkup = hasNote
        ? `<div class="mt-1 p-1 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-800 font-medium italic break-words w-full">
            <span class="not-italic">📒</span> ${hasNote}
           </div>`
        : '';

    if (stageData.in && !stageData.out) {
        // IN Only
        const elapsedHours = (new Date() - new Date(stageData.in.time)) / (1000 * 60 * 60);
        const isWarning = elapsedHours > 12;
        bgClass = isWarning ? 'bg-red-50 animate-pulse border-red-200 border' : 'bg-yellow-50 border-yellow-200 border';

        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📥 Scan In:</div>
                <div class="text-blue-600 font-mono mb-1 whitespace-nowrap">${inTime}</div>
                <div class="text-gray-800 font-bold">SL: ${inQty}</div>
                ${noteMarkup}
                <span class="w-full text-center px-2 py-0.5 rounded text-[10px] font-black uppercase mt-1 ${isWarning ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}">
                    ${isWarning ? '⚠️ QUÁ HẠN >12H' : '⏳ ĐANG XỬ LÝ'}
                </span>
            </div>`;
    } else if (stageData.in && stageData.out) {
        // Completed
        bgClass = 'bg-white';
        const gapHtml = gap != 0
            ? `<div class="text-red-500 font-black mt-1 border border-red-200 px-1 bg-red-50 rounded">⚠️ Gap: ${gap}</div>`
            : `<div class="text-green-500 font-bold mt-1 text-[10px]">✅ Gap: 0</div>`;

        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📥 Scan In:</div>
                <div class="text-blue-600 font-mono whitespace-nowrap">${inTime}</div>
                <div class="text-gray-600 font-bold mb-1">SL: ${inQty}</div>
                <div class="w-full border-t border-gray-200 my-1"></div>
                <div class="font-semibold text-gray-700">📤 Scan Out:</div>
                <div class="text-green-600 font-mono whitespace-nowrap">${outTime}</div>
                <div class="text-gray-600 font-bold">SL: ${outQty}</div>
                ${noteMarkup}
                <div class="w-full text-center mt-1">${gapHtml}</div>
            </div>`;
    } else if (!stageData.in && stageData.out) {
        // Out Only
        bgClass = 'bg-gray-50';
        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📤 Scan Out Only:</div>
                <div class="text-red-500 font-mono whitespace-nowrap">${outTime}</div>
                <div class="text-gray-800 font-bold">SL: ${outQty}</div>
                ${noteMarkup}
            </div>`;
    }
    return `<td class="p-1 border-r align-top ${bgClass} relative group/cell">
        ${noteIcon}
        ${statusHtml}
        ${!stageData.in && !stageData.out && hasNote ? noteMarkup : ''}
    </td>`;
}

// ==================== PAGINATION CONTROLS ====================
function renderPaginationControls(totalPages) {
    if (!paginationControls) return;

    if (totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    // Previous Button
    buttonsHtml += `<button onclick="window.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="pagination-btn">Trước</button>`;

    // Page Numbers
    const delta = 2; // Number of pages to show around current page
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            buttonsHtml += `<button onclick="window.goToPage(${i})" class="pagination-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - delta - 1 || i === currentPage + delta + 1) {
            buttonsHtml += `<span class="px-1 text-gray-400">...</span>`;
        }
    }

    // Next Button
    buttonsHtml += `<button onclick="window.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="pagination-btn">Sau</button>`;

    paginationControls.innerHTML = buttonsHtml;
}

window.goToPage = (page) => {
    currentPage = page;
    renderTable();
    // Scroll to top of table
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.scrollTop = 0;
};

// ==================== NOTE LOGIC ====================
window.openNoteModal = (key, section) => {
    currentNoteTarget = { key, section };
    const rpro = key.substring(0, key.lastIndexOf('_'));
    noteTitle.textContent = `${rpro} - ${section}`;

    // Get existing note if any
    const existingNote = progressMap[key]?.stages[section]?.note || '';
    noteInput.value = existingNote;

    noteModal.classList.remove('hidden');
    noteInput.focus();
};

btnSaveNote.addEventListener('click', async () => {
    if (!currentNoteTarget) return;

    const noteContent = noteInput.value.trim();
    const { key, section } = currentNoteTarget;
    const rpro = key.substring(0, key.lastIndexOf('_'));

    btnSaveNote.disabled = true;
    btnSaveNote.textContent = '...';

    try {
        const { error } = await supabase
            .from('supplement_tracking')
            .insert([{
                rpro,
                section,
                action: 'NOTE',
                note: noteContent,
                operator: 'Admin'
            }]);

        if (error) throw error;

        // Local state will be updated by realtime subscription or manual refresh
        noteModal.classList.add('hidden');
    } catch (err) {
        alert('Lỗi lưu ghi chú: ' + err.message);
    } finally {
        btnSaveNote.disabled = false;
        btnSaveNote.textContent = 'Lưu';
    }
});

// ==================== EXPORT LOGIC (NO LIMIT) ====================
window.exportToExcel = async () => {
    const fromDateTime = dateStartInput.value;
    const toDateTime = dateEndInput.value;

    if (!fromDateTime || !toDateTime) {
        alert("Vui lòng chọn khoảng thời gian!");
        return;
    }

    const searchTerm = searchInput.value.trim().toUpperCase();
    const finishDateFilterVal = finishDateFilterInput ? finishDateFilterInput.value : '';

    // Step 1: UI Feedback
    btnExport.disabled = true;
    const originalText = btnExport.textContent;
    btnExport.textContent = '⌛ ...';

    try {
        showToast("⏳ Đang chuẩn bị dữ liệu xuất... (Vui lòng đợi)", "info");

        // Step 2: Fetch ALL tracking data for the range (Paginated)
        let allTracking = [];
        let page = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('supplement_tracking')
                .select('id, rpro, section, action, quantity, note, created_at')
                .gte('created_at', new Date(fromDateTime).toISOString())
                .lte('created_at', new Date(toDateTime).toISOString())
                .order('created_at', { ascending: true }) // Asc so updateLocalState works naturally
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allTracking = allTracking.concat(data);
                hasMore = data.length === PAGE_SIZE;
                page++;
            } else {
                hasMore = false;
            }
        }

        if (allTracking.length === 0) {
            alert('Không có dữ liệu trong khoảng thời gian này!');
            return;
        }

        // Step 3: Fetch confirmations in range
        const fromIso = new Date(fromDateTime).toISOString();
        const toIso = new Date(toDateTime).toISOString();

        const { data: confirmationsInRange, error: confirmError } = await supabase
            .from('supplement_confirm')
            .select('id, rpro, total, available_supplement, confirm, updated_at, remark2, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .limit(5000);

        if (confirmError) throw confirmError;

        // Extract all unique RPROs
        const rproSet = new Set();
        allTracking.forEach(r => rproSet.add(r.rpro));
        confirmationsInRange.forEach(c => rproSet.add(c.rpro));
        const rproList = Array.from(rproSet);

        // Fetch ALL confirmations for these RPROs
        let allConfirmations = [];
        if (rproList.length > 0) {
            for (let i = 0; i < rproList.length; i += 100) {
                const chunk = rproList.slice(i, i + 100);
                const { data: confirmBatch } = await supabase
                    .from('supplement_confirm')
                    .select('id, rpro, total, available_supplement, confirm, updated_at, remark2, created_at')
                    .in('rpro', chunk);
                if (confirmBatch) {
                    allConfirmations = allConfirmations.concat(confirmBatch);
                }
            }
        }

        // Aggregate into local map
        const exportMap = compileProgressData(allTracking, allConfirmations, fromDateTime, toDateTime);

        // Step 4: Metadata Enrichment
        await enrichProgressMapMetadata(exportMap, rproList);

        // Step 5: Filter (Apply UI filters to export too)
        let filtered = Object.values(exportMap).filter(item => {
            const codeMatch = item.rpro.includes(searchTerm);
            if (!finishDateFilterVal) return codeMatch;
            const itemDateStr = getComparableDateStr(item.finish_date);
            return codeMatch && itemDateStr === finishDateFilterVal;
        });

        if (filtered.length === 0) {
            alert('Không có dữ liệu phù hợp với bộ lọc hiện tại!');
            return;
        }

        // Step 6: Map to Excel Rows
        const stageNames = {
            'Dán': 'Dán',
            'Cắt': 'Cắt',
            'Molding': 'Molding',
            'DC': 'Leanline DC',
            'Molded': 'Leanline Molded'
        };

        const exportData = filtered.map(item => {
            const lastScan = item.last_scan;
            const stageId = lastScan ? `${stageNames[lastScan.section]} - ${lastScan.action}` : '-';

            // Trích xuất số lần làm từ ghi chú remark2
            let redoText = '';
            if (item.remark2) {
                const match = item.remark2.match(/lần\s+thứ\s+(\d+)/i) || item.remark2.match(/lần\s+(\d+)/i);
                if (match) {
                    const times = parseInt(match[1], 10);
                    if (times > 1) {
                        redoText = `Lần ${times}`;
                    }
                } else if (item.remark2.toLowerCase().includes('làm lại') || item.remark2.toLowerCase().includes('làm lần')) {
                    redoText = item.remark2;
                }
            }

            const row = {
                'SO': item.so || '',
                'Mã đơn (RPRO)': item.rpro,
                'Lần làm': redoText,
                'Brand': item.brand || '',
                'Customer': item.customer || '',
                '#MOLD': item.mold || '',
                'Total Qty': item.total_qty || '',
                'Qty_Sup': item.qty_sup || '',
                'Stage_ID': stageId,
                'Date Confirm Material (LPS)': item.confirm_date ? new Date(item.confirm_date).toLocaleDateString('vi-VN') : '',
            };

            let combinedNotes = [];
            ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'].forEach(stage => {
                const data = item.stages[stage];
                const displayName = stageNames[stage];
                row[`${displayName} - IN Time`] = data.in ? new Date(data.in.time).toLocaleString('vi-VN') : '';
                row[`${displayName} - OUT Time`] = data.out ? new Date(data.out.time).toLocaleString('vi-VN') : '';
                if (data.note && data.note.trim() !== '') {
                    combinedNotes.push(`${stage}: ${data.note.trim()}`);
                }
            });
            row['Note'] = combinedNotes.join('\n');
            row['Finish date'] = formatExcelDate(item.finish_date);
            return row;
        });

        // Step 7: Generate File
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tiến Độ Hàng Bù");

        const wscols = [
            { wch: 15 }, // SO
            { wch: 20 }, // Mã đơn (RPRO)
            { wch: 12 }, // Lần làm
            { wch: 15 }, // Brand
            { wch: 20 }, // Customer
            { wch: 15 }, // #MOLD
            { wch: 12 }, // Total Qty
            { wch: 12 }, // Qty_Sup
            { wch: 25 }, // Stage_ID
            { wch: 15 }  // Date Confirm Material (LPS)
        ];
        for (let i = 0; i < 5 * 2; i++) wscols.push({ wch: 18 });
        wscols.push({ wch: 40 }); // For Note
        wscols.push({ wch: 15 }); // For Finish date
        worksheet['!cols'] = wscols;

        const fileName = `Export_BùHàng_${fromDateTime.split('T')[0]}_den_${toDateTime.split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showToast("✅ Đã tải file thành công!", "success");

    } catch (err) {
        console.error("Export Error:", err);
        alert("Lỗi xuất Excel: " + err.message);
    } finally {
        btnExport.disabled = false;
        btnExport.textContent = originalText;
    }
};


// ==================== MODAL LOGIC (DELETE SUPPORT) ====================
window.openDetailModal = async (key) => {
    detailModal.classList.remove('hidden');
    const rpro = key.substring(0, key.lastIndexOf('_'));
    const confirmIdStr = key.substring(key.lastIndexOf('_') + 1);
    const confirmId = confirmIdStr === 'none' ? null : Number(confirmIdStr);

    modalContent.innerHTML = `<div class="text-center py-8"><div class="animate-spin text-4xl mb-2">⏳</div><p>Đang tải thông tin ${rpro}...</p></div>`;

    try {
        // 1. Get Powerapp Info
        const { data: infoList, error: infoError } = await supabase
            .from('powerapp')
            .select('"PRO ODER", "SO", "Brand Code", "CUSTOMERS", "#MOLDED", "#MOLD", "Total Qty"')
            .eq('"PRO ODER"', rpro)
            .limit(1);

        // 2. Get Realtime Scan History
        const { data: historyList, error: historyError } = await supabase
            .from('supplement_tracking')
            .select('id, action, section, created_at, quantity')
            .eq('rpro', rpro)
            .order('created_at', { ascending: false });

        // 3. Get all confirmations for this RPRO to match scans
        const { data: confirms } = await supabase
            .from('supplement_confirm')
            .select('id, created_at, remark2')
            .eq('rpro', rpro)
            .order('created_at', { ascending: true });

        if (infoError) console.error(infoError); // Log only, proceed with history

        const info = infoList && infoList.length > 0 ? infoList[0] : {};

        // Filter history to only scans belonging to this confirmId
        let filteredHistory = historyList || [];
        if (confirms && confirms.length > 0) {
            filteredHistory = (historyList || []).filter(scan => {
                const scanTime = new Date(scan.created_at);
                let bestConfirm = null;
                for (let i = 0; i < confirms.length; i++) {
                    if (new Date(confirms[i].created_at) <= scanTime) {
                        bestConfirm = confirms[i];
                    }
                }
                if (!bestConfirm) bestConfirm = confirms[0];
                return bestConfirm.id === confirmId;
            });
        }

        const matchedConfirm = confirms ? confirms.find(c => c.id === confirmId) : null;
        const redoLabel = matchedConfirm && matchedConfirm.remark2 ? ` (${matchedConfirm.remark2})` : '';

        let historyHtml = '<div class="text-center text-gray-400 py-4">Chưa có lịch sử quét cho lần làm này.</div>';
        if (filteredHistory && filteredHistory.length > 0) {
            historyHtml = `<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                ${filteredHistory.map(item => `
                    <div class="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-sm">
                        <div>
                            <span class="font-bold ${item.action === 'IN' ? 'text-blue-600' : 'text-green-600'}">${item.action}</span> - ${item.section}
                            <div class="text-xs text-gray-500">${new Date(item.created_at).toLocaleString('vi-VN')}</div>
                            <div class="text-xs font-bold text-gray-700">Qty: ${item.quantity || 0}</div>
                        </div>
                        <button onclick="deleteRecord('${item.id}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded" title="Xóa dòng này">
                            🗑️
                        </button>
                    </div>
                `).join('')}
            </div>`;
        }

        modalContent.innerHTML = `
            <!-- Tabs -->
            <div class="border-b mb-4 pb-2">
                <h3 class="font-bold text-gray-700">📦 Thông tin đơn hàng${redoLabel}</h3>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-sm mb-6">
                <div class="p-3 bg-gray-50 rounded-lg"><p class="text-xs text-gray-500">PRO ORDER</p><p class="font-bold text-blue-600">${rpro}</p></div>
                <div class="p-3 bg-gray-50 rounded-lg"><p class="text-xs text-gray-500">SO</p><p class="font-bold">${info['SO'] || '-'}</p></div>
                <div class="p-3 bg-gray-50 rounded-lg"><p class="text-xs text-gray-500">Brand</p><p class="font-bold">${info['Brand Code'] || '-'}</p></div>
                <div class="p-3 bg-gray-50 rounded-lg"><p class="text-xs text-gray-500">Total Qty</p><p class="font-bold text-green-600">${info['Total Qty'] || '-'}</p></div>
                <div class="p-3 bg-gray-50 rounded-lg col-span-2"><p class="text-xs text-gray-500">#MOLD</p><p class="font-bold break-words">${info['#MOLD'] || '-'}</p></div>
            </div>

            <div class="border-b mb-4 pb-2 flex justify-between items-center">
                <h3 class="font-bold text-gray-700">🕒 Lịch sử Scan (Có thể xóa)</h3>
            </div>
            ${historyHtml}
            
            <div class="mt-4 pt-4 border-t text-center">
                 <button onclick="document.getElementById('detail-modal').classList.add('hidden')" class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700">Đóng</button>
            </div>
        `;

    } catch (err) {
        modalContent.innerHTML = `<div class="text-red-500 text-center p-4">Lỗi: ${err.message}</div>`;
    }
};

window.deleteRecord = async (id) => {
    if (!confirm('⚠️ Liên quan đến dữ liệu sản xuất! Bạn có chắc muốn xóa dòng này không?')) return;

    const pass = prompt("🔒 Vui lòng nhập mật khẩu xác thực:");
    if (pass !== 'davidtu') {
        alert("⛔ Mật khẩu sai! Không được phép xóa.");
        return;
    }

    try {
        const { error } = await supabase.from('supplement_tracking').delete().eq('id', id);
        if (error) throw error;

        // Visual feedback inside modal handled by re-render or closing
        // But since realtime subscription is active, DELETE event will trigger refresh
        alert('✅ Đã xóa thành công!');
        detailModal.classList.add('hidden'); // Close modal to simplify sync
    } catch (err) {
        alert('❌ Xóa thất bại: ' + err.message);
    }
};

btnCloseModal.addEventListener('click', () => detailModal.classList.add('hidden'));

// ==================== REALTIME ====================
function setupRealtimeSubscription() {
    const channel = supabase
        .channel('supplement_tracking_monitor')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'supplement_tracking' },
            (payload) => {
                console.log('⚡ Event:', payload);
                fetchProgressData();
            }
        )
        .subscribe();
}
// ==================== DAILY SECTION LINE CHART (Independent) ====================
async function loadDailySectionChart() {
    const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
    const sectionDisplayNames = { 'Dán': 'Dán', 'Cắt': 'Cắt', 'Molding': 'Molding', 'DC': 'Leanline DC', 'Molded': 'Leanline Molded' };
    const sectionColors = {
        'Dán': { border: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        'Cắt': { border: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        'Molding': { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        'DC': { border: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
        'Molded': { border: '#ec4899', bg: 'rgba(236,72,153,0.1)' }
    };

    const fromInput = document.getElementById('chart-line-date-from');
    const toInput = document.getElementById('chart-line-date-to');

    // Set defaults: 1 month ago → today
    if (!fromInput.value) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        fromInput.value = oneMonthAgo.toISOString().split('T')[0];
    }
    if (!toInput.value) {
        toInput.value = new Date().toISOString().split('T')[0];
    }

    const fromDate = fromInput.value;
    const toDate = toInput.value;

    // Fetch ALL data via pagination (Supabase max 1000 rows per request)
    // Use Scan OUT for all sections (Dán, Cắt only have OUT)
    let allData = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: batch, error } = await supabase
            .from('supplement_tracking')
            .select('rpro, section, quantity, created_at, scan_date')
            .gte('created_at', `${fromDate}T00:00:00`)
            .lte('created_at', `${toDate}T23:59:59`)
            .eq('action', 'OUT')
            .order('created_at', { ascending: true })
            .range(from, to);

        if (error) {
            console.error('Error fetching line chart data:', error);
            return;
        }

        if (batch && batch.length > 0) {
            allData = allData.concat(batch);
            hasMore = batch.length === PAGE_SIZE;
            page++;
        } else {
            hasMore = false;
        }
    }

    const data = allData;

    // Build day labels and group by date + section
    const dayLabels = [];
    const dayMap = {};

    const start = new Date(fromDate);
    const end = new Date(toDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const label = `${day}-${month}`;
        if (!dayMap[label]) {
            dayLabels.push(label);
            dayMap[label] = {};
            sections.forEach(s => dayMap[label][s] = 0);
        }
    }

    // Deduplicate: for each day+section, only keep the LATEST scan OUT per RPRO
    // This prevents counting the same RPRO multiple times if scanned OUT repeatedly
    const dedup = {}; // key: "dateLabel|section|rpro" → { qty, time }

    (data || []).forEach(row => {
        // Use scan_date if available (YYYY-MM-DD), otherwise fallback to created_at
        let dateKey = row.scan_date;
        if (!dateKey) {
            dateKey = new Date(row.created_at).toISOString().split('T')[0];
        }

        // Format for display (DD-MM) - MUST match the loop above
        const dParts = dateKey.split('-'); // 2026-03-10 -> [2026, 03, 10]
        const label = `${dParts[2]}-${dParts[1]}`;

        if (!dayMap[label] || !sections.includes(row.section)) return;

        const key = `${label}|${row.section}|${row.rpro}`;
        const existing = dedup[key];

        const dTime = new Date(row.created_at);
        // Keep latest scan (highest created_at)
        if (!existing || dTime > existing.time) {
            dedup[key] = { qty: row.quantity || 0, time: dTime, label, section: row.section };
        }
    });

    // Sum quantities into dayMap (Back to summing PAIRS)
    Object.values(dedup).forEach(entry => {
        dayMap[entry.label][entry.section] += entry.qty;
    });

    // Destroy old chart
    if (monitorCharts.dailySectionQty) {
        monitorCharts.dailySectionQty.destroy();
    }

    // Build datasets
    const lineDatasets = sections.map(s => ({
        label: sectionDisplayNames[s],
        data: dayLabels.map(label => dayMap[label][s] || 0),
        borderColor: sectionColors[s].border,
        backgroundColor: sectionColors[s].bg,
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: sectionColors[s].border,
        borderWidth: 2.5
    }));

    monitorCharts.dailySectionQty = new Chart(document.getElementById('chart-daily-section-qty'), {
        type: 'line',
        data: {
            labels: dayLabels,
            datasets: lineDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { font: { weight: 'bold', size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return `${ctx.dataset.label}: ${ctx.raw.toLocaleString()} đôi`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Số đôi (Quantity)', font: { weight: 'bold' } }
                },
                x: {
                    title: { display: true, text: 'Ngày quét (Scan Date)', font: { weight: 'bold' } }
                }
            }
        }
    });
}

// Event: Refresh Line Chart Button
const btnRefreshLineChart = document.getElementById('btn-refresh-line-chart');
if (btnRefreshLineChart) {
    btnRefreshLineChart.addEventListener('click', () => {
        btnRefreshLineChart.textContent = '⏳ ...';
        loadDailySectionChart().finally(() => btnRefreshLineChart.textContent = '🔄 Xem');
    });
}

// ==================== STATS LOGIC ====================
function initStatsCharts(statsData) {
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    // Destroy existing charts
    Object.values(monitorCharts).forEach(c => {
        if (c && typeof c.destroy === 'function') c.destroy();
    });

    const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
    const sectionLabels = ['Dán', 'Cắt', 'Molding', 'Leanline DC', 'Leanline Molded'];

    // 0. Line Chart: loaded independently via loadDailySectionChart()
    loadDailySectionChart();

    // 1. Stacked Bar Chart: Completed vs Processing
    monitorCharts.statusStacked = new Chart(document.getElementById('chart-status-stacked'), {
        type: 'bar',
        data: {
            labels: sectionLabels,
            datasets: [
                {
                    label: '✅ Hoàn thành (Out)',
                    data: sections.map(s => statsData.sections[s].completed),
                    backgroundColor: '#22c55e', // Green-500
                    stack: 'Stack 0'
                },
                {
                    label: '⏳ Đang chạy (In Only)',
                    data: sections.map(s => statsData.sections[s].processing),
                    backgroundColor: '#f59e0b', // Amber-500
                    stack: 'Stack 0'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold' },
                    formatter: (val) => val > 0 ? val : ''
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });

    // 2. Pie Chart: Processing volume distribution
    monitorCharts.processingPie = new Chart(document.getElementById('chart-processing-pie'), {
        type: 'pie',
        data: {
            labels: sectionLabels,
            datasets: [{
                data: sections.map(s => statsData.sections[s].processing),
                backgroundColor: ['#6366f1', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = total > 0 ? ((value * 100) / total).toFixed(1) : 0;
                            return `${label}: ${value} đơn (${percent}%)`;
                        }
                    }
                }
            }
        }
    });

    // 3. Latency Analysis Chart (Bar)
    const latencyData = statsData.topLatencies.slice(0, 10);
    monitorCharts.gapMonitor = new Chart(document.getElementById('chart-gap-monitor'), {
        type: 'bar',
        data: {
            labels: latencyData.map(d => d.rpro),
            datasets: [{
                label: 'Thời gian chờ (Giờ)',
                data: latencyData.map(d => d.maxWait.toFixed(1)),
                backgroundColor: '#ef4444' // Red-500
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Top 10 đơn hàng chờ chuyển công đoạn lâu nhất' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Giờ' }
                }
            }
        }
    });

    // 5. Avg Transfer Speed Chart
    const avgLatencyLabels = ['Dán → Cắt', 'Cắt → Molding', 'Molding → DC', 'Molding → Molded'];
    const avgLatencyData = [
        statsData.latencies['Cắt'].count > 0 ? (statsData.latencies['Cắt'].total / statsData.latencies['Cắt'].count).toFixed(1) : 0,
        statsData.latencies['Molding'].count > 0 ? (statsData.latencies['Molding'].total / statsData.latencies['Molding'].count).toFixed(1) : 0,
        statsData.latencies['DC'].count > 0 ? (statsData.latencies['DC'].total / statsData.latencies['DC'].count).toFixed(1) : 0,
        statsData.latencies['Molded'].count > 0 ? (statsData.latencies['Molded'].total / statsData.latencies['Molded'].count).toFixed(1) : 0
    ];

    monitorCharts.avgTransfer = new Chart(document.getElementById('chart-avg-transfer'), {
        type: 'bar',
        data: {
            labels: avgLatencyLabels,
            datasets: [{
                label: 'Trung bình Giờ',
                data: avgLatencyData,
                backgroundColor: ['#6366f1', '#22c55e', '#a855f7', '#ec4899'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (v) => v > 0 ? v + 'h' : '',
                    font: { weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Số giờ trung bình' } }
            }
        }
    });
}

async function showStats() {
    statsModal.classList.remove('hidden');

    const sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'];
    const stats = {
        sections: {},
        topLatencies: [],
        brands: {}
    };

    sections.forEach(s => {
        stats.sections[s] = { processing: 0, completed: 0 };
    });

    const connections = {
        'Cắt': 'Dán',
        'Molding': 'Cắt',
        'DC': 'Molding',
        'Molded': 'Molding'
    };
    stats.latencies = {};
    Object.keys(connections).forEach(k => stats.latencies[k] = { total: 0, count: 0 });

    progressData.forEach(item => {
        // 1. Basic counts
        sections.forEach(s => {
            const stage = item.stages[s];
            if (stage.out) {
                stats.sections[s].completed++;
            } else if (stage.in) {
                stats.sections[s].processing++;
            }
        });

        // 2. Brand data
        const b = item.brand || 'N/A';
        stats.brands[b] = (stats.brands[b] || 0) + 1;

        // 3. Transfer Latency Calculation
        let orderMaxWait = 0;
        for (const [curr, prev] of Object.entries(connections)) {
            const prevStage = item.stages[prev];
            const currStage = item.stages[curr];

            if (prevStage && prevStage.out && currStage) {
                // FALLBACK: If current stage misses Scan IN, use Scan OUT instead (common in Dán/Cắt)
                const currTimeVal = currStage.in ? currStage.in.time : (currStage.out ? currStage.out.time : null);

                if (currTimeVal) {
                    const outTime = new Date(prevStage.out.time);
                    const inTime = new Date(currTimeVal);
                    const diffHours = (inTime - outTime) / (1000 * 60 * 60);

                    if (diffHours > 0) {
                        stats.latencies[curr].total += diffHours;
                        stats.latencies[curr].count++;
                        if (diffHours > orderMaxWait) orderMaxWait = diffHours;
                    }
                }
            }
        }

        if (orderMaxWait > 0) {
            stats.topLatencies.push({ rpro: item.rpro, maxWait: orderMaxWait });
        }
    });

    // Sort latencies descending
    stats.topLatencies.sort((a, b) => b.maxWait - a.maxWait);

    // Sort brands
    stats.topBrands = Object.entries(stats.brands)
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    initStatsCharts(stats);
}

// ==================== EVENTS ====================
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        btnRefresh.textContent = '⏳ ...';
        fetchProgressData().finally(() => btnRefresh.textContent = '🔄 Xem');
    });
}
if (searchInput) searchInput.addEventListener('input', renderTable);
if (btnExport) btnExport.addEventListener('click', window.exportToExcel);

if (btnShowStats) btnShowStats.addEventListener('click', showStats);
if (btnCloseStats) btnCloseStats.addEventListener('click', () => statsModal.classList.add('hidden'));

// Finish Date Filter Events
if (finishDateFilterInput) {
    // Force open picker on desktop click
    finishDateFilterInput.addEventListener('click', () => {
        if (typeof finishDateFilterInput.showPicker === 'function') {
            try {
                finishDateFilterInput.showPicker();
            } catch (e) {
                console.error("showPicker error:", e);
            }
        }
    });

    finishDateFilterInput.addEventListener('change', () => {
        renderTable();
    });
}

const thFinishDate = document.getElementById('th-finish-date');
if (thFinishDate && finishDateFilterInput) {
    thFinishDate.addEventListener('click', (e) => {
        if (e.target.closest('#btn-clear-date-filter')) return;
        if (typeof finishDateFilterInput.showPicker === 'function') {
            try { finishDateFilterInput.showPicker(); } catch (err) { }
        }
    });
}

if (finishDateBadgeContainer && finishDateFilterInput) {
    finishDateBadgeContainer.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-clear-date-filter')) {
            if (typeof finishDateFilterInput.showPicker === 'function') {
                try { finishDateFilterInput.showPicker(); } catch (err) { }
            }
        }
    });
}

if (btnClearDateFilter) {
    btnClearDateFilter.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent re-triggering the input
        finishDateFilterInput.value = '';
        renderTable();
    });
}

// ==================== UI HELPERS ====================
function showToast(msg, type = "success") {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
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

// Init
document.addEventListener('DOMContentLoaded', () => {
    initDates();
    fetchProgressData();
    setupRealtimeSubscription();
});
setInterval(renderTable, 60000); // UI update cycle
