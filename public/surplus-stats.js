import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    const data = await fetchAllSurplusData();
    if (data && data.length > 0) {
        processAndRender(data);
    }
}

async function fetchAllSurplusData() {
    const { data, error } = await supabase
        .from('surplusgoods')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching stats data:", error);
        return [];
    }
    return data;
}

function processAndRender(data) {
    const statsByDay = {};
    const statsByBrand = {};
    const topOrders = [];

    let totalQty = 0;

    data.forEach(item => {
        // Calculate Total Qty for this item
        let itemTotal = 0;
        Object.keys(item).forEach(k => {
            if (k.startsWith('size_') && !isNaN(item[k])) {
                itemTotal += parseFloat(item[k]) || 0;
            }
        });
        const dyn = item.dynamic_sizes || {};
        Object.values(dyn).forEach(v => {
            if (!isNaN(v)) itemTotal += parseFloat(v) || 0;
        });

        totalQty += itemTotal;

        // Group by Day
        const dateStr = new Date(item.created_at).toLocaleDateString('en-GB'); // DD/MM/YYYY
        statsByDay[dateStr] = (statsByDay[dateStr] || 0) + itemTotal;

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

    // Update Summary Cards
    document.getElementById('stat-total-qty').textContent = totalQty.toLocaleString();
    document.getElementById('stat-total-orders').textContent = data.length.toLocaleString();

    const sortedBrands = Object.entries(statsByBrand).sort((a, b) => b[1] - a[1]);
    document.getElementById('stat-top-brand').textContent = sortedBrands[0] ? sortedBrands[0][0] : '-';

    renderDayChart(statsByDay);
    renderBrandChart(statsByBrand);
    renderTopTable(topOrders);
}

function renderDayChart(stats) {
    const ctx = document.getElementById('chart-by-day').getContext('2d');
    const labels = Object.keys(stats);
    const values = Object.values(stats);

    new Chart(ctx, {
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

    new Chart(ctx, {
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
