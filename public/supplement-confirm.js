
import { supabase } from './supabaseClient.js';

const confirmBody = document.getElementById('confirm-body');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');
const btnExportZalo = document.getElementById('btn-export-zalo');
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
      <td class="px-4 py-2 border text-[12px]">${row.so || ''}</td>
      <td class="px-4 py-2 border text-[12px]">${row.customers || ''}</td>
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

  message += `_Trạng thái: Đã cập nhật trên Dashboard._`;

  try {
    await navigator.clipboard.writeText(message);
    alert("🚀 Đã copy thông tin vào bộ nhớ đệm!\nBây giờ bạn chỉ cần vào Zalo dán (Ctrl+V) và gửi.");
  } catch (err) {
    console.error("Clipboard error:", err);
    alert("Lỗi khi copy vào clipboard. Vui lòng copy thủ công.");
  }
}

// ================= STATS LOGIC ================= //

async function fetchStatsData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from('supplement_confirm')
    .select('created_at, confirm')
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
  const dailyCó = [];
  const dailyKhông = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    dailyLabels.push(dateStr);

    const dayData = data.filter(r => {
      const rDate = new Date(r.created_at);
      return rDate.getDate() === d.getDate() && rDate.getMonth() === d.getMonth();
    });

    dailyCó.push(dayData.filter(r => r.confirm === 'Có liệu').length);
    dailyKhông.push(dayData.filter(r => r.confirm === 'Không có liệu').length);
  }

  const dayOfWeek = now.getDay() || 7;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));

  const weekData = data.filter(r => new Date(r.created_at) >= startOfWeek);
  const weekCó = weekData.filter(r => r.confirm === 'Có liệu').length;
  const weekKhông = weekData.filter(r => r.confirm === 'Không có liệu').length;

  const monthCó = data.filter(r => r.confirm === 'Có liệu').length;
  const monthKhông = data.filter(r => r.confirm === 'Không có liệu').length;

  return {
    daily: { labels: dailyLabels, có: dailyCó, không: dailyKhông },
    weekly: [weekCó, weekKhông],
    monthly: [monthCó, monthKhông]
  };
}

function initCharts(stats) {
  Object.values(charts).forEach(c => c.destroy());

  charts.daily = new Chart(document.getElementById('chart-daily'), {
    type: 'bar',
    data: {
      labels: stats.daily.labels,
      datasets: [
        { label: '🟢 Có liệu', data: stats.daily.có, backgroundColor: '#22c55e' },
        { label: '🔴 Không có liệu', data: stats.daily.không, backgroundColor: '#ef4444' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
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
    options: { plugins: { legend: { position: 'bottom' } } }
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
    options: { plugins: { legend: { position: 'bottom' } } }
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
if (btnFilter) btnFilter.addEventListener('click', loadConfirmList);

document.addEventListener('DOMContentLoaded', () => {
  setInitialDates();
  loadConfirmList();
});
