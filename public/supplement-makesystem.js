
import { supabase } from './supabaseClient.js';

const systemBody = document.getElementById('system-body');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnShowStats = document.getElementById('btn-show-stats');
const btnCloseStats = document.getElementById('btn-close-stats');
const scanInput = document.getElementById('scan-input');
const btnAddScan = document.getElementById('btn-add-scan');
const searchRproInput = document.getElementById('search-rpro');

let currentData = [];
let filteredData = [];
let charts = {};

// ==================== CONFIG & INIT ====================

function setInitialDates() {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 2); // Result: Today, Yesterday, Day before (3 days total)

    dateFromInput.value = threeDaysAgo.toISOString().split('T')[0];
    dateToInput.value = today.toISOString().split('T')[0];
}

async function loadSystemList() {
    const from = dateFromInput.value;
    const to = dateToInput.value;

    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
        .from('supplement_makesystem')
        .select('*')
        .gte('created_at', new Date(from).toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching system list:', error);
        // If table doesn't exist, we might need to alert the user
        if (error.code === '42P01') {
            alert('⚠️ Hệ thống: Bảng [supplement_makesystem] chưa được tạo trong Supabase. Vui lòng liên hệ Admin hoặc chạy SQL khởi tạo.');
        }
        return;
    }

    currentData = data;
    filteredData = data;
    updateCounters();
    applySearchAndRender();
}

function applySearchAndRender() {
    const searchTerm = (searchRproInput?.value || "").trim().toUpperCase();
    const cleanSearch = searchTerm.replace(/[^A-Z0-9]/g, ""); // Remove non-alphanumeric

    if (cleanSearch) {
        filteredData = currentData.filter(row => {
            const cleanRpro = (row.rpro || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            const cleanSo = (row.so || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
            const cleanBrand = (row.brand || "").replace(/[^A-Z0-9]/g, "").toUpperCase();

            return cleanRpro.includes(cleanSearch) ||
                cleanSo.includes(cleanSearch) ||
                cleanBrand.includes(cleanSearch);
        });
    } else {
        filteredData = currentData;
    }
    renderTable();
}

if (searchRproInput) {
    searchRproInput.addEventListener('input', applySearchAndRender);
}

function updateCounters() {
    const noMaterial = currentData.filter(r => r.status === 'NO_MATERIAL').length;
    const noMaterialEl = document.getElementById('no-material-count');
    if (noMaterialEl) noMaterialEl.innerText = noMaterial;
}

// ==================== RENDER ====================

function renderTable() {
    if (!systemBody) return;

    if (filteredData.length === 0) {
        systemBody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-gray-400 italic">Không tìm thấy đơn hàng nào khớp với tìm kiếm</td></tr>`;
        return;
    }

    systemBody.innerHTML = filteredData.map(row => {
        const isNoMaterial = row.status === 'NO_MATERIAL';
        const statusColor = isNoMaterial ? 'bg-red-50' : 'bg-emerald-50';

        return `
        <tr class="hover:bg-gray-50 transition border-b ${statusColor}">
            <td class="px-2 py-3 border-r text-center">
                <button onclick="handleDeleteRow('${row.id}', '${row.rpro}')" class="text-red-400 hover:text-red-600 p-1 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
            <td class="px-4 py-3 border-r text-[11px] text-gray-500">
                ${new Date(row.created_at).toLocaleDateString('vi-VN')}<br>
                ${new Date(row.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </td>
            <td class="px-4 py-3 border-r font-mono text-sm font-bold text-cyan-700 sticky left-0 z-10 bg-inherit shadow-[1px_0_4px_rgba(0,0,0,0.05)]">
                ${row.rpro}
            </td>
            <td class="px-4 py-3 border-r text-xs font-bold text-gray-700">
                ${row.so || '-'}
            </td>
            <td class="px-4 py-3 border-r text-xs">
                <span class="block font-bold text-center">${row.brand || '-'}</span>
                <span class="text-[10px] text-gray-500 italic block text-center">${row.mold || '-'}</span>
            </td>
            <td class="px-3 py-3 border-r text-[10px] font-mono text-center break-words max-w-[100px] bg-blue-50/30">
                ${row.pu || '-'}
            </td>
            <td class="px-3 py-3 border-r text-[10px] text-gray-600 text-center break-words max-w-[120px] bg-blue-50/30">
                ${row.fabric || '-'}
            </td>
            <td class="px-4 py-3 border-r text-center">
                <input type="number" min="0" 
                    value="${row.total || 0}" 
                    onchange="handleQtyUpdate('${row.id}', this.value)"
                    class="w-20 border rounded px-2 py-1 text-center font-bold text-indigo-600 bg-indigo-50 focus:bg-white transition-all">
            </td>
            <td class="px-4 py-3 border-r text-center">
                <div class="flex flex-col sm:flex-row gap-2 justify-center">
                    <button onclick="updateStatus('${row.id}', 'HAS_MATERIAL')" 
                        class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm
                        ${row.status === 'HAS_MATERIAL' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-white text-emerald-600 border border-emerald-600 hover:bg-emerald-50'}">
                        CÓ LIỆU
                    </button>
                    <button onclick="updateStatus('${row.id}', 'NO_MATERIAL')" 
                        class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm
                        ${row.status === 'NO_MATERIAL' ? 'bg-rose-600 text-white ring-2 ring-rose-300' : 'bg-white text-rose-600 border border-rose-600 hover:bg-rose-50'}">
                        CHƯA LIỆU
                    </button>
                </div>
            </td>
            <td class="px-4 py-3 text-xs">
                <textarea onchange="updateNote('${row.id}', this.value)" 
                    class="w-full bg-transparent border-none focus:ring-1 focus:ring-cyan-400 rounded p-1 transition-all resize-none h-12"
                    placeholder="Ghi chú WH...">${row.note || ''}</textarea>
            </td>
        </tr>
        `;
    }).join('');
}

// ==================== ACTIONS ====================

window.handleDeleteRow = async (id, rpro) => {
    if (!confirm(`Bạn có chắc muốn xóa đơn [${rpro}] khỏi danh sách hệ thống không?`)) return;

    const { error } = await supabase.from('supplement_makesystem').delete().eq('id', id);
    if (error) alert('Lỗi xóa: ' + error.message);
    else loadSystemList();
};

window.updateStatus = async (id, newStatus) => {
    const { error } = await supabase
        .from('supplement_makesystem')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) alert('Lỗi cập nhật: ' + error.message);
    else loadSystemList();
};

window.updateNote = async (id, val) => {
    const { error } = await supabase
        .from('supplement_makesystem')
        .update({ note: val, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) console.error('Note update error:', error);
};

window.handleQtyUpdate = async (id, value) => {
    if (!id || id === 'undefined' || id === 'null') return;
    const numValue = Number(value) || 0;
    const { error } = await supabase
        .from('supplement_makesystem')
        .update({
            total: numValue,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating total:', error);
        alert('Lỗi khi lưu số lượng Qty');
    }
};

// ==================== SCAN LOGIC ====================

async function handleScan() {
    const rawText = scanInput.value.trim();
    if (!rawText) return;

    // Normalize RPRO like in other pages
    let rpro = rawText.toUpperCase();
    if (rpro.includes('|')) {
        const parts = rpro.split('|');
        rpro = parts.find(p => p.startsWith('RPRO')) || rpro;
    }
    if (!rpro.startsWith('RPRO-')) {
        rpro = 'RPRO-' + rpro.replace(/^RPRO-?/i, '');
    }

    const statusEl = document.getElementById('scan-status');
    statusEl.classList.remove('hidden');

    try {
        // Check duplication in this system table
        const { data: existing } = await supabase.from('supplement_makesystem').select('rpro').eq('rpro', rpro).maybeSingle();
        if (existing) {
            alert(`⚠️ Đơn [${rpro}] đã có trong danh sách theo dõi của Hệ thống.`);
            scanInput.value = '';
            return;
        }

        let info = null;

        // 1. TẦNG 1: Tìm trong bảng 'supplement' (Giống trang Xác nhận)
        const { data: sRec, error: sError } = await supabase
            .from('supplement')
            .select('*')
            .eq('rpro', rpro)
            .maybeSingle();

        if (sRec) {
            info = {
                rpro: sRec.rpro,
                so: sRec.so || '',
                brand: sRec.customers || '', // customers maps to brand in logic
                customer: sRec.customers || '',
                mold: sRec.mold || '',
                total: sRec.total || 0,
                pu: sRec.pu || '',
                fabric: sRec.fabric || ''
            };
        } else {
            // 2. TẦNG 2 & 3: Powerapp / Masterdata
            const { data: pRec } = await supabase.from('powerapp').select('*').eq('PRO ODER', rpro).maybeSingle();
            if (pRec) {
                info = {
                    rpro: pRec['PRO ODER'],
                    so: pRec['SO'],
                    brand: pRec['Brand Code'],
                    customer: pRec['CUSTOMERS'],
                    mold: pRec['#MOLD'],
                    total: 0, // Default to 0 if not scanned yet (giống trang xác nhận)
                    pu: pRec['PU'],
                    fabric: pRec['FB DESCRIPTION'] || pRec['Tên vải']
                };
            } else {
                const { data: mRec } = await supabase.from('Masterdata').select('*').eq('PRO ODER', rpro).maybeSingle();
                if (mRec) {
                    info = {
                        rpro: mRec['PRO ODER'],
                        so: mRec['SO'],
                        brand: mRec['Brand Code'],
                        customer: mRec['CUSTOMERS'],
                        mold: mRec['#MOLD'],
                        total: 0,
                        pu: mRec['PU'],
                        fabric: mRec['Tên vải']
                    };
                }
            }
        }

        if (!info) {
            alert(`❌ Không tìm thấy thông tin cho đơn ${rpro} để tạo hệ thống.`);
            return;
        }

        // Insert into supplement_makesystem
        const { error: insError } = await supabase.from('supplement_makesystem').insert([{
            ...info,
            status: 'NO_MATERIAL',
            created_at: new Date().toISOString()
        }]);

        if (insError) throw insError;

        scanInput.value = '';
        loadSystemList();

    } catch (err) {
        console.error('Scan system error:', err);
        alert('Lỗi: ' + err.message);
    } finally {
        statusEl.classList.add('hidden');
    }
}

btnAddScan.addEventListener('click', handleScan);
scanInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleScan(); });

// ==================== EXCEL EXPORT ====================

function exportExcel() {
    if (currentData.length === 0) {
        alert('Không có dữ liệu để xuất!');
        return;
    }

    // Usually users want report of NO_MATERIAL specifically, but we can export all with status
    const exportRows = currentData.map(r => ({
        'Ngày tạo': new Date(r.created_at).toLocaleDateString('vi-VN'),
        'Mã đơn (RPRO)': r.rpro,
        'SO': r.so || '',
        'Brand': r.brand || '',
        'Mã khuôn': r.mold || '',
        'Mã PU': r.pu || '',
        'Mã Vải': r.fabric || '',
        'Khách hàng': r.customer || '',
        'Qty': r.total || 0,
        'Trạng thái Liệu': r.status === 'HAS_MATERIAL' ? 'Có liệu' : 'Chưa có liệu',
        'Ghi chú WH': r.note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo vật tư hệ thống");
    XLSX.writeFile(wb, `Bao_cao_lieu_HeThong_${new Date().toISOString().split('T')[0]}.xlsx`);
}

btnExportExcel.addEventListener('click', exportExcel);

// ==================== STATS LOGIC ====================

async function showStats() {
    statsModal.classList.remove('hidden');

    // Summary counts
    const hasMat = currentData.filter(r => r.status === 'HAS_MATERIAL').length;
    const noMat = currentData.filter(r => r.status === 'NO_MATERIAL').length;

    document.getElementById('stat-has-material').innerText = hasMat;
    document.getElementById('stat-no-material').innerText = noMat;

    initCharts(hasMat, noMat);
}

function initCharts(hasMat, noMat) {
    if (typeof Chart === 'undefined') return;

    // Destroy existing
    Object.values(charts).forEach(c => c && c.destroy());

    // 1. Pie/Doughnut Chart
    charts.pie = new Chart(document.getElementById('chart-status-pie'), {
        type: 'doughnut',
        data: {
            labels: ['Đã có liệu', 'Chưa có liệu'],
            datasets: [{
                data: [hasMat, noMat],
                backgroundColor: ['#10b981', '#f43f5e'],
                hoverOffset: 12,
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { weight: 'bold' } } },
                datalabels: {
                    color: '#fff',
                    formatter: (v, ctx) => {
                        const total = ctx.dataset.data[0] + ctx.dataset.data[1];
                        return total > 0 ? (v * 100 / total).toFixed(1) + '%' : '';
                    },
                    font: { weight: 'black', size: 16 }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    // 2. Top Brands bar chart (only for NO_MATERIAL)
    const brandCounts = {};
    currentData.filter(r => r.status === 'NO_MATERIAL').forEach(r => {
        const b = r.brand || 'Khác';
        brandCounts[b] = (brandCounts[b] || 0) + 1;
    });
    const sortedBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    charts.brand = new Chart(document.getElementById('chart-brand-bar'), {
        type: 'bar',
        data: {
            labels: sortedBrands.map(x => x[0]),
            datasets: [{
                label: 'SỐ ĐƠN THIẾU LIỆU',
                data: sortedBrands.map(x => x[1]),
                backgroundColor: '#6366f1',
                borderRadius: 8
            }]
        },
        options: {
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } }
        }
    });

    // 3. Trend Line (Resolution trend over last 7 days)
    const trendLabels = [];
    const trendResolved = [];
    const trendPending = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        trendLabels.push(dStr);

        const dayData = currentData.filter(r => new Date(r.created_at).toLocaleDateString('vi-VN') === d.toLocaleDateString('vi-VN'));
        trendResolved.push(dayData.filter(r => r.status === 'HAS_MATERIAL').length);
        trendPending.push(dayData.filter(r => r.status === 'NO_MATERIAL').length);
    }

    charts.trend = new Chart(document.getElementById('chart-trend-line'), {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [
                { label: 'Đã xử lý (Có liệu)', data: trendResolved, borderColor: '#10b981', tension: 0.4, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                { label: 'Đang treo (Chưa liệu)', data: trendPending, borderColor: '#f43f5e', tension: 0.4, borderDash: [5, 5] }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

btnShowStats.addEventListener('click', showStats);
btnCloseStats.addEventListener('click', () => statsModal.classList.add('hidden'));

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
    setInitialDates();
    loadSystemList();
});

btnFilter.addEventListener('click', loadSystemList);
