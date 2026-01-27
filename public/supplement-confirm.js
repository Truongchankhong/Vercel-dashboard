
import { supabase } from './supabaseClient.js';

const confirmBody = document.getElementById('confirm-body');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const btnFilter = document.getElementById('btn-filter');

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

  // Include the full target day
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

  confirmBody.innerHTML = data.map(row => `
    <tr>
      <td class="px-4 py-2 border text-sm">${new Date(row.created_at).toLocaleString('vi-VN')}</td>
      <td class="px-4 py-2 border font-mono text-sm">${row.rpro}</td>
      <td class="px-4 py-2 border text-sm">${row.so || ''}</td>
      <td class="px-4 py-2 border text-sm">${row.customers || ''}</td>
      <td class="px-4 py-2 border text-right font-bold">${row.total}</td>
      <td class="px-4 py-2 border">
        <input type="number" min="0" max="${row.total}" 
               value="${row.available_supplement !== null ? row.available_supplement : ''}" 
               placeholder="Full (${row.total})"
               onchange="handleAvailableUpdate('${row.rpro}', this.value)"
               class="w-24 border px-2 py-1 rounded text-center">
      </td>
      <td class="px-4 py-2 border text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="handleConfirmation('${row.rpro}', 'Có liệu')" 
                  class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 ${row.confirm === 'Có liệu' ? 'ring-4 ring-red-500' : ''}">
            Có liệu
          </button>
          <button onclick="handleConfirmation('${row.rpro}', 'Không có liệu')" 
                  class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 ${row.confirm === 'Không có liệu' ? 'ring-4 ring-red-500' : ''}">
            Không có liệu
          </button>
          <span id="saved-${row.rpro}" class="text-xs text-blue-600 font-bold hidden">✅ Đã lưu</span>
        </div>
      </td>
    </tr>
  `).join('');
}

window.handleAvailableUpdate = async (rpro, value) => {
  const numValue = value === '' ? null : Number(value);
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
      savedEl.classList.remove('hidden');
      setTimeout(() => savedEl.classList.add('hidden'), 2000);
    }
  }
};

window.handleConfirmation = async (rpro, status) => {
  const { error } = await supabase
    .from('supplement_confirm')
    .update({ confirm: status })
    .eq('rpro', rpro);

  if (error) {
    console.error('Error updating status:', error);
    alert('Lỗi khi lưu xác nhận');
  } else {
    const savedEl = document.getElementById(`saved-${rpro}`);
    if (savedEl) {
      savedEl.classList.remove('hidden');
      setTimeout(() => {
        loadConfirmList();
      }, 500);
    }
  }
};

btnFilter.addEventListener('click', loadConfirmList);

document.addEventListener('DOMContentLoaded', () => {
  setInitialDates();
  loadConfirmList();
});
