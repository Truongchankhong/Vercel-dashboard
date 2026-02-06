import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const tableBody = document.getElementById('progress-table-body');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const searchInput = document.getElementById('search-input');

// Modal Elements
const detailModal = document.getElementById('detail-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalContent = document.getElementById('modal-content');

// ==================== STATE ====================
let progressData = [];
let realtimeChannel = null;

// ==================== FETCH DATA ====================
async function fetchProgressData() {
    try {
        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        processData(data);
        renderTable();

    } catch (err) {
        console.error("Error fetching data:", err);
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-600">❌ Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// ==================== PROCESS DATA (CLIENT-SIDE PIVOT) ====================
function processData(rawData) {
    const map = {};

    rawData.forEach(record => {
        const rpro = record.rpro;
        if (!map[rpro]) {
            map[rpro] = {
                rpro: rpro,
                last_updated: record.created_at,
                stages: {
                    'Dán': { in: null, out: null },
                    'Cắt': { in: null, out: null },
                    'Molding': { in: null, out: null },
                    'DC': { in: null, out: null },
                    'Molded': { in: null, out: null }
                }
            };
        }

        const stage = map[rpro].stages[record.section];
        if (stage) {
            const dataPoint = {
                time: record.created_at,
                qty: record.quantity || 0 // Get quantity
            };

            if (record.action === 'IN') {
                stage.in = dataPoint;
            } else if (record.action === 'OUT') {
                stage.out = dataPoint;
            }
            map[rpro].last_updated = record.created_at;
        }
    });

    // Sort by last update desc
    progressData = Object.values(map).sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
}

// ==================== RENDER TABLE ====================
function renderTable() {
    const searchTerm = searchInput.value.trim().toUpperCase();
    const filtered = progressData.filter(item => item.rpro.includes(searchTerm));

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tableBody.innerHTML = filtered.map(item => {
        return `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 group">
                <!-- RPRO Column (Clickable) -->
                <td onclick="window.openDetailModal('${item.rpro}')" 
                    class="p-4 border-r font-mono font-bold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline bg-white group-hover:bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    ${item.rpro} <span class="text-xs text-gray-400 ml-1">ℹ️</span>
                </td>

                <!-- Stages Columns -->
                ${renderStageCell(item.stages['Dán'])}
                ${renderStageCell(item.stages['Cắt'])}
                ${renderStageCell(item.stages['Molding'])}
                ${renderStageCell(item.stages['DC'])}
                ${renderStageCell(item.stages['Molded'])}
            </tr>
        `;
    }).join('');
}

// ==================== RENDER CELL HELPER ====================
function renderStageCell(stageData) {
    if (!stageData.in && !stageData.out) {
        return `<td class="p-3 border-r text-center text-gray-300 bg-gray-50/30">-</td>`;
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

    if (stageData.in && !stageData.out) {
        // IN ONLY
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
            </div>
        `;
    } else if (stageData.in && stageData.out) {
        // COMPLETED
        bgClass = 'bg-white';
        // Check Gap
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
                
                <div class="w-full text-center mt-1">
                     ${gapHtml}
                </div>
            </div>
        `;
    } else if (!stageData.in && stageData.out) {
        // OUT ONLY
        bgClass = 'bg-gray-50';
        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📤 Scan Out Only:</div>
                <div class="text-red-500 font-mono whitespace-nowrap">${outTime}</div>
                <div class="text-gray-800 font-bold">SL: ${outQty}</div>
            </div>
        `;
    }

    return `<td class="p-1 border-r align-top ${bgClass}">${statusHtml}</td>`;
}

// ==================== MODAL LOGIC ====================
window.openDetailModal = async (rpro) => {
    detailModal.classList.remove('hidden');
    modalContent.innerHTML = `<div class="text-center py-8"><div class="animate-spin text-4xl mb-2">⏳</div><p>Đang tải thông tin ${rpro}...</p></div>`;

    try {
        // Query 'powerapp' table where "PRO ODER" column matches rpro
        const { data, error } = await supabase
            .from('powerapp')
            .select('"PRO ODER", "SO", "Brand Code", "CUSTOMERS", "#MOLDED", "#MOLD", "Total Qty"')
            .eq('"PRO ODER"', rpro)
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            modalContent.innerHTML = `
                <div class="text-center py-6 text-gray-500">
                    <p class="text-4xl mb-2">❌</p>
                    <p>Không tìm thấy thông tin chi tiết cho mã này trong Powerapp.</p>
                </div>`;
            return;
        }

        const info = data[0];

        modalContent.innerHTML = `
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">PRO ORDER</p>
                    <p class="font-mono font-bold text-lg text-blue-600">${info['PRO ODER'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">SO</p>
                    <p class="font-bold text-gray-800">${info['SO'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">Brand</p>
                    <p class="font-bold text-gray-800">${info['Brand Code'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">Customer</p>
                    <p class="font-bold text-gray-800">${info['CUSTOMERS'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">Total Qty</p>
                    <p class="font-bold text-lg text-green-600">${info['Total Qty'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-500 text-xs uppercase font-bold">#MOLDED</p>
                    <p class="font-bold text-gray-800">${info['#MOLDED'] || '-'}</p>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg col-span-2">
                    <p class="text-gray-500 text-xs uppercase font-bold">#MOLD</p>
                    <p class="font-bold text-gray-800 break-words">${info['#MOLD'] || '-'}</p>
                </div>
            </div>
            
            <div class="mt-4 pt-4 border-t text-center">
                 <button onclick="document.getElementById('detail-modal').classList.add('hidden')" 
                    class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700">Đóng</button>
            </div>
        `;

    } catch (err) {
        console.error(err);
        modalContent.innerHTML = `<div class="text-red-500 text-center p-4">Lỗi: ${err.message}</div>`;
    }
};

btnCloseModal.addEventListener('click', () => {
    detailModal.classList.add('hidden');
});

// ==================== REALTIME SUBSCRIPTION ====================
function setupRealtimeSubscription() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);

    realtimeChannel = supabase
        .channel('supplement_tracking_monitor')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'supplement_tracking' },
            (payload) => {
                console.log('Update received:', payload);
                fetchProgressData();
            }
        )
        .subscribe();
}

// ==================== EVENT LISTENERS ====================
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        btnRefresh.textContent = '⏳ ...';
        fetchProgressData().finally(() => btnRefresh.textContent = '🔄 Làm mới');
    });
}

if (searchInput) {
    searchInput.addEventListener('input', renderTable);
}

// Auto-refresh every minute
setInterval(renderTable, 60000);

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    fetchProgressData();
    setupRealtimeSubscription();
});
