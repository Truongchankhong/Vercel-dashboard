import { supabase } from './supabaseClient.js';

let dayChart = null;
let brandChart = null;
let sectionChart = null;
let currentSection = 'ALL';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupFilters();
    refreshStats();
}

function setupFilters() {
    const btns = document.querySelectorAll('.section-filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentSection = btn.dataset.section;

            // UI Update
            btns.forEach(b => {
                if (b.dataset.section === currentSection) {
                    b.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-lg');
                    b.classList.remove('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
                } else {
                    b.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-lg');
                    b.classList.add('border-slate-100', 'text-slate-600', 'hover:bg-slate-50');
                }
            });

            refreshStats();
        });
    });
}

async function refreshStats() {
    const data = await fetchFilteredSurplusData();
    if (data && data.length > 0) {
        processAndRender(data);
    } else {
        clearStats();
    }
}

async function fetchFilteredSurplusData() {
    // OPTIMIZED: Select only needed columns to minimize Egress usage
    const sizeFields = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]
        .map(s => `"size_${s.toString().replace('.', '_')}"`);
    const selectCols = ['rpro', 'bom', 'mold', 'brand_code', 'created_at', 'dynamic_sizes', ...sizeFields].join(',');

    let query = supabase.from('surplusgoods').select(selectCols).order('created_at', { ascending: true });

    if (currentSection !== 'ALL') {
        query = query.eq('section', currentSection);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching stats data:", error);
        return [];
    }
    return data;
}

function clearStats() {
    document.getElementById('stat-total-qty').textContent = "0";
    document.getElementById('stat-total-orders').textContent = "0";
    document.getElementById('stat-top-brand').textContent = "-";
    if (dayChart) dayChart.destroy();
    if (brandChart) brandChart.destroy();
    if (sectionChart) sectionChart.destroy();
    document.getElementById('top-orders-table').innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">Không có dữ liệu cho mục này</td></tr>`;
}

function processAndRender(data) {
    const dailyIncrease = {};
    const statsByBrand = {};
    const topOrders = [];

    let totalQty = 0;
    const statsBySection = {};

    data.forEach(item => {
        // Calculate Total Qty for this item
        let itemTotal = 0;
        Object.keys(item).forEach(k => {
            if (k.startsWith('size_') && !isNaN(item[k])) {
                itemTotal += parseFloat(item[k]) || 0;
            }
        });
        const dyn = item.dynamic_sizes || {};
        // For LEANLINE_DC: only count the remaining stock, not sum all dynamic_sizes
        if (item.section === 'LEANLINE_DC') {
            itemTotal = parseFloat(dyn['DC_Số_tấm_còn_lại'] ?? 0) || 0;
        } else {
            Object.values(dyn).forEach(v => {
                if (!isNaN(v)) itemTotal += parseFloat(v) || 0;
            });
        }

        totalQty += itemTotal;

        // Group by Section
        const sec = item.section || 'Unknown';
        statsBySection[sec] = (statsBySection[sec] || 0) + itemTotal;

        // Group by Day (Lưu lượng tăng từng ngày)
        const dateObj = new Date(item.created_at);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`; // Định dạng YYYY-MM-DD để dễ sort

        dailyIncrease[dateStr] = (dailyIncrease[dateStr] || 0) + itemTotal;

        // Group by Brand
        const brand = item.brand_code || 'N/A';
        statsByBrand[brand] = (statsByBrand[brand] || 0) + itemTotal;

        // Collect for Top 10
        topOrders.push({
            rpro: item.rpro,
            bom: item.bom || '-',
            mold: item.mold || '-',
            brand: brand,
            total: itemTotal
        });
    });

    // Tính tổng tích lũy (Cumulative sum) để xem xu hướng lượng dư tổng cộng
    const statsByDay = {};
    let cumulative = 0;

    // Sort các ngày để cộng dồn đúng thứ tự lịch sử
    Object.keys(dailyIncrease).sort().forEach(dateStr => {
        cumulative += dailyIncrease[dateStr];
        // Format lại thành DD/MM/YYYY cho đẹp khi hiển thị trên biểu đồ
        const [y, m, d] = dateStr.split('-');
        statsByDay[`${d}/${m}/${y}`] = cumulative;
    });

    // Update Summary Cards
    document.getElementById('stat-total-qty').textContent = totalQty.toLocaleString();
    document.getElementById('stat-total-orders').textContent = data.length.toLocaleString();

    const sortedBrands = Object.entries(statsByBrand).sort((a, b) => b[1] - a[1]);
    document.getElementById('stat-top-brand').textContent = sortedBrands[0] ? sortedBrands[0][0] : '-';

    renderDayChart(statsByDay);
    renderBrandChart(statsByBrand);
    renderSectionChart(statsBySection);
    renderTopTable(topOrders);

    // Hide section chart when filtering by specific section
    const sectionChartContainer = document.getElementById('section-chart-container');
    if (sectionChartContainer) {
        sectionChartContainer.style.display = currentSection === 'ALL' ? '' : 'none';
    }
}

function renderDayChart(stats) {
    const ctx = document.getElementById('chart-by-day').getContext('2d');
    const labels = Object.keys(stats);
    const values = Object.values(stats);

    if (dayChart) dayChart.destroy();

    dayChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số lượng dôi',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 4,
                pointRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#6366f1',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderBrandChart(stats) {
    const ctx = document.getElementById('chart-by-brand').getContext('2d');
    const labels = Object.keys(stats);
    const values = Object.values(stats);

    const colors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    if (brandChart) brandChart.destroy();

    brandChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            }
        }
    });
}

function renderTopTable(orders) {
    const table = document.getElementById('top-orders-table');
    const sorted = orders.sort((a, b) => b.total - a.total).slice(0, 10);

    table.innerHTML = sorted.map((order, index) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-4">
                <span class="${index < 3 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'} w-8 h-8 flex items-center justify-center rounded-full font-black text-xs">
                    ${index + 1}
                </span>
            </td>
            <td class="px-4 py-4 font-black text-slate-700">${order.rpro}</td>
            <td class="px-4 py-4">
                <p class="text-sm font-bold text-slate-800">${order.bom}</p>
                <p class="text-[10px] text-slate-400 italic">${order.mold}</p>
            </td>
            <td class="px-4 py-4">
                <span class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black">${order.brand}</span>
            </td>
            <td class="px-4 py-4 text-right">
                <span class="text-lg font-black text-slate-800">${order.total.toLocaleString()}</span>
                <span class="text-[10px] text-slate-400 font-bold ml-1 uppercase">đôi</span>
            </td>
        </tr>
    `).join('');
}

function renderSectionChart(stats) {
    const ctx = document.getElementById('chart-by-section').getContext('2d');

    const SECTION_LABELS = {
        'LPS': 'LPS',
        'MOLDING': 'Molding',
        'LEANLINE_MOLDED': 'Leanline Molded',
        'LEANLINE_DC': 'Leanline DC',
        'LEANLINE': 'Leanline (cũ)',
    };
    const SECTION_COLORS = {
        'LPS': '#10b981',
        'MOLDING': '#6366f1',
        'LEANLINE_MOLDED': '#f59e0b',
        'LEANLINE_DC': '#a855f7',
        'LEANLINE': '#fb923c',
    };

    const labels = Object.keys(stats).map(k => SECTION_LABELS[k] || k);
    const values = Object.values(stats);
    const colors = Object.keys(stats).map(k => SECTION_COLORS[k] || '#94a3b8');

    if (sectionChart) sectionChart.destroy();

    sectionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { weight: 'bold' } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
