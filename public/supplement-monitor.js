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
// ==================== RENDER CELL HELPER ====================
function renderStageCell(stageData) {
    // If no data at all
    if (!stageData.in && !stageData.out) {
        return `<td class="p-3 border-r text-center text-gray-300 bg-gray-50/30">-</td>`;
    }

    let statusHtml = '';
    let bgClass = '';

    // Helper format function for full datetime
    const formatFull = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const timeIn = formatFull(stageData.in);
    const timeOut = formatFull(stageData.out);

    if (stageData.in && !stageData.out) {
        // Currently IN => Active/Warning
        const elapsedHours = (new Date() - new Date(stageData.in)) / (1000 * 60 * 60);
        const isWarning = elapsedHours > 4;

        bgClass = isWarning ? 'bg-red-50 animate-pulse border-red-200 border' : 'bg-yellow-50 border-yellow-200 border';

        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📥 Scan In:</div>
                <div class="text-blue-600 font-mono mb-1 whitespace-nowrap">${timeIn}</div>
                
                <span class="w-full text-center px-2 py-0.5 rounded text-[10px] font-black uppercase mt-1 ${isWarning ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}">
                    ${isWarning ? '⚠️ QUÁ HẠN >4H' : '⏳ ĐANG XỬ LÝ'}
                </span>
            </div>
        `;
    } else if (stageData.in && stageData.out) {
        // Completed
        bgClass = 'bg-white';
        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📥 Scan In:</div>
                <div class="text-blue-600 font-mono mb-1 whitespace-nowrap">${timeIn}</div>
                
                <div class="w-full border-t border-gray-200 my-1"></div>
                
                <div class="font-semibold text-gray-700">📤 Scan Out:</div>
                <div class="text-green-600 font-mono whitespace-nowrap">${timeOut}</div>
                
                <div class="w-full text-center mt-1">
                     <span class="text-[9px] text-green-600 font-bold uppercase border border-green-200 px-1 rounded block">✅ HOÀN THÀNH</span>
                </div>
            </div>
        `;
    } else if (!stageData.in && stageData.out) {
        // Edge case: Only OUT
        bgClass = 'bg-gray-50';
        statusHtml = `
            <div class="flex flex-col gap-1 items-start text-xs p-2">
                <div class="font-semibold text-gray-700">📤 Scan Out Only:</div>
                <div class="text-red-500 font-mono whitespace-nowrap">${timeOut}</div>
            </div>
        `;
    }

    return `<td class="p-1 border-r align-top ${bgClass}">${statusHtml}</td>`;
}

function formatTime(isoString) {
    // Deprecated but kept for compatibility reference if needed elsewhere
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
