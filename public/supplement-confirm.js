
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
      <td class="px-2 py-2 border text-center">
        <button onclick="handleDeleteOrder('${row.rpro}')" class="text-red-500 hover:text-red-700 transition transform active:scale-125 p-1" title="Xóa đơn này">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </td>
      <td class="px-4 py-2 border text-[12px]">${new Date(row.created_at).toLocaleString('vi-VN')}</td>
      <td class="px-4 py-2 border font-mono text-[12px] font-bold sticky left-0 z-10 drop-shadow-sm ${isSelected ? 'bg-blue-50' : 'bg-white'}">${row.rpro}</td>
      <td class="px-4 py-2 border text-[12px]">${row.pu || ''}</td>
      <td class="px-4 py-2 border text-[12px]">${row.fabric || ''}</td>
      <td class="px-4 py-2 border">
        <input type="number" min="0" 
               value="${row.total}" 
               onchange="handleTotalUpdate('${row.rpro}', this.value)"
               class="w-16 border rounded px-2 py-1 text-right font-bold bg-blue-50 focus:bg-white transition">
      </td>
      <td class="px-4 py-2 border bg-yellow-50">
        <input type="number" min="0" 
               value="${row.so_tam !== null ? row.so_tam : ''}" 
               placeholder="Số tấm"
               onchange="handleSoTamUpdate('${row.rpro}', this.value)"
               class="w-20 border-2 border-yellow-200 px-2 py-1 rounded text-center font-bold focus:border-yellow-500 outline-none">
      </td>
      <td class="px-4 py-2 border">
        <input type="number" min="0" max="${row.total}" 
               value="${row.available_supplement !== null ? row.available_supplement : ''}" 
               placeholder="Full (${row.total})"
               onchange="handleAvailableUpdate('${row.rpro}', this.value, ${row.total})"
               class="w-24 border px-2 py-1 rounded text-center">
      </td>
      <td class="px-4 py-2 border text-center">
        <div class="grid grid-cols-2 lg:flex lg:flex-nowrap items-center justify-center gap-2 min-w-[200px] lg:min-w-0">
          <button onclick="handleConfirmation('${row.rpro}', 'Có liệu', '${row.confirm || ''}')" 
                  class="px-2 py-1 bg-green-500 text-white rounded text-[10px] sm:text-xs hover:bg-green-600 ${row.confirm === 'Có liệu' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Có liệu
          </button>
          <button onclick="handleConfirmation('${row.rpro}', 'Có PU - ko Vải', '${row.confirm || ''}')" 
                  class="px-2 py-1 bg-amber-500 text-white rounded text-[10px] sm:text-xs hover:bg-amber-600 ${row.confirm === 'Có PU - ko Vải' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Có PU-Ko Vải
          </button>
          <button onclick="handleConfirmation('${row.rpro}', 'Có Vải - ko PU', '${row.confirm || ''}')" 
                  class="px-2 py-1 bg-cyan-500 text-white rounded text-[10px] sm:text-xs hover:bg-cyan-600 ${row.confirm === 'Có Vải - ko PU' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Có Vải-Ko PU
          </button>
          <button onclick="handleConfirmation('${row.rpro}', 'Không có liệu', '${row.confirm || ''}')" 
                  class="px-2 py-1 bg-gray-600 text-white rounded text-[10px] sm:text-xs hover:bg-gray-700 ${row.confirm === 'Không có liệu' ? 'ring-4 ring-red-500 shadow-lg' : ''}">
            Không liệu
          </button>
          <span id="saved-${row.rpro}" class="text-[10px] text-blue-600 font-bold hidden col-span-2">✅ Đã lưu</span>
        </div>
      </td>
      <td class="px-4 py-2 border text-center">
        <input type="checkbox" class="row-check w-5 h-5 cursor-pointer" 
               data-rpro="${row.rpro}" ${isSelected ? 'checked' : ''} 
               onchange="toggleSelect('${row.rpro}', this.checked)">
      </td>
      <td class="px-4 py-2 border text-[11px] text-gray-600 max-w-[120px] truncate" title="${row.remark2 || ''}">
        ${row.remark2 || ''}
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

window.handleDeleteOrder = async (rpro) => {
  if (!confirm(`Bạn chắc chắn muốn xóa đơn ${rpro} khỏi danh sách xác nhận này?`)) return;

  const { error } = await supabase
    .from('supplement_confirm')
    .delete()
    .eq('rpro', rpro);

  if (error) {
    console.error('Error deleting order:', error);
    alert('Lỗi khi xóa đơn');
  } else {
    loadConfirmList();
  }
};

window.handleTotalUpdate = async (rpro, value) => {
  const numValue = Number(value) || 0;
  const { error } = await supabase
    .from('supplement_confirm')
    .update({
      total: numValue,
      updated_at: new Date().toISOString()
    })
    .eq('rpro', rpro);

  if (error) {
    console.error('Error updating total:', error);
    alert('Lỗi khi lưu số lượng Qty');
  } else {
    // Refresh list locally to update other calculations if needed
    currentData = currentData.map(r => r.rpro === rpro ? { ...r, total: numValue } : r);
    const savedEl = document.getElementById(`saved-${rpro}`);
    if (savedEl) {
      savedEl.textContent = "✅ Đã lưu Qty";
      savedEl.classList.remove('hidden');
      setTimeout(() => savedEl.classList.add('hidden'), 2000);
    }
  }
};

window.handleSoTamUpdate = async (rpro, value) => {
  const numValue = value === '' ? null : Number(value);
  const { error } = await supabase
    .from('supplement_confirm')
    .update({
      so_tam: numValue,
      updated_at: new Date().toISOString()
    })
    .eq('rpro', rpro);

  if (error) {
    console.error('Error updating so_tam:', error);
    alert('Lỗi khi lưu số tấm');
  } else {
    const savedEl = document.getElementById(`saved-${rpro}`);
    if (savedEl) {
      savedEl.textContent = "✅ Đã lưu số tấm";
      savedEl.classList.remove('hidden');
      setTimeout(() => savedEl.classList.add('hidden'), 2000);
    }
  }
};

window.handleAvailableUpdate = async (rpro, value, total) => {
  const numValue = value === '' ? total : Number(value);
  const { error } = await supabase
    .from('supplement_confirm')
    .update({
      available_supplement: numValue,
      updated_at: new Date().toISOString()
    })
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
  // Nếu đã có trạng thái cũ và trạng thái mới khác trạng thái cũ (không phải là hủy chọn)
  if (currentStatus && newStatus !== currentStatus) {
    const ok = confirm(`⚠️ Bạn có thực sự muốn thay đổi Xác nhận liệu cho đơn RPRO [${rpro}] không?`);
    if (!ok) return;
  }

  const statusToSave = (newStatus === currentStatus) ? null : newStatus;

  const { error } = await supabase
    .from('supplement_confirm')
    .update({
      confirm: statusToSave,
      updated_at: new Date().toISOString()
    })
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
  const hasPUOnly = selectedData.filter(r => r.confirm === 'Có PU - ko Vải');
  const hasFabricOnly = selectedData.filter(r => r.confirm === 'Có Vải - ko PU');
  const noLiệu = selectedData.filter(r => r.confirm === 'Không có liệu');
  const other = selectedData.filter(r => !r.confirm);

  const todayStr = new Date().toLocaleDateString('vi-VN');
  let message = `🛒 *XÁC NHẬN BÙ HÀNG - [Ngày ${todayStr}]*\n\n`;

  if (hasLiệu.length > 0) {
    message += `🟢 *NHÓM CÓ LIỆU:*\n`;
    hasLiệu.forEach(r => {
      const avail = r.available_supplement !== null ? r.available_supplement : r.total;
      const sizeText = formatSizeBreakdown(r);
      message += `- *${r.rpro}*\n  + Size: ${sizeText}\n  + Số lượng OK: *${avail}/${r.total}*\n`;
    });
    message += `\n`;
  }

  if (hasPUOnly.length > 0) {
    message += `🟠 *CÓ PU - KHÔNG CÓ VẢI:*\n`;
    hasPUOnly.forEach(r => {
      const avail = r.available_supplement !== null ? r.available_supplement : r.total;
      const sizeText = formatSizeBreakdown(r);
      message += `- *${r.rpro}*\n  + Size: ${sizeText}\n  + Số lượng OK: *${avail}/${r.total}*\n`;
    });
    message += `\n`;
  }

  if (hasFabricOnly.length > 0) {
    message += `🔵 *CÓ VẢI - KHÔNG CÓ PU:*\n`;
    hasFabricOnly.forEach(r => {
      const avail = r.available_supplement !== null ? r.available_supplement : r.total;
      const sizeText = formatSizeBreakdown(r);
      message += `- *${r.rpro}*\n  + Size: ${sizeText}\n  + Số lượng OK: *${avail}/${r.total}*\n`;
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

  // Calculate detailed quantities
  const totalDemand = selectedData.reduce((sum, r) => sum + Number(r.total), 0);

  const qtyCoLieu = selectedData
    .filter(r => r.confirm === 'Có liệu')
    .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);

  const qtyPuOnly = selectedData
    .filter(r => r.confirm === 'Có PU - ko Vải')
    .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);

  const qtyFabricOnly = selectedData
    .filter(r => r.confirm === 'Có Vải - ko PU')
    .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0);

  const qtyNoLieu = selectedData
    .filter(r => r.confirm === 'Không có liệu')
    .reduce((sum, r) => sum + Number(r.total), 0);

  const pctCoLieu = totalDemand > 0 ? (qtyCoLieu * 100 / totalDemand).toFixed(1) : 0;
  const pctPuOnly = totalDemand > 0 ? (qtyPuOnly * 100 / totalDemand).toFixed(1) : 0;
  const pctFabricOnly = totalDemand > 0 ? (qtyFabricOnly * 100 / totalDemand).toFixed(1) : 0;
  const pctNoLieu = totalDemand > 0 ? (qtyNoLieu * 100 / totalDemand).toFixed(1) : 0;

  message += `📊 *TỔNG HỢP TỶ LỆ:*\n`;
  message += `- 🟢 Có liệu: ${pctCoLieu}%\n`;
  message += `- 🟠 Có PU - ko Vải: ${pctPuOnly}%\n`;
  message += `- 🔵 Có Vải - ko PU: ${pctFabricOnly}%\n`;
  message += `- 🔴 Không liệu: ${pctNoLieu}%\n`;

  // Construct direct link to stats
  const currentUrl = window.location.href.split('?')[0];
  const statsLink = `${currentUrl}?stats=true`;

  message += `📊 *Xem biểu đồ thống kê:*\n${statsLink}\n`;
  message += `🔗 *Link Google Sheet (Báo cáo Online):*\nhttps://docs.google.com/spreadsheets/d/15VO02nvCbJYBx2ITs5FBUhCeB9jt_tIBLQMz0RAGbuo/edit?usp=sharing`;

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
      'Số tấm': r.so_tam || '',
      'Qty_Sup': r.available_supplement !== null ? r.available_supplement : r.total,
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

// ================= RPRO SCAN LOGIC ================= //

async function handleNewRproScan(rawText) {
  let rpro = rawText.trim();
  if (rpro.includes('|')) {
    const parts = rpro.split('|');
    const rproPart = parts.find(p => p.startsWith('RPRO'));
    if (rproPart) rpro = rproPart;
  }

  if (!rpro.startsWith('RPRO')) {
    alert('⚠️ QR không hợp lệ. Vui lòng quét mã RPRO.');
    return;
  }

  const statusEl = document.getElementById('scan-status');
  if (statusEl) statusEl.classList.remove('hidden');

  try {
    // 0. KIỂM TRA TRÙNG: Xem đơn đã có trong supplement_confirm chưa
    const { data: existConfirm } = await supabase
      .from('supplement_confirm')
      .select('rpro')
      .eq('rpro', rpro)
      .maybeSingle();

    if (existConfirm) {
      const ok = confirm(`⚠️ Đơn [${rpro}] đã có trong danh sách xác nhận rồi. Bạn có muốn tiếp tục làm mới thông tin cho đơn này không?`);
      if (!ok) return;
    }

    // 1. TẦNG 1: Tìm trong bảng 'supplement'
    let { data: finalRecord, error: sError } = await supabase
      .from('supplement')
      .select('*')
      .eq('rpro', rpro)
      .maybeSingle();

    if (sError) throw sError;

    if (!finalRecord) {
      console.log(`🔍 Không thấy ${rpro} trong supplement, chuyển tầng 2: powerapp`);

      // 2. TẦNG 2: Tìm trong bảng 'powerapp'
      let { data: pRec, error: pError } = await supabase
        .from('powerapp')
        .select('*')
        .eq('PRO ODER', rpro)
        .maybeSingle();

      if (pRec) {
        finalRecord = mapTableToSupplement(pRec, "Đơn chưa scan ở team hàng bù");
      } else {
        console.log(`🔍 Không thấy ${rpro} trong powerapp, chuyển tầng 3: Masterdata`);

        // 3. TẦNG 3: Tìm trong bảng 'Masterdata'
        let { data: mRec, error: mError } = await supabase
          .from('Masterdata')
          .select('*')
          .eq('PRO ODER', rpro)
          .maybeSingle();

        if (mRec) {
          finalRecord = mapTableToSupplement(mRec, "Đơn chưa scan ở team hàng bù");
        }
      }
    }

    if (!finalRecord) {
      alert(`❌ Không tìm thấy thông tin cho đơn ${rpro} trong toàn hệ thống (Supplement, Powerapp, Masterdata).`);
      return;
    }

    // Prepare data (exclude id)
    const { id, created_at, updated_at, ...dataToCopy } = finalRecord;

    // Upsert into supplement_confirm
    const { error: insError } = await supabase
      .from('supplement_confirm')
      .upsert([{
        ...dataToCopy,
        created_at: new Date().toISOString()
      }]);

    if (insError) throw insError;

    // Success (Seamless)
    const input = document.getElementById('scan-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    loadConfirmList();

  } catch (err) {
    console.error('Scan Error:', err);
    alert('Lỗi khi xử lý đơn hàng: ' + err.message);
  } finally {
    if (statusEl) statusEl.classList.add('hidden');
  }
}

// Helper to map powerapp/Masterdata to supplement structure
function mapTableToSupplement(rec, remarkValue) {
  const result = {
    rpro: rec['PRO ODER'],
    so: rec['SO'] || rec['Sales Order'] || '',
    customers: rec['CUSTOMERS'] || '',
    gender: (rec['Giới tính'] || rec['GENDER'] || '').trim(),
    mold: rec['Mã Khuôn'] || rec['#MOLD'] || '',
    pu: rec['Mã dao'] || rec['PU'] || '',
    fabric: rec['Tên vải'] || rec['FB DESCRIPTION'] || '',
    bom: rec['BOM'] || '',
    total: 0, // Default to 0 so user can enter manually
    remark2: remarkValue
  };

  // Add all size columns as 0
  Object.keys(rec).forEach(k => {
    if (!isNaN(parseFloat(k))) {
      const dbKey = 'size_' + k.replace(/\./g, '_');
      result[dbKey] = 0;
    }
  });

  return result;
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

  // Initialize arrays for 4 statuses
  const dailyLabels = [];
  const dailyCoCount = [];
  const dailyPuCount = [];
  const dailyFabricCount = [];
  const dailyNoCount = [];

  const dailyCoQty = [];
  const dailyPuQty = [];
  const dailyFabricQty = [];
  const dailyNoQty = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    dailyLabels.push(dateStr);

    const dayData = data.filter(r => {
      const rDate = new Date(r.created_at);
      return rDate.getDate() === d.getDate() && rDate.getMonth() === d.getMonth();
    });

    // Count Items
    dailyCoCount.push(dayData.filter(r => r.confirm === 'Có liệu').length);
    dailyPuCount.push(dayData.filter(r => r.confirm === 'Có PU - ko Vải').length);
    dailyFabricCount.push(dayData.filter(r => r.confirm === 'Có Vải - ko PU').length);
    dailyNoCount.push(dayData.filter(r => r.confirm === 'Không có liệu').length);

    // Sum Quantity
    dailyCoQty.push(dayData.filter(r => r.confirm === 'Có liệu')
      .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0));

    dailyPuQty.push(dayData.filter(r => r.confirm === 'Có PU - ko Vải')
      .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0));

    dailyFabricQty.push(dayData.filter(r => r.confirm === 'Có Vải - ko PU')
      .reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0));

    dailyNoQty.push(dayData.filter(r => r.confirm === 'Không có liệu')
      .reduce((sum, r) => sum + Number(r.total), 0));
  }

  // Helper for summarizing data
  const summarize = (sourceData) => {
    return [
      sourceData.filter(r => r.confirm === 'Có liệu').reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0),
      sourceData.filter(r => r.confirm === 'Có PU - ko Vải').reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0),
      sourceData.filter(r => r.confirm === 'Có Vải - ko PU').reduce((sum, r) => sum + Number(r.available_supplement !== null ? r.available_supplement : r.total), 0),
      sourceData.filter(r => r.confirm === 'Không có liệu').reduce((sum, r) => sum + Number(r.total), 0)
    ];
  };

  // 2. Weekly Stats
  const dayOfWeek = now.getDay() || 7;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));
  const weekData = data.filter(r => new Date(r.created_at) >= startOfWeek);
  const weeklyStats = summarize(weekData);

  // 3. Monthly Stats
  const monthlyStats = summarize(data);

  return {
    daily: {
      labels: dailyLabels,
      count: {
        co: dailyCoCount,
        pu: dailyPuCount,
        fabric: dailyFabricCount,
        no: dailyNoCount
      },
      qty: {
        co: dailyCoQty,
        pu: dailyPuQty,
        fabric: dailyFabricQty,
        no: dailyNoQty
      }
    },
    weekly: weeklyStats,
    monthly: monthlyStats
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

  const bgColors = ['#22c55e', '#f59e0b', '#06b6d4', '#ef4444'];
  const labels = ['Có liệu', 'Có PU - Ko Vải', 'Có Vải - Ko PU', 'Không liệu'];

  charts.dailyQty = new Chart(document.getElementById('chart-daily-qty'), {
    type: 'bar',
    data: {
      labels: stats.daily.labels,
      datasets: [
        { label: '🟢 Có liệu', data: stats.daily.qty.co, backgroundColor: '#22c55e', stack: 'Stack 0' },
        { label: '🟠 Có PU - ko Vải', data: stats.daily.qty.pu, backgroundColor: '#f59e0b', stack: 'Stack 0' },
        { label: '🔵 Có Vải - ko PU', data: stats.daily.qty.fabric, backgroundColor: '#06b6d4', stack: 'Stack 0' },
        { label: '🔴 Không liệu', data: stats.daily.qty.no, backgroundColor: '#ef4444', stack: 'Stack 0' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Tổng số đôi (Qty) theo ngày' },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold' },
          formatter: (value) => value > 0 ? value : ''
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });

  charts.dailyCount = new Chart(document.getElementById('chart-daily'), {
    type: 'bar',
    data: {
      labels: stats.daily.labels,
      datasets: [
        { label: '🟢 Có liệu', data: stats.daily.count.co, backgroundColor: '#22c55e', stack: 'Stack 0' },
        { label: '🟠 Có PU - ko Vải', data: stats.daily.count.pu, backgroundColor: '#f59e0b', stack: 'Stack 0' },
        { label: '🔵 Có Vải - ko PU', data: stats.daily.count.fabric, backgroundColor: '#06b6d4', stack: 'Stack 0' },
        { label: '🔴 Không liệu', data: stats.daily.count.no, backgroundColor: '#ef4444', stack: 'Stack 0' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Tổng số đơn theo ngày' },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold' },
          formatter: (value) => value > 0 ? value : ''
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });

  charts.weekly = new Chart(document.getElementById('chart-weekly'), {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: stats.weekly,
        backgroundColor: bgColors
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
      labels: labels,
      datasets: [{
        data: stats.monthly,
        backgroundColor: bgColors
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

  // Check for stats query param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('stats') === 'true') {
    showStats();
  }

  // Scan Input listeners
  const scanInput = document.getElementById('scan-input');
  const btnAddScan = document.getElementById('btn-add-scan');

  if (scanInput) {
    scanInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleNewRproScan(scanInput.value);
      }
    });

    // Auto-focus after 1s
    setTimeout(() => scanInput.focus(), 1000);
  }

  if (btnAddScan) {
    btnAddScan.addEventListener('click', () => {
      handleNewRproScan(scanInput.value);
    });
  }
});
