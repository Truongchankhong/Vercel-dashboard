import { supabase } from './supabaseClient.js';

// ==================== DOM ELEMENTS ====================
const ordersContainer = document.getElementById('orders-container');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const filterBtns = document.querySelectorAll('.filter-btn');

const statActive = document.getElementById('stat-active');
const statWarning = document.getElementById('stat-warning');
const statToday = document.getElementById('stat-today');
const statTotal = document.getElementById('stat-total');

// ==================== STATE ====================
let currentFilter = 'all';
let ordersData = [];
let realtimeChannel = null;

// ==================== FETCH ACTIVE ORDERS ====================
async function fetchActiveOrders() {
    try {
        // Get all records where latest action is 'IN'
        const { data, error } = await supabase
            .from('supplement_tracking')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Process data to find latest action per RPRO + Section
        const latestByRproSection = {};

        data.forEach(record => {
            const key = `${record.rpro}_${record.section}`;
            if (!latestByRproSection[key]) {
                latestByRproSection[key] = record;
            }
        });

        // Filter only IN records
        ordersData = Object.values(latestByRproSection).filter(r => r.action === 'IN');

        renderOrders();
        updateStats(data);

    } catch (err) {
        console.error("Error fetching orders:", err);
        ordersContainer.innerHTML = `<div class="col-span-full text-center text-red-600 p-8">❌ Lỗi tải dữ liệu: ${err.message}</div>`;
    }
}

// ==================== RENDER ORDERS ====================
function renderOrders() {
    // Apply filter
    let filtered = ordersData;
    if (currentFilter !== 'all') {
        filtered = ordersData.filter(o => o.section === currentFilter);
    }

    // Show empty state if no orders
    if (filtered.length === 0) {
        ordersContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    ordersContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Sort by time (oldest first for priority)
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Render cards
    ordersContainer.innerHTML = filtered.map(order => createOrderCard(order)).join('');
}

// ==================== CREATE ORDER CARD ====================
function createOrderCard(order) {
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const elapsedMs = now - createdAt;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const elapsedMinutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
    const elapsedHoursFloor = Math.floor(elapsedHours);

    const isWarning = elapsedHours > 4;
    const warningClass = isWarning ? 'border-red-500 border-2 alert-blink' : 'border-gray-200';
    const bgClass = isWarning ? 'bg-red-50' : 'bg-white';

    // Section color mapping
    const sectionColors = {
        'Dán': 'bg-indigo-100 text-indigo-800',
        'Cắt': 'bg-green-100 text-green-800',
        'Molding': 'bg-blue-100 text-blue-800',
        'DC': 'bg-purple-100 text-purple-800',
        'Molded': 'bg-pink-100 text-pink-800'
    };

    const sectionBadge = sectionColors[order.section] || 'bg-gray-100 text-gray-800';

    return `
        <div class="status-card ${bgClass} ${warningClass} rounded-xl shadow-md p-5 border">
            <!-- Header -->
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-black text-gray-800">${order.rpro}</h3>
                <span class="badge ${sectionBadge}">${order.section}</span>
            </div>

            <!-- Status -->
            <div class="flex items-center gap-2 mb-3">
                <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span class="text-sm font-bold text-green-700">ĐANG NHẬP (IN)</span>
            </div>

            <!-- Time Elapsed -->
            <div class="bg-gray-100 rounded-lg p-3 mb-3">
                <p class="text-xs text-gray-600 font-semibold mb-1">Thời gian từ khi nhập:</p>
                <p class="text-2xl font-black ${isWarning ? 'text-red-600' : 'text-gray-800'}">
                    ${elapsedHoursFloor}h ${elapsedMinutes}m
                </p>
                ${isWarning ? '<p class="text-xs text-red-600 font-bold mt-1">⚠️ QUÁ 4 TIẾNG!</p>' : ''}
            </div>

            <!-- Metadata -->
            <div class="text-xs text-gray-500 space-y-1">
                <p>👤 Người thực hiện: <b>${order.operator || 'N/A'}</b></p>
                <p>📅 Thời gian nhập: <b>${formatDateTime(createdAt)}</b></p>
            </div>
        </div>
    `;
}

// ==================== UPDATE STATS ====================
function updateStats(allData) {
    // Active orders (currently IN)
    const activeCount = ordersData.length;
    statActive.textContent = activeCount;

    // Warning count (IN > 4 hours)
    const warningCount = ordersData.filter(o => {
        const elapsed = (new Date() - new Date(o.created_at)) / (1000 * 60 * 60);
        return elapsed > 4;
    }).length;
    statWarning.textContent = warningCount;

    // Today's records
    const today = new Date().toISOString().split('T')[0];
    const todayCount = allData.filter(r => r.scan_date === today).length;
    statToday.textContent = todayCount;

    // Total records
    statTotal.textContent = allData.length;
}

// ==================== HELPERS ====================
function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== REALTIME SUBSCRIPTION ====================
function setupRealtimeSubscription() {
    // Unsubscribe existing channel if any
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    // Create new channel
    realtimeChannel = supabase
        .channel('supplement_tracking_changes')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'supplement_tracking'
            },
            (payload) => {
                console.log('🔔 Realtime update:', payload);
                // Refresh data on any change
                fetchActiveOrders();
            }
        )
        .subscribe((status) => {
            console.log('📡 Realtime status:', status);
        });

    console.log('✅ Realtime subscription active');
}

// ==================== FILTER LOGIC ====================
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active', 'bg-gray-300'));
        btn.classList.add('active', 'bg-gray-300');

        currentFilter = btn.dataset.filter;
        renderOrders();
    });
});

// ==================== REFRESH BUTTON ====================
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        btnRefresh.disabled = true;
        btnRefresh.textContent = '⏳ Đang tải...';

        fetchActiveOrders().finally(() => {
            btnRefresh.disabled = false;
            btnRefresh.textContent = '🔄 Làm mới';
        });
    });
}

// ==================== AUTO REFRESH (Every minute to update elapsed time) ====================
setInterval(() => {
    if (ordersData.length > 0) {
        renderOrders(); // Re-render to update elapsed times
    }
}, 60000); // 60 seconds

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Supplement Monitor Loaded');

    // Initial data fetch
    await fetchActiveOrders();

    // Setup realtime
    setupRealtimeSubscription();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
});

console.log('✅ Supplement Monitor Script Loaded');
