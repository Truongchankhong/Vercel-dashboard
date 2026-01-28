
import { supabase } from './supabaseClient.js';

const confirmBody = document.getElementById('confirm-body');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');
const btnExportZalo = document.getElementById('btn-export-zalo');
const btnExportExcel = document.getElementById('btn-export-excel');
const checkAll = document.getElementById('check-all');
const btnShowStats = document.getElementById('btn-show-stats');
const btnCloseStats = document.getElementById('btn-close-stats');
const statsModal = document.getElementById('stats-modal');

let currentData = [];
let selectedRpros = new Set();
let charts = {}; // Store Chart instances

function setInitialDates() {
  const today = new Date();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(today.getDate() - 2);

  dateFromInput.value = twoDaysAgo.toISOString().split('T')[0];
  dateToInput.value = today.toISOString().split('T')[0];
}

async function loadConfirmList() {
  const from = dateFromInput.value;
  const to = dateToInput.value;

  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('supplement_confirm')
    .select('*')
    .gte('created_at', new Date(from).toISOString())
    .lte('created_at', toDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching confirm list:', error);
    return;
  }

  currentData = data;

  // Calculate Pending Count (Not confirmed yet)
  const pendingRows = data.filter(r => !r.confirm);
  const pendingEl = document.getElementById('pending-count');
  if (pendingEl) pendingEl.innerText = pendingRows.length;

  renderTable();
}

function renderTable() {
  if (!confirmBody) return;
  confirmBody.innerHTML = currentData.map(row => {
    const isSelected = selectedRpros.has(row.rpro);
    return `
    <tr class="${isSelected ? 'bg-blue-50' : ''}">
      <td class="px-4 py-2 border text-[12px]">${new Date(row.created_at).toLocaleString('vi-VN')}</td>
      <td class="px-4 py-2 border font-mono text-[12px] font-bold">${row.rpro}</td>
      <td class="px-4 py-2 border text-[12px]">${row.pu || ''}</td>
      <td class="px-4 py-2 border text-[12px]">${row.fabric || ''}</td>
      <td class="px-4 py-2 border text-right font-bold">${row.total}</td>
      <td class="px-4 py-2 border">
        <input type="number" min="0" max="${row.total}" 
               value="${row.available_supplement !== null ? row.available_supplement : ''}" 
               placeholder="Full (${row.total})"
               onchange="handleAvailableUpdate('${row.rpro}', this.value, ${row.total})"
               class="w-24 border px-2 py-1 rounded text-center">
      </td>
      <td class="px-4 py-2 border text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="handleConfirmation('${row.rpro}', 'Có liệu', '${row.confirm || ''}')" 
                  class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 ${row.confirm === 'Có liệu' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Có liệu
          </button>
          <button onclick="handleConfirmation('${row.rpro}', 'Không có liệu', '${row.confirm || ''}')" 
                  class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 ${row.confirm === 'Không có liệu' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Không có liệu
          </button>
          <span id="saved-${row.rpro}" class="text-xs text-blue-600 font-bold hidden">✅ Đã lưu</span>
        </div>
      </td>
      <td class="px-4 py-2 border text-center">
        <input type="checkbox" class="row-check w-5 h-5 cursor-pointer" 
               data-rpro="${row.rpro}" ${isSelected ? 'checked' : ''} 
               onchange="toggleSelect('${row.rpro}', this.checked)">
      </td>
    </tr>
  `;
  }).join('');
}

window.toggleSelect = (rpro, checked) => {
  if (checked) selectedRpros.add(rpro);
  else selectedRpros.delete(rpro);
  renderTable();
};

if (checkAll) {
  checkAll.addEventListener('change', (e) => {
    const checked = e.target.checked;
    currentData.forEach(row => {
      if (checked) selectedRpros.add(row.rpro);
      else selectedRpros.delete(row.rpro);
    });
    renderTable();
  });
}

window.handleAvailableUpdate = async (rpro, value, total) => {
  const numValue = value === '' ? total : Number(value);
  const { error } = await supabase
    .from('supplement_confirm')
    .update({ available_supplement: numValue })
    .eq('rpro', rpro);

  if (error) {
    console.error('Error updating availability:', error);
    alert('Lỗi khi lưu số lượng');
  } else {
    const savedEl = document.getElementById(`saved-${rpro}`);
    if (savedEl) {
      savedEl.textContent = value === '' ? "✅ Đã lưu (Full)" : "✅ Đã lưu";
      savedEl.classList.remove('hidden');
      setTimeout(() => savedEl.classList.add('hidden'), 2000);
      if (value === '') loadConfirmList();
    }
  }
};

window.handleConfirmation = async (rpro, newStatus, currentStatus) => {
  const statusToSave = (newStatus === currentStatus) ? null : newStatus;

  const { error } = await supabase
    .from('supplement_confirm')
    .update({ confirm: statusToSave })
    .eq('rpro', rpro);

  if (error) {
    console.error('Error updating status:', error);
    alert('Lỗi khi lưu xác nhận');
  } else {
    if (statusToSave) selectedRpros.add(rpro);

    const savedEl = document.getElementById(`saved-${rpro}`);
    if (savedEl) {
      savedEl.textContent = statusToSave ? "✅ Đã lưu" : "🔄 Đã hủy chọn";
      savedEl.classList.remove('hidden');
      setTimeout(() => {
        loadConfirmList();
      }, 500);
    }
  }
};

const formatSizeBreakdown = (r) => {
  let sizes = [];
  Object.keys(r).forEach(key => {
    if (key.startsWith('size_') && Number(r[key]) > 0) {
      const sizeName = key.replace('size_', '').replace(/_/g, '.');
      sizes.push(`${sizeName}: ${r[key]}`);
    }
  });
  return sizes.join(', ');
};

async function exportToZalo() {
  if (selectedRpros.size === 0) {
    alert("Vui lòng tích chọn ít nhất 1 đơn hàng để gửi!");
    return;
  }

  const selectedData = currentData.filter(row => selectedRpros.has(row.rpro));
  const hasLiệu = selectedData.filter(r => r.confirm === 'Có liệu');
  const noLiệu = selectedData.filter(r => r.confirm === 'Không có liệu');
  const other = selectedData.filter(r => !r.confirm);

  const todayStr = new Date().toLocaleDateString('vi-VN');
  let message = `🛒 *XÁC NHẬN BÙ HÀNG - [Ngày ${todayStr}]*\n\n`;

  if (hasLiệu.length > 0) {
    message += `🟢 *NHÓM CÓ LIỆU:*\n`;
    hasLiệu.forEach(r => {
      const avail = r.available_supplement !== null ? r.available_supplement : r.total;
      const sizeText = formatSizeBreakdown(r);
      message += `- *${r.rpro}*\n  + Size: ${sizeText}\n  + Qty đáp ứng: *${avail}/${r.total}*\n`;
    });
    message += `\n`;
  }

  if (noLiệu.length > 0) {
    message += `🔴 *NHÓM KHÔNG CÓ LIỆU:*\n`;
    noLiệu.forEach(r => {
      const sizeText = formatSizeBreakdown(r);
      message += `- *${r.rpro}*\n  + Size: ${sizeText}\n  + Tổng cần bù: ${r.total}\n`;
    });
    message += `\n`;
  }

  if (other.length > 0) {
    message += `⏳ *CHƯA XÁC NHẬN:*\n`;
    other.forEach(r => {
      message += `- ${r.rpro}\n`;
    });
    message += `\n`;
  }

  const totalSelectedQty = selectedData.reduce((sum, r) => sum + Number(r.total), 0);
  const totalCóQty = hasLiệu.reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);
  const fulfillmentRate = totalSelectedQty > 0 ? (totalCóQty * 100 / totalSelectedQty).toFixed(1) : 0;

  message += `*Tỷ lệ % có liệu: ${fulfillmentRate}%*\n`;
  message += `🔗 _Link Excel Online:_ https://truong-nx-ovn.github.io/vercel-dashboard/public/supplement-report.html`;

  try {
    await navigator.clipboard.writeText(message);
    alert("🚀 Đã copy thông tin vào bộ nhớ đệm!\nBây giờ bạn chỉ cần vào Zalo dán (Ctrl+V) và gửi.");
  } catch (err) {
    console.error("Clipboard error:", err);
    alert("Lỗi khi copy vào clipboard. Vui lòng copy thủ công.");
  }
}

async function exportToExcel() {
  if (currentData.length === 0) {
    alert("Không có dữ liệu trong khoảng ngày đã chọn!");
    return;
  }

  const excelData = currentData.map(r => {
    return {
      'Ngày': new Date(r.created_at).toLocaleDateString('vi-VN'),
      'RPRO': r.rpro,
      'SO': r.so || '',
      'Khách hàng': r.customers || '',
      'Gender': r.gender || '',
      'Mold': r.mold || '',
      'PU': r.pu || '',
      'Fabric': r.fabric || '',
      'BOM': r.bom || '',
      'Qty': r.total,
      'Available_supplement': r.available_supplement !== null ? r.available_supplement : r.total,
      'Size': formatSizeBreakdown(r),
      'Xác nhận': r.confirm || 'Chưa xác nhận',
      'Ghi chú': r.remark || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Xác nhận Bù hàng");

  // File name based on filter dates
  const filename = `Xac_nhan_Bu_hang_${dateFromInput.value}_den_${dateToInput.value}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// ================= STATS LOGIC ================= //

async function fetchStatsData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from('supplement_confirm')
    .select('*')
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error("Error fetching stats:", error);
    return [];
  }
  return data;
}

function processStats(data) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const dailyLabels = [];
  const dailyCóCount = [];
  const dailyKhôngCount = [];
  const dailyCóQty = [];
  const dailyKhôngQty = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    dailyLabels.push(dateStr);

    const dayData = data.filter(r => {
      const rDate = new Date(r.created_at);
      return rDate.getDate() === d.getDate() && rDate.getMonth() === d.getMonth();
    });

    const cóItems = dayData.filter(r => r.confirm === 'Có liệu');
    const khôngItems = dayData.filter(r => r.confirm === 'Không có liệu');

    dailyCóCount.push(cóItems.length);
    dailyKhôngCount.push(khôngItems.length);

    dailyCóQty.push(cóItems.reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0));
    dailyKhôngQty.push(khôngItems.reduce((sum, r) => sum + Number(r.total), 0));
  }

  // 2. Weekly Stats (Current Week - QTY)
  const dayOfWeek = now.getDay() || 7;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));

  const weekData = data.filter(r => new Date(r.created_at) >= startOfWeek);
  const weekCóQty = weekData.filter(r => r.confirm === 'Có liệu').reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);
  const weekKhôngQty = weekData.filter(r => r.confirm === 'Không có liệu').reduce((sum, r) => sum + Number(r.total), 0);

  // 3. Monthly Stats (Current Month - QTY)
  const monthCóQty = data.filter(r => r.confirm === 'Có liệu').reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);
  const monthKhôngQty = data.filter(r => r.confirm === 'Không có liệu').reduce((sum, r) => sum + Number(r.total), 0);

  return {
    daily: {
      labels: dailyLabels,
      count: { có: dailyCóCount, không: dailyKhôngCount },
      qty: { có: dailyCóQty, không: dailyKhôngQty }
    },
    weekly: [weekCóQty, weekKhôngQty],
    monthly: [monthCóQty, monthKhôngQty]
  };
}

function initCharts(stats) {
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  Object.values(charts).forEach(c => {
    if (c && typeof c.destroy === 'function') c.destroy();
  });

  const piePluginConfig = {
    datalabels: {
      color: '#fff',
      font: { weight: 'bold', size: 14 },
      formatter: (value, ctx) => {
        const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
        if (sum === 0) return '';
        const percentage = (value * 100 / sum).toFixed(1) + "%";
        return percentage;
      }
    }
  };

  charts.dailyQty = new Chart(document.getElementById('chart-daily-qty'), {
    type: 'bar',
    data: {
      labels: stats.daily.labels,
      datasets: [
        { label: '🟢 Qty Có liệu', data: stats.daily.qty.có, backgroundColor: '#16a34a' },
        { label: '🔴 Qty Không có liệu', data: stats.daily.qty.không, backgroundColor: '#dc2626' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Tổng số đôi (Qty) theo ngày' },
        datalabels: { display: false }
      }
    }
  });

  charts.dailyCount = new Chart(document.getElementById('chart-daily'), {
    type: 'bar',
    data: {
      labels: stats.daily.labels,
      datasets: [
        { label: '🟢 Đơn Có liệu', data: stats.daily.count.có, backgroundColor: '#22c55e' },
        { label: '🔴 Đơn Không có liệu', data: stats.daily.count.không, backgroundColor: '#ef4444' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Tổng số đơn theo ngày' },
        datalabels: { display: false }
      }
    }
  });

  charts.weekly = new Chart(document.getElementById('chart-weekly'), {
    type: 'pie',
    data: {
      labels: ['Có liệu', 'Không có liệu'],
      datasets: [{
        data: stats.weekly,
        backgroundColor: ['#22c55e', '#ef4444']
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        ...piePluginConfig
      }
    }
  });

  charts.monthly = new Chart(document.getElementById('chart-monthly'), {
    type: 'pie',
    data: {
      labels: ['Có liệu', 'Không có liệu'],
      datasets: [{
        data: stats.monthly,
        backgroundColor: ['#22c55e', '#ef4444']
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        ...piePluginConfig
      }
    }
  });
}

async function showStats() {
  statsModal.classList.remove('hidden');
  const data = await fetchStatsData();
  const stats = processStats(data);
  initCharts(stats);
}

// ================= EVENT LISTENERS ================= //

if (btnShowStats) btnShowStats.addEventListener('click', showStats);
if (btnCloseStats) btnCloseStats.addEventListener('click', () => statsModal.classList.add('hidden'));
if (btnExportZalo) btnExportZalo.addEventListener('click', exportToZalo);
if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);
if (btnFilter) btnFilter.addEventListener('click', loadConfirmList);

document.addEventListener('DOMContentLoaded', () => {
  setInitialDates();
  loadConfirmList();
});
