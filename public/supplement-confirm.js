
import { supabase } from './supabaseClient.js';

const confirmBody = document.getElementById('confirm-body');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');
const btnExportZalo = document.getElementById('btn-export-zalo');
const checkAll = document.getElementById('check-all');

let currentData = [];
let selectedRpros = new Set();

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
  // Find row element and highlight
  renderTable(); // Re-render simple for data consistency
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
    // Auto-select row if a status is set
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

  if (hasLiệu.length > 0) {
    message += `🟢 *NHÓM CÓ LIỆU:*\n`;
    hasLiệu.forEach(r => {
      const avail = r.available_supplement !== null ? r.available_supplement : r.total;
      message += `- ${r.rpro} (${r.so || 'N/A'} | Qty bù: *${avail}/${r.total}*)\n`;
    });
    message += `\n`;
  }

  if (noLiệu.length > 0) {
    message += `🔴 *NHÓM KHÔNG CÓ LIỆU:*\n`;
    noLiệu.forEach(r => {
      message += `- ${r.rpro} (${r.so || 'N/A'} | Cần bù: ${r.total})\n`;
    });
    message += `\n`;
  }

  if (other.length > 0) {
    message += `⏳ *CHƯA XÁC NHẬN:*\n`;
    other.forEach(r => {
      message += `- ${r.rpro} (${r.so || 'N/A'})\n`;
    });
    message += `\n`;
  }

  message += `_Trạng thái: Đã cập nhật trên Dashboard._`;

  try {
    await navigator.clipboard.writeText(message);
    alert("🚀 Đã copy thông tin vào bộ nhớ đệm!\nBây giờ Zalo Web sẽ được mở, bạn chỉ cần nhấn Ctrl+V để dán vào khung chat và gửi.");
    window.open("https://chat.zalo.me/", "_blank");
  } catch (err) {
    console.error("Clipboard error:", err);
    alert("Lỗi khi copy vào clipboard. Vui lòng copy thủ công.");
  }
}

if (btnExportZalo) btnExportZalo.addEventListener('click', exportToZalo);
if (btnFilter) btnFilter.addEventListener('click', loadConfirmList);

document.addEventListener('DOMContentLoaded', () => {
  setInitialDates();
  loadConfirmList();
});
