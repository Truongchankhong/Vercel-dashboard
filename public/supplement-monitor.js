import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const tableBody = document.getElementById('progress-table-body');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const searchInput = document.getElementById('search-input');
const dateStartInput = document.getElementById('date-start');
const dateEndInput = document.getElementById('date-end');

// Modal Elements
const detailModal = document.getElementById('detail-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalContent = document.getElementById('modal-content');

// ==================== STATE ====================
let progressMap = {};
let progressData = [];

// ==================== INIT DATES ====================
function initDates() {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    dateEndInput.value = today.toISOString().split('T')[0];
    dateStartInput.value = lastWeek.toISOString().split('T')[0];
}

// ==================== FETCH DATA ====================
async function fetchProgressData() {
    const fromDate = dateStartInput.value;
    const toDate = dateEndInput.value;

    if (!fromDate || !toDate) return;

    // Adjust toDate to end of day
    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);

    try {
        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('*')
            .gte('created_at', new Date(fromDate).toISOString())
            .lte('created_at', toDateObj.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Reset and rebuild
        // Reset and rebuild
        progressMap = {};
        data.forEach(updateLocalState);

        // BULK FETCH FINISH DATES
        const rproList = Object.keys(progressMap);
        if (rproList.length > 0) {
            const { data: finishData } = await supabase
                .from('powerapp')
                .select('"PRO ODER", "Finish date"')
                .in('"PRO ODER"', rproList);

            if (finishData) {
                finishData.forEach(item => {
                    const code = item['PRO ODER'];
                    // Clean code just in case
                    if (progressMap[code]) {
                        progressMap[code].finish_date = item['Finish date'];
                    }
                });
            }
        }

        refreshTableData();

    } catch (err) {
        console.error("Error fetching data:", err);
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
                'Dán': { in: null, out: null },
                'Cắt': { in: null, out: null },
                'Molding': { in: null, out: null },
                'DC': { in: null, out: null },
                'Molded': { in: null, out: null }
            }
        };
    }

    const item = progressMap[rpro];
    const stage = item.stages[record.section];

    if (stage) {
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
        return;
    }

    emptyState.classList.add('hidden');

    tableBody.innerHTML = filtered.map(item => {
        return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 group">
                <td onclick="window.openDetailModal('${item.rpro}')" 
                    class="p-4 border-r font-mono font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline bg-white group-hover:bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    ${item.rpro} <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                </td>
                ${renderStageCell(item.stages['Dán'])}
                ${renderStageCell(item.stages['Cắt'])}
                ${renderStageCell(item.stages['Molding'])}
                ${renderStageCell(item.stages['DC'])}
                ${renderStageCell(item.stages['Molded'])}
                <td class="p-3 text-center text-gray-700 font-bold bg-gray-50 text-xs">
                    ${formatExcelDate(item.finish_date)}
                </td>
            </tr>
        `;
    }).join('');
}

function renderStageCell(stageData) {
    if (!stageData.in && !stageData.out) return `<td class="p-3 border-r text-center text-gray-300 bg-gray-50/30">-</td>`;

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

    if (stageData.in && !stageData.out) {
        // IN Only
        const elapsedHours = (new Date() - new Date(stageData.in.time)) / (1000 * 60 * 60);
        const isWarning = elapsedHours > 4;
        bgClass = isWarning ? 'bg-red-50 animate-pulse border-red-200 border' : 'bg-yellow-50 border-yellow-200 border';

        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📥 Scan In:</div>
                <div class="text-blue-600 font-mono mb-1 whitespace-nowrap">${inTime}</div>
                <div class="text-gray-800 font-bold">SL: ${inQty}</div>
                <span class="w-full text-center px-2 py-0.5 rounded text-[10px] font-black uppercase mt-1 ${isWarning ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}">
                    ${isWarning ? '⚠️ QUÁ HẠN >4H' : '⏳ ĐANG XỬ LÝ'}
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
            </div>`;
    }
    return `<td class="p-1 border-r align-top ${bgClass}">${statusHtml}</td>`;
}

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

// ==================== EVENTS ====================
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        btnRefresh.textContent = '⏳ ...';
        fetchProgressData().finally(() => btnRefresh.textContent = '🔄 Xem');
    });
}
if (searchInput) searchInput.addEventListener('input', renderTable);

// Init
document.addEventListener('DOMContentLoaded', () => {
    initDates();
    fetchProgressData();
    setupRealtimeSubscription();
});
setInterval(renderTable, 60000); // UI update cycle
