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
let progressData = [];
let currentPage = 1;
const itemsPerPage = 100;

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

let lastFetchedRange = "";

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
async function fetchProgressData() {
    const fromDateTime = dateStartInput.value;
    const toDateTime = dateEndInput.value;

    if (!fromDateTime || !toDateTime) return;

    showLoading();

    try {
        updateLoading(10, 'Đang truy vấn lịch sử quét (Tracking)...');
        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('*')
            .gte('created_at', new Date(fromDateTime).toISOString())
            .lte('created_at', new Date(toDateTime).toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        updateLoading(35, 'Đang tổng hợp danh sách đơn hàng...');
        // Reset and rebuild
        progressMap = {};
        data.forEach(updateLocalState);

        // BULK FETCH FINISH DATES, MOLD AND CONFIRMATION
        const rproList = Object.keys(progressMap);
        if (rproList.length > 0) {
            updateLoading(50, `Đang tải chi tiết cho ${rproList.length} đơn hàng...`);
            // Fetch PowerApp Details
            const { data: orderDetails } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "Finish date", "SO", "Brand Code", "CUSTOMERS", "Total Qty", "#MOLD"')
                .in('"PRO ODER"', rproList);

            if (orderDetails) {
                orderDetails.forEach(item => {
                    const code = item['PRO ODER'];
                    if (progressMap[code]) {
                        progressMap[code].finish_date = item['Finish date'];
                        progressMap[code].so = item['SO'];
                        progressMap[code].brand = item['Brand Code'];
                        progressMap[code].customer = item['CUSTOMERS'];
                        progressMap[code].total_qty = item['Total Qty'];
                        progressMap[code].mold = item['#MOLD'];
                    }
                });
            }

            // Fallback for missing order details: Check Masterdata
            const missingInfoRpros = rproList.filter(rpro => !progressMap[rpro].so);
            if (missingInfoRpros.length > 0) {
                const { data: masterDetails } = await supabase
                    .from('Masterdata')
                    .select('"PRO ODER", "Finish date", "SO", "Brand Code", "CUSTOMERS", "Total Qty", "#MOLD"')
                    .in('"PRO ODER"', missingInfoRpros);

                if (masterDetails) {
                    masterDetails.forEach(item => {
                        const code = item['PRO ODER'];
                        if (progressMap[code]) {
                            progressMap[code].finish_date = item['Finish date'];
                            progressMap[code].so = item['SO'];
                            progressMap[code].brand = item['Brand Code'];
                            progressMap[code].customer = item['CUSTOMERS'];
                            progressMap[code].total_qty = item['Total Qty'];
                            progressMap[code].mold = item['#MOLD'];
                        }
                    });
                }
            }

            // Fetch Confirmation Details (Qty_Sup and Date make order)
            // Priority: available_supplement (if not null) -> total
            updateLoading(75, 'Đang tải thông tin xác nhận kho...');
            const { data: confirmDetails } = await supabase
                .from('supplement_confirm')
                .select('rpro, total, available_supplement, confirm, updated_at')
                .in('rpro', rproList);

            if (confirmDetails) {
                confirmDetails.forEach(item => {
                    const code = item.rpro;
                    if (progressMap[code]) {
                        // "Qty_Sup sẽ lấy mặc định bằng với cột Số đôi có thể bù... trong trường hợp không tìm thấy số thì lấy bằng với cột total"
                        progressMap[code].qty_sup = (item.available_supplement !== null) ? item.available_supplement : item.total;
                        progressMap[code].confirm_date = item.updated_at;
                        progressMap[code].confirm_status = item.confirm;
                    }
                });
            }

            // Fallback: For RPROs still without qty_sup, fetch from 'supplement' table
            const missingQtyRpros = rproList.filter(rpro => !progressMap[rpro].qty_sup);
            if (missingQtyRpros.length > 0) {
                const { data: supplementDetails } = await supabase
                    .from('supplement')
                    .select('rpro, total')
                    .in('rpro', missingQtyRpros);

                if (supplementDetails) {
                    supplementDetails.forEach(item => {
                        const code = item.rpro;
                        if (progressMap[code] && !progressMap[code].qty_sup) {
                            progressMap[code].qty_sup = item.total;
                        }
                    });
                }
            }
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

// ==================== UPDATE LOCAL STATE ====================
function updateLocalState(record) {
    const rpro = record.rpro;

    if (!progressMap[rpro]) {
        progressMap[rpro] = {
            rpro: rpro,
            last_updated: record.created_at,
            finish_date: null, // Init
            stages: {
                'Dán': { in: null, out: null, note: null },
                'Cắt': { in: null, out: null, note: null },
                'Molding': { in: null, out: null, note: null },
                'DC': { in: null, out: null, note: null },
                'Molded': { in: null, out: null, note: null }
            }
        };
    }

    const item = progressMap[rpro];
    const stage = item.stages[record.section];

    if (stage) {
        // Track last overall activity for Stage_ID (Exclude NOTE)
        if (record.action !== 'NOTE' && (!item.last_scan || new Date(record.created_at) > new Date(item.last_scan.time))) {
            item.last_scan = {
                section: record.section,
                action: record.action,
                time: record.created_at
            };
        }

        // Shared logic: Update note if present in record (latest record wins due to fetch order)
        if (record.action === 'NOTE') {
            stage.note = record.note; // Allows clearing note with empty string
            return;
        }

        if (record.note && record.note.trim() !== '') {
            stage.note = record.note;
        }

        const dataPoint = {
            time: record.created_at,
            qty: record.quantity || 0
        };

        // Logic pivot: Last IN/OUT win based on time inside fetch loop
        // If realtime update comes, it appends/overwrites correctly
        if (record.action === 'IN') {
            stage.in = dataPoint;
            if (new Date(record.created_at) > new Date(item.last_updated)) item.last_updated = record.created_at;
        } else if (record.action === 'OUT') {
            stage.out = dataPoint;
            if (new Date(record.created_at) > new Date(item.last_updated)) item.last_updated = record.created_at;
        }
    }
}

function refreshTableData() {
    progressData = Object.values(progressMap).sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
    renderTable();
}

// ==================== RENDER TABLE ====================
// ==================== RENDER TABLE ====================
function renderTable() {
    const searchTerm = searchInput.value.trim().toUpperCase();
    const filtered = progressData.filter(item => item.rpro.includes(searchTerm));

    // Helper to format Excel Serial Date or String Date
    const formatExcelDate = (serial) => {
        if (!serial) return '-';
        const num = Number(serial);
        // If numeric and looks like Excel Serial (e.g. 45000+)
        if (!isNaN(num) && num > 20000) {
            // 25569 is offset for 1970-01-01
            const date = new Date((num - 25569) * 86400 * 1000);
            // Handle timezone offset if needed, but UTC usually safer for pure dates. 
            // Simple approach:
            return date.toLocaleDateString('vi-VN'); // DD/MM/YYYY
        }
        // Fallback
        const d = new Date(serial);
        return isNaN(d.getTime()) ? serial : d.toLocaleDateString('vi-VN');
    };

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
        return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 group">
                <td onclick="window.openDetailModal('${item.rpro}')" 
                    class="p-4 border-r font-mono font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline bg-white group-hover:bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    ${item.rpro} <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                </td>
                <td class="p-3 border-r text-center font-bold text-gray-700 bg-gray-50 text-xs">
                    ${item.mold || '-'}
                </td>
                ${renderStageCell(item.stages['Dán'], item.rpro, 'Dán')}
                ${renderStageCell(item.stages['Cắt'], item.rpro, 'Cắt')}
                ${renderStageCell(item.stages['Molding'], item.rpro, 'Molding')}
                ${renderStageCell(item.stages['DC'], item.rpro, 'DC')}
                ${renderStageCell(item.stages['Molded'], item.rpro, 'Molded')}
                <td class="p-3 text-center text-gray-700 font-bold bg-gray-50 text-xs">
                    ${formatExcelDate(item.finish_date)}
                </td>
            </tr>
        `;
    }).join('');
}

function renderStageCell(stageData, rpro, section) {
    const hasNote = stageData.note;
    const noteIcon = hasNote
        ? `<div onclick="window.openNoteModal('${rpro}', '${section}')" class="absolute top-1 right-1 cursor-pointer text-base hover:scale-110 transition z-20" title="${hasNote}">📒</div>`
        : `<div onclick="window.openNoteModal('${rpro}', '${section}')" class="absolute top-1 right-1 cursor-pointer text-gray-400 hover:text-yellow-600 opacity-0 group-hover/cell:opacity-100 transition z-20">📝</div>`;

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
window.openNoteModal = (rpro, section) => {
    currentNoteTarget = { rpro, section };
    noteTitle.textContent = `${rpro} - ${section}`;

    // Get existing note if any
    const existingNote = progressMap[rpro]?.stages[section]?.note || '';
    noteInput.value = existingNote;

    noteModal.classList.remove('hidden');
    noteInput.focus();
};

btnSaveNote.addEventListener('click', async () => {
    if (!currentNoteTarget) return;

    const noteContent = noteInput.value.trim();
    const { rpro, section } = currentNoteTarget;

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

// ==================== EXPORT LOGIC ====================
window.exportToExcel = () => {
    const searchTerm = searchInput.value.trim().toUpperCase();
    const filtered = progressData.filter(item => item.rpro.includes(searchTerm));

    if (filtered.length === 0) {
        alert('Không có dữ liệu để xuất!');
        return;
    }

    const exportData = filtered.map(item => {
        // Stage mapping for display
        const stageNames = {
            'Dán': 'Dán',
            'Cắt': 'Cắt',
            'Molding': 'Molding',
            'DC': 'Leanline DC',
            'Molded': 'Leanline Molded'
        };

        const lastScan = item.last_scan;
        const stageId = lastScan ? `${stageNames[lastScan.section]} - ${lastScan.action}` : '-';

        const row = {
            'SO': item.so || '',
            'Mã đơn (RPRO)': item.rpro,
            'Brand': item.brand || '',
            'Customer': item.customer || '',
            '#MOLD': item.mold || '',
            'Total Qty': item.total_qty || '',
            'Qty_Sup': item.qty_sup || '',
            'Stage_ID': stageId,
            'Date make order': item.confirm_date ? new Date(item.confirm_date).toLocaleDateString('vi-VN') : '',
        };

        let combinedNotes = [];

        ['Dán', 'Cắt', 'Molding', 'DC', 'Molded'].forEach(stage => {
            const data = item.stages[stage];
            const displayName = stageNames[stage];
            row[`${displayName} - IN Time`] = data.in ? new Date(data.in.time).toLocaleString('vi-VN') : '';
            row[`${displayName} - OUT Time`] = data.out ? new Date(data.out.time).toLocaleString('vi-VN') : '';

            // Collect notes
            if (data.note && data.note.trim() !== '') {
                combinedNotes.push(`${stage}: ${data.note.trim()}`);
            }
        });

        // Add combined note column
        row['Note'] = combinedNotes.join('\n');

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tiến Độ Hàng Bù");

    // Fix column widths
    const wscols = [
        { wch: 15 }, // SO
        { wch: 20 }, // RPRO
        { wch: 15 }, // Brand
        { wch: 20 }, // Customer
        { wch: 15 }, // #MOLD
        { wch: 12 }, // Total Qty
        { wch: 12 }, // Qty_Sup
        { wch: 25 }, // Stage_ID
        { wch: 15 }, // Date make order
    ];
    // Add widths for stages (5 stages * 2 columns each: IN Time, OUT Time)
    for (let i = 0; i < 5 * 2; i++) wscols.push({ wch: 18 });
    // Add width for note
    wscols.push({ wch: 40 });
    // Enable multi-line in the note column
    // (Note: sheetjs basic object-to-sheet doesn't apply styling, 
    // but the \n will work in Excel if the user enables "Wrap Text")
    worksheet['!cols'] = wscols;

    const fileName = `TienDoHangBu_${dateStartInput.value}_to_${dateEndInput.value}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

// ==================== MODAL LOGIC (DELETE SUPPORT) ====================
window.openDetailModal = async (rpro) => {
    detailModal.classList.remove('hidden');
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
            .select('*')
            .eq('rpro', rpro)
            .order('created_at', { ascending: false });

        if (infoError) console.error(infoError); // Log only, proceed with history

        const info = infoList && infoList.length > 0 ? infoList[0] : {};

        let historyHtml = '<div class="text-center text-gray-400 py-4">Chưa có lịch sử quét.</div>';
        if (historyList && historyList.length > 0) {
            historyHtml = `<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                ${historyList.map(item => `
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
                <h3 class="font-bold text-gray-700">📦 Thông tin đơn hàng</h3>
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
            { event: '*', schema: 'public', table: 'supplement_tracking' }, // Listen to ALL events (INSERT, DELETE, UPDATE)
            (payload) => {
                console.log('⚡ Event:', payload);
                if (payload.eventType === 'INSERT') {
                    updateLocalState(payload.new);
                    refreshTableData();
                } else {
                    // Start date might affect which records are shown, simpler to refetch on Delete/Update
                    // to ensure consistency (removing deleted items from memory map is complex without full re-fetch)
                    fetchProgressData();
                }
            }
        )
        .subscribe();
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

    // 4. Brand breakdown
    const brandLabels = statsData.topBrands.map(b => b.brand || 'N/A');
    monitorCharts.brandPie = new Chart(document.getElementById('chart-brand-pie'), {
        type: 'doughnut',
        data: {
            labels: brandLabels,
            datasets: [{
                data: statsData.topBrands.map(b => b.count),
                backgroundColor: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#818cf8']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
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
        let maxWait = 0;
        for (let i = 0; i < sections.length - 1; i++) {
            const currentStage = item.stages[sections[i]];
            const nextStage = item.stages[sections[i + 1]];

            if (currentStage.out && nextStage.in) {
                const outTime = new Date(currentStage.out.time);
                const inTime = new Date(nextStage.in.time);
                const diffHours = (inTime - outTime) / (1000 * 60 * 60);

                if (diffHours > maxWait) maxWait = diffHours;
            }
        }

        if (maxWait > 0) {
            stats.topLatencies.push({ rpro: item.rpro, maxWait: maxWait });
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

// Init
document.addEventListener('DOMContentLoaded', () => {
    initDates();
    fetchProgressData();
    setupRealtimeSubscription();
});
setInterval(renderTable, 60000); // UI update cycle
