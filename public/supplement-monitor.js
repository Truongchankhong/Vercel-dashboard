import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const tableBody = document.getElementById('progress-table-body');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const searchInput = document.getElementById('search-input');

// ==================== STATE ====================
let progressData = [];
let realtimeChannel = null;

// ==================== FETCH DATA ====================
async function fetchProgressData() {
    try {
        // Fetch raw tracking data
        // Ideally we would query the VIEW, but Supabase Realtime works best with Tables.
        // So we will fetch raw table data and pivot it client-side for realtime updates.

        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('*')
            //.eq('scan_date', new Date().toISOString().split('T')[0]) // Optional: Filter by today?
            .order('created_at', { ascending: true }); // Process chronological order

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
            if (record.action === 'IN') {
                // Keep the LATEST IN if multiple (or FIRST? usually workflow is linear)
                // Let's use latest for now
                stage.in = record.created_at;
            } else if (record.action === 'OUT') {
                stage.out = record.created_at;
            }
            map[rpro].last_updated = record.created_at;
        }
    });

    // Convert to array and sort by last update desc
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
                <!-- RPRO Column -->
                <td class="p-4 border-r font-mono font-bold text-gray-800 bg-white group-hover:bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    ${item.rpro}
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
    // If no data at all
    if (!stageData.in && !stageData.out) {
        return `<td class="p-3 border-r text-center text-gray-300">-</td>`;
    }

    let statusHtml = '';
    let bgClass = '';

    const timeIn = stageData.in ? formatTime(stageData.in) : null;
    const timeOut = stageData.out ? formatTime(stageData.out) : null;

    if (stageData.in && !stageData.out) {
        // Currently IN => Active/Warning
        const elapsedHours = (new Date() - new Date(stageData.in)) / (1000 * 60 * 60);
        const isWarning = elapsedHours > 4;

        bgClass = isWarning ? 'bg-red-50 animate-pulse border-red-200 border' : 'bg-yellow-50 border-yellow-200 border';

        statusHtml = `
            <div class="flex flex-col gap-1 items-center">
                <div class="text-xs font-bold text-gray-500">📥 ${timeIn}</div>
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${isWarning ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}">
                    ${isWarning ? 'QUÁ HẠN >4H' : 'ĐANG XỬ LÝ'}
                </span>
            </div>
        `;
    } else if (stageData.in && stageData.out) {
        // Completed
        bgClass = 'bg-white';
        statusHtml = `
            <div class="flex flex-col gap-1 items-center">
                <div class="text-xs text-gray-500">📥 ${timeIn}</div>
                <div class="text-xs font-bold text-green-600">📤 ${timeOut}</div>
                <div class="h-0.5 w-8 bg-gray-200 my-0.5"></div>
                <span class="text-[9px] text-green-600 font-bold uppercase">HOÀN THÀNH</span>
            </div>
        `;
    } else if (!stageData.in && stageData.out) {
        // Edge case: OUT without IN (should not happen with validation but possible with manual DB edits)
        bgClass = 'bg-gray-50';
        statusHtml = `
            <div class="text-xs text-red-500">❓ Chỉ có OUT: ${timeOut}</div>
        `;
    }

    return `<td class="p-2 border-r text-center align-middle ${bgClass}">${statusHtml}</td>`;
}

function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    // return `${d.getHours()}:${d.getMinutes()}`;
}

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
                fetchProgressData(); // Reload full data to re-pivot
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

// Auto-refresh every minute to update "warning" status times
setInterval(renderTable, 60000);

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    fetchProgressData();
    setupRealtimeSubscription();
});
