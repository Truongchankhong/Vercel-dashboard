// --- DOM elements chung ---
const container        = document.getElementById('table-container');
const detailsContainer = document.getElementById('details-container');
const searchResult     = document.getElementById('searchResult');
const lastUpdatedEl    = document.getElementById('last-updated');

const btnRaw           = document.getElementById('btn-raw');
const btnSummary       = document.getElementById('btn-summary');
const btnProgress      = document.getElementById('btn-progress');
const btnRefresh       = document.getElementById('btn-refresh');
const btnDelayUrgent = document.getElementById('btn-delay-urgent');      // nút đỏ chuyển view
const btnDelayTab = document.getElementById('btn-delay-tab');      // nút tab "Delay"
const btnUrgentTab = document.getElementById('btn-urgent-tab');    // nút tab "Xuất gấp"
const delayTabs      = document.getElementById('delay-tabs');

const delaySearchBox = document.getElementById('delaySearchBox');
const delayColumnSelect = document.getElementById('delayColumnSelect');
const delayBtnSearch = document.getElementById('delayBtnSearch');
const delayBtnClear = document.getElementById('delayBtnClear');
const delaySearchBar = document.getElementById('delay-search-bar');
const delayAdvancedFilter = document.getElementById('delay-advanced-filter');

// Elements cho Progress View
const progressSearchBar = document.getElementById('progress-search-bar');
const progressSearchBox = document.getElementById('progressSearchBox');
const progressBtnSearch = document.getElementById('progressBtnSearch');
const progressBtnClear  = document.getElementById('progressBtnClear');

// đổi tên cho dễ đọc
const headerDisplayMap = {
  'PRO ODER': 'Order Code',
  'Brand Code': 'Brand',
  '#MOLD': 'Loại hàng',
  'Total Qty': 'PO Quantity (Pairs)',
  'STATUS': 'Status-Trạng thái đơn',
  'PU': 'Mã PU',
  'FB': 'Mã Vải',
  'FB DESCRIPTION': 'Tên Vải',
  'LAMINATION MACHINE (PLAN)': 'Plan Machine',
  'LAMINATION MACHINE (REALTIME)': 'Actual Machine',
  'LEANLINE PLAN': 'Plan Machine',
  'LEANLINE (REALTIME)': 'Actual Machine',
  'Check': 'Verify'
};
// Track view hiện tại: 'summary' | 'raw' | 'progress' | 'detail'
let currentView   = 'summary';
let currentMachine = null;

// --- Utility functions ---
function updateTimestamp() {
  lastUpdatedEl.textContent = 'Cập nhật: ' + new Date().toLocaleTimeString();
}
function hideSectionBar() {
  const sectionBarEl = document.getElementById('section-bar');
  if (sectionBarEl) sectionBarEl.innerHTML = '';
}

function setBtnLoading(btn, isLoading) {
  btn.disabled = isLoading;
  if (!btn) return;
  if (btn.id === 'btn-raw') {
    btn.textContent = isLoading ? 'Loading…' : 'Raw View';
  } else if (btn.id === 'btn-summary') {
    btn.textContent = isLoading ? 'Loading…' : 'Summary View';
  } else if (btn.id === 'btn-progress') {
    btn.textContent = isLoading ? 'Loading…' : 'Progress';
  } else if (btn.id === 'btn-refresh') {
    btn.textContent = isLoading ? 'Loading…' : 'Refresh';
  } else if (btn.id === 'progressBtnSearch') {
    btn.textContent = isLoading ? 'Loading…' : 'Tìm Progress';
  }
}

function formatNumber(num) {
  return Number(num).toLocaleString('en-US');
}

function hideDetails() {
  detailsContainer.innerHTML = '';
  detailsContainer.classList.add('hidden');
}

function showDetails() {
  detailsContainer.classList.remove('hidden');
}

// Hiện thanh tìm kiếm cơ bản Progress
function showProgressSearchBar() {
  document.getElementById('basic-search-title').classList.remove('hidden');
  document.getElementById('progress-search-bar').classList.remove('hidden');
}

// Ẩn thanh tìm kiếm cơ bản Progress
function hideProgressSearchBar() {
  document.getElementById('basic-search-title')?.classList.add('hidden');
  document.getElementById('progress-search-bar')?.classList.add('hidden');
}

// Thêm vào đây:

// Hiện thanh tìm kiếm nâng cao Progress
function showProgressAdvancedFilter() {
  document.getElementById('advanced-search-title').classList.remove('hidden');
  document.getElementById('progress-advanced-filter').classList.remove('hidden');
}

// Ẩn thanh tìm kiếm nâng cao Progress
function hideProgressAdvancedFilter() {
  document.getElementById('advanced-search-title')?.classList.add('hidden');
  document.getElementById('progress-advanced-filter')?.classList.add('hidden');
}

// -----------------------------------
// --- SUMMARY VIEW (tổng hợp máy) ---
// -----------------------------------
async function loadSummary() {

   hideAllViews();
  selectedSection = 'LAMINATION';
  renderSectionButtons();
  await renderSummarySection();

  currentView = 'summary';
  currentMachine = null;
  setBtnLoading(btnSummary, true);

  hideDetails();
  hideProgressSearchBar();
  searchResult.innerHTML = '';
  container.innerHTML = '';

  try {
    const res = await fetch('/api/summary', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<div class="text-center py-4">Không có dữ liệu summary</div>';
      return;
    }

    // Phân nhóm có tên máy (non–blank) trước, rồi blank
    const withMachine = data.filter(d => d.machine?.trim());
    const withoutMachine = data.filter(d => !d.machine?.trim());
    withMachine.sort((a, b) => {
      const aNum = parseInt((a.machine.match(/\d+$/) || ['0'])[0], 10);
      const bNum = parseInt((b.machine.match(/\d+$/) || ['0'])[0], 10);
      return aNum - bNum;
    });
    const sorted = [...withMachine, ...withoutMachine];

    let html = `
      <table id="summary-table" class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Pair Plan (Kế hoạch)</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
    `;
    let totalAll = 0;
    sorted.forEach(({ machine, total }) => {
      totalAll += total;
      html += `
        <tr data-machine="${machine}" class="hover:bg-gray-100 cursor-pointer">
          <td class="px-6 py-4 text-sm text-gray-900">${machine || '<blank>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900 text-right">${formatNumber(total)}</td>
        </tr>
      `;
    });
    html += `
        <tr class="font-bold bg-gray-100">
          <td class="px-6 py-3 text-sm text-gray-700 text-right">Tổng cộng:</td>
          <td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(totalAll)}</td>
        </tr>
        </tbody>
      </table>
    `;
    container.innerHTML = html;

    // Khi click vào một máy sẽ load chi tiết (nếu muốn)
    document.querySelectorAll('#summary-table tbody tr[data-machine]').forEach(tr => {
      tr.addEventListener('click', () => {
        const machine = tr.dataset.machine;
        loadDetailsClient(machine);
      });
    });

    updateTimestamp();
  } catch (e) {
    console.error('[ERROR] loadSummary failed:', e);
    container.innerHTML = '<div class="text-center text-red-500 py-4">Lỗi tải dữ liệu summary</div>';
  } finally {
    setBtnLoading(btnSummary, false);
  }
}

// -----------------------------------
// --- PROGRESS VIEW (tiến trình RPRO) ---
// -----------------------------------
async function loadProgress() {
  currentView = 'progress';
  hideAllViews();
  currentMachine = null;
  showProgressSearchBar();
   // Hiện tiêu đề tìm kiếm cơ bản và nâng cao
    document.getElementById('basic-search-title').classList.remove('hidden');
    document.getElementById('advanced-search-title').classList.remove('hidden');

   // Hiện thanh tìm kiếm cơ bản & nâng cao
   showProgressSearchBar();
   showProgressAdvancedFilter();
  // Ẩn các view khác:
  hideDetails();
  container.innerHTML = '';
  searchResult.innerHTML = '';
  updateTimestamp();
  hideSectionBar();
  // Hiện thanh tìm kiếm Progress:
  showProgressSearchBar();
}

async function searchProgress() {
  setBtnLoading(progressBtnSearch, true);
  container.innerHTML = '';
  hideDetails();
  searchResult.innerHTML = '';

  const keyword = progressSearchBox.value.trim().toLowerCase();
  const selectedField = document.getElementById('progressColumnSelect').value;

  // Lấy dữ liệu từ checkbox + input nâng cao
  const inputs = document.querySelectorAll('.progress-input');
  const checks = document.querySelectorAll('.progress-check');
  const filters = {};
  checks.forEach((checkbox) => {
    if (checkbox.checked) {
      const key = checkbox.dataset.key;
      const input = Array.from(inputs).find(i => i.dataset.key === key);
      if (input && input.value.trim()) {
        filters[key] = input.value.trim().toLowerCase();
      }
    }
  });

  try {
    const res = await fetch('/powerapp.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const fields = [
      'PRO ODER', 'Brand Code', '#MOLD', 'BOM' ,'PU','FB', 'Total Qty', 'STATUS',
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)',
      'Molding Pro (IN)', 'Molding Pro', 'IN lean Line (Pro)',
      'IN lean Line (MACHINE)', 'Out lean Line (Pro)',
      'PACKING PRO', 'Packing date', 'Finish date', 'STORED'
    ];

    const dateFields = [
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)',
      'Molding Pro (IN)', 'Molding Pro', 'IN lean Line (Pro)',
      'IN lean Line (MACHINE)', 'Out lean Line (Pro)',
      'PACKING PRO', 'Packing date', 'Finish date', 'STORED'
    ];

    const excelDateToString = (serial) => {
      const base = new Date(1899, 11, 30);
      const date = new Date(base.getTime() + Math.floor(serial) * 86400000);
      return `${String(date.getDate()).padStart(2, '0')}/` +
             `${String(date.getMonth() + 1).padStart(2, '0')}/` +
             `${date.getFullYear()}`;
    };

    // Lọc dữ liệu theo: chọn 1 cột + checkbox nâng cao
    const filtered = data.filter(row => {
      // 1. Lọc cơ bản theo dropdown + ô nhập keyword
      const cell = row[selectedField];
      const cellValue = cell !== undefined && cell !== null
        ? cell.toString().toLowerCase()
        : '';
      const matchBasic = cellValue.includes(keyword);

      // 2. Lọc nâng cao theo các checkbox
      const matchAdvanced = Object.entries(filters).every(([key, val]) => {
        const v = (row[key] || '').toString().toLowerCase();
        return v.includes(val);
      });

      return matchBasic && matchAdvanced;
    });



    if (filtered.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-red-500">Không tìm thấy dữ liệu khớp.</div>`;
      return;
    }

    // Render kết quả
    let html = '<table class="min-w-full table-auto border-collapse">';
    html += '<thead class="bg-gray-50"><tr>';
    html += `<th class="border px-2 py-1 text-left text-sm font-medium text-gray-700">STT</th>`;
    fields.forEach(key => {
      html += `<th class="border px-2 py-1 text-left text-sm font-medium text-gray-700">${key}</th>`;
    });
    html += '</tr></thead><tbody>';

    filtered.forEach((row, idx) => {
      html += '<tr class="hover:bg-gray-100">';
      html += `<td class="border px-2 py-1 text-sm text-gray-800">${idx + 1}</td>`;
      fields.forEach(key => {
        let cell = row[key] ?? '';
        if (dateFields.includes(key)) {
          const serial = Number(cell);
          if (!isNaN(serial) && serial > 0) {
            cell = excelDateToString(serial);
          } else {
            cell = '';
          }
        }
        html += `<td class="border px-2 py-1 text-sm text-gray-800">${cell}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    updateTimestamp();

  } catch (err) {
    console.error('[searchProgress error]', err);
    container.innerHTML = `<div class="text-red-500 text-center py-4">Lỗi tìm tiến trình</div>`;
  } finally {
    setBtnLoading(progressBtnSearch, false);
  }
}




function clearProgressSearch() {
  progressSearchBox.value = '';
  container.innerHTML = '';
}

// -----------------------------------
// --- DETAILS VIEW (nếu cần) ---
// -----------------------------------
function shouldDisplayRow(d, isInitial) {
  const selectedField = document.getElementById('detailsColumnSelect')?.value || '';
  const keyword = document.getElementById('detailsSearchInput')?.value.trim().toUpperCase() || '';

  // Khi click máy lần đầu (không có thao tác tìm kiếm), chỉ lọc theo STATUS
  if (isInitial) {
    return (d['STATUS'] || '').toUpperCase() === `2.${selectedSection.toUpperCase()}`;
  }

  // Nếu chọn "Tất cả" hoặc không nhập gì → hiển thị tất cả
  if (selectedField === 'ALL' || keyword === '') {
    return true;
  }

  // Nếu chọn cột cụ thể và có từ khóa → lọc theo từ khóa
  return (d[selectedField] || '').toString().toUpperCase().includes(keyword);
}async function loadDetailsClient(
  machine,
  isInitial = false,
  rememberedField = 'ALL',
  rememberedKeyword = ''
) {
  currentView = 'detail';
  currentMachine = machine;

  detailsContainer.classList.remove('hidden');
  detailsContainer.innerHTML = '<div class="text-center py-4">Loading chi tiết…</div>';

  try {
    // 1) Lấy nguyên cả JSON
    const res  = await fetch('/powerapp.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 2) Xác định cột Plan / Actual
    const planCol     = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE PLAN'
      : 'LAMINATION MACHINE (PLAN)';
    const realtimeCol = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE (REALTIME)'
      : 'LAMINATION MACHINE (REALTIME)';

    // 3) Xác định statusKeys
    const statusKeys = selectedSection === 'LEANLINE_DC'
      ? ['5.LEAN LINE DC', '6.IN LEAN LINE DC']
      : [`2.${selectedSection.toUpperCase()}`];

    // 4) Lọc data theo máy và status
    const rows = data.filter(row => {
      const rowMachine = row[planCol];
      const rowStatus  = (row['STATUS'] || '').toUpperCase();
      return rowMachine === machine && statusKeys.includes(rowStatus);
    });

    if (rows.length === 0) {
      detailsContainer.innerHTML = `<div class="text-center py-4">
        Không có dữ liệu cho máy ${machine}
      </div>`;
      return;
    }

    // 5) Chọn các cột cần hiển thị
    const selectedColumns = [
      'PRO ODER', 'Brand Code', '#MOLD', 'Total Qty',
      'STATUS', 'PU', 'FB', 'FB DESCRIPTION',
      planCol, realtimeCol, 'Check'
    ];
    // 6) Xây đối tượng từ rows
    const details = rows.map((row, i) => {
      const obj = { STT: i + 1 };
      selectedColumns.forEach(col => {
        obj[col] = row[col] ?? '';
      });
      return obj;
    });

    // 7) Tính % Verify
    const trueCount = details.filter(d =>
      d['Check'] === true || d['Check'] === 'True'
    ).length;
    const percentVerify = ((trueCount / details.length) * 100).toFixed(1);

    // 8) Gán màu theo nhóm PU+FB
    const palette = ['#fef08a','#a7f3d0','#fca5a5','#c4b5fd','#f9a8d4','#fde68a','#bfdbfe','#6ee7b7'];
    const groups = [...new Set(details.map(d => `${d.PU}_${d.FB}`))];
    const colorMap = {};
    groups.forEach((g, idx) => colorMap[g] = palette[idx % palette.length]);

    // 9) Build HTML cho bảng
    const headerDisplayMapWithPlan = {
      ...headerDisplayMap,
      [planCol]: 'Plan Machine',
      [realtimeCol]: 'Actual Machine'
    };

    let tbodyHTML = '';
    details.forEach(d => {
      const bg = colorMap[`${d.PU}_${d.FB}`] || '';
      tbodyHTML += `<tr style="background-color:${bg}"><td class="border px-2 py-1">${d.STT}</td>`;
      selectedColumns.forEach(col => {
        let cls = 'border px-2 py-1';
        if (col === 'FB DESCRIPTION') cls += ' max-w-[180px] break-words';
        if (col === planCol || col === realtimeCol) cls += ' max-w-[150px] truncate';
        tbodyHTML += `<td class="${cls}">${d[col]}</td>`;
      });
      tbodyHTML += '</tr>';
    });

    const optionsHTML = selectedColumns
      .map(opt => {
        const sel = rememberedField === opt ? ' selected' : '';
        return `<option value="${opt}"${sel}>${headerDisplayMapWithPlan[opt]||opt}</option>`;
      }).join('');

    detailsContainer.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">Chi tiết máy: ${machine}</h2>
        <button onclick="hideDetails()" class="text-blue-600 underline">Quay lại</button>
      </div>
      <div class="text-right mb-2 text-sm italic">
        ✅ Tỷ lệ Verify = <b style="color:green;">${percentVerify}%</b>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <select id="detailsColumnSelect" class="col-span-3 border px-2 py-1 rounded">
          <option value="ALL"${rememberedField==='ALL'?' selected':''}>Tất cả (All)</option>
          ${optionsHTML}
        </select>
        <input id="detailsSearchInput" type="text" placeholder="Nhập từ khóa..."
          value="${rememberedKeyword}" class="border px-2 py-1 rounded col-span-2" />
        <div class="flex gap-2 col-span-1">
          <button id="detailsSearchBtn" class="bg-blue-600 text-white px-4 py-1 rounded w-full">Tìm</button>
          <button id="detailsClearBtn" class="bg-gray-400 text-white px-4 py-1 rounded w-full">Xóa</button>
        </div>
      </div>
      <div class="overflow-auto max-h-[70vh] whitespace-nowrap">
        <table class="min-w-full text-sm border border-gray-300 bg-white shadow">
          <thead class="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th class="border px-2 py-1">STT</th>
              ${selectedColumns.map(col => {
                const extra = (col===planCol||col===realtimeCol)
                  ? ' max-w-[150px] truncate'
                  : (col==='FB DESCRIPTION'
                    ? ' max-w-[180px] break-words'
                    : '');
                return `<th class="border px-2 py-1${extra}">${headerDisplayMapWithPlan[col]||col}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>${tbodyHTML}</tbody>
        </table>
      </div>
    `;

    // 10) Gắn event tìm / xóa
    document.getElementById('detailsSearchBtn')
      .addEventListener('click', () => {
        const f  = document.getElementById('detailsColumnSelect').value;
        const kw = document.getElementById('detailsSearchInput').value.trim();
        loadDetailsClient(machine, false, f, kw);
      });
    document.getElementById('detailsClearBtn')
      .addEventListener('click', () => {
        document.getElementById('detailsSearchInput').value = '';
        loadDetailsClient(machine, false, rememberedField, '');
      });

  } catch (err) {
    console.error('DETAILS LOAD ERROR:', err);
    detailsContainer.innerHTML = `<div class="text-red-500 text-center py-4">Lỗi tải dữ liệu</div>`;
  }
}











// -----------------------------------
// --- REFRESH BUTTON (F5) ---
btnRefresh.addEventListener('click', () => {
  window.location.reload();
});

// --- KHỞI TẠO: Đăng ký sự kiện ---

btnSummary.addEventListener('click', loadSummary);
btnProgress.addEventListener('click', loadProgress);

btnDelayUrgent.addEventListener('click', () => {
  hideAllViews();
  delayTabs.classList.remove('hidden');
  loadDelayUrgentData('DELAY'); // Mặc định là Delay

  // Mặc định highlight nút Delay khi mở
  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');
  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});


btnDelayTab.addEventListener('click', () => {
  loadDelayUrgentData('DELAY');
// === STEP 5: Bind button tìm kiếm Delay-Urgent ===
delayBtnSearch.addEventListener('click', () => loadDelayUrgentData('DELAY'));

delayBtnClear.addEventListener('click', () => {
  delaySearchBox.value = '';
  document.querySelectorAll('.delay-input').forEach(i => i.value = '');
  document.querySelectorAll('.delay-check').forEach(c => c.checked = false);
  loadDelayUrgentData('DELAY');
});

  // Highlight nút Delay
  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');

  // Bỏ highlight nút Xuất gấp
  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});


btnUrgentTab.addEventListener('click', () => {
  loadDelayUrgentData('URGENT');

  // Highlight nút Xuất gấp
  btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.remove('bg-gray-300', 'text-black');

  // Bỏ highlight nút Delay
  btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
  btnDelayTab.classList.add('bg-gray-300', 'text-black');
});



progressBtnSearch.addEventListener('click', searchProgress);
progressBtnClear.addEventListener('click', clearProgressSearch);
// ✅ STEP 5: Bind button tìm kiếm Delay-Urgent
delayBtnSearch.addEventListener('click', () => loadDelayUrgentData('DELAY'));

delayBtnClear.addEventListener('click', () => {
  delaySearchBox.value = '';
  document.querySelectorAll('.delay-input').forEach(i => i.value = '');
  document.querySelectorAll('.delay-check').forEach(c => c.checked = false);
  loadDelayUrgentData('DELAY');
});

// Biến toàn cục
let selectedSection = 'LAMINATION';
const sectionButtons = [
  { id: 'btn-lamination', label: 'Lamination', value: 'LAMINATION' },
  { id: 'btn-leanline-dc', label: 'Leanline DC', value: 'LEANLINE_DC' },
  // … các section tiếp theo …
];

// Hàm vẽ nút
function renderSectionButtons() {
  const bar = document.getElementById('section-bar');
  bar.innerHTML = '';
  sectionButtons.forEach(({id, label, value}) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    btn.className = `px-4 py-1 rounded font-medium text-white ${
      selectedSection===value ? 'bg-green-600' : 'bg-gray-400'
    }`;
    btn.onclick = () => {
      selectedSection = value;
      renderSectionButtons();
      renderSummarySection();
    };
    bar.appendChild(btn);
  });
}
async function renderSummarySection() {
  setBtnLoading(btnSummary, true);
  hideDetails();
  hideProgressSearchBar();
  container.innerHTML = '';

  // Vẽ lại Section buttons
  const sectionBarEl = document.getElementById('section-bar');
  if (sectionBarEl) sectionBarEl.innerHTML = '';
  renderSectionButtons();

  try {
    // 1) Fetch dữ liệu
    const res  = await fetch('/powerapp.json', { cache: 'no-store' });
    const data = await res.json();

    // 2) Xác định bộ status keys
    let statusKeys;
    if (selectedSection === 'LEANLINE_DC') {
      statusKeys = ['5.LEAN LINE DC', '6.IN LEAN LINE DC'];
    } else {
      statusKeys = [`2.${selectedSection.toUpperCase()}`];
    }

    // 3) Chọn cột planKey
    const planKey = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE PLAN'
      : 'LAMINATION MACHINE (PLAN)';

    // 4) Gom nhóm theo máy
    const machines = {};
    data.forEach(row => {
      const status  = (row['STATUS']  || '').toUpperCase();
      const machine = row[planKey];
      const qty     = Number(row['Total Qty']) || 0;

      // Lọc theo nhiều statusKey và phải có machine
      if (statusKeys.includes(status) && machine) {
        machines[machine] = (machines[machine] || 0) + qty;
      }
    });

    // 5) Render bảng Summary
    let html = `
      <table class="min-w-full text-sm border border-gray-300 bg-white shadow">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-6 py-3 text-left">MACHINE</th>
            <th class="px-6 py-3 text-right">QUANTITY PAIR PLAN</th>
          </tr>
        </thead>
        <tbody>
    `;
    let totalAll = 0;
    Object.keys(machines).sort().forEach(machine => {
      const qty = machines[machine];
      totalAll += qty;
      html += `
        <tr class="hover:bg-gray-50 cursor-pointer" data-machine="${machine}">
          <td class="px-6 py-3 text-sm text-gray-700">${machine}</td>
          <td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(qty)}</td>
        </tr>
      `;
    });

    // Dòng tổng cộng
    html += `
        <tr class="font-bold bg-gray-100">
          <td class="px-6 py-3 text-sm text-gray-700 text-right">Tổng cộng:</td>
          <td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(totalAll)}</td>
        </tr>
      </tbody>
    </table>
    `;

    container.innerHTML = html;

    // 6) Bắt sự kiện click từng dòng để show detail
    container.querySelectorAll('tbody tr[data-machine]').forEach(row =>
      row.addEventListener('click', () => {
        loadDetailsClient(row.dataset.machine, true);
      })
    );

  } catch (err) {
    console.error('[renderSummarySection error]', err);
    container.innerHTML = `<div class="text-red-500 py-4">Lỗi tải dữ liệu section</div>`;
  } finally {
    setBtnLoading(btnSummary, false);
  }
}




// ==== Đăng ký sự kiện ====

btnSummary.addEventListener('click', loadSummary);
btnProgress.addEventListener('click', loadProgress);
btnRefresh.addEventListener('click', () => window.location.reload());

progressBtnSearch.addEventListener('click', searchProgress);
progressBtnClear.addEventListener('click', clearProgressSearch);
// ✅ STEP 5: Bind button tìm kiếm Delay-Urgent
delayBtnSearch.addEventListener('click', () => loadDelayUrgentData('DELAY'));

delayBtnClear.addEventListener('click', () => {
  delaySearchBox.value = '';
  document.querySelectorAll('.delay-input').forEach(i => i.value = '');
  document.querySelectorAll('.delay-check').forEach(c => c.checked = false);
  loadDelayUrgentData('DELAY');
});

// ✅ Gọi khi load trang xong
window.addEventListener('DOMContentLoaded', () => {
  loadSummary();

  btnSummary.addEventListener('click', loadSummary);
  btnProgress.addEventListener('click', loadProgress);
  btnRefresh.addEventListener('click', () => window.location.reload());

  btnDelayUrgent.addEventListener('click', () => {
    hideAllViews();
    delayTabs.classList.remove('hidden');
    delaySearchBar.classList.remove('hidden');
    delayAdvancedFilter.classList.remove('hidden');
    loadDelayUrgentData('DELAY');

    btnDelayTab.classList.add('bg-yellow-400', 'text-white');
    btnDelayTab.classList.remove('bg-gray-300', 'text-black');
    btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.add('bg-gray-300', 'text-black');
  });

  btnDelayTab.addEventListener('click', () => {
    loadDelayUrgentData('DELAY');

    btnDelayTab.classList.add('bg-yellow-400', 'text-white');
    btnDelayTab.classList.remove('bg-gray-300', 'text-black');
    btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.add('bg-gray-300', 'text-black');
  });

  btnUrgentTab.addEventListener('click', () => {
    loadDelayUrgentData('URGENT');

    btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.remove('bg-gray-300', 'text-black');
    btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
    btnDelayTab.classList.add('bg-gray-300', 'text-black');
  });

  progressBtnSearch.addEventListener('click', searchProgress);
  progressBtnClear.addEventListener('click', clearProgressSearch);

  delayBtnSearch.addEventListener('click', () => loadDelayUrgentData('DELAY'));
  delayBtnClear.addEventListener('click', () => {
    delaySearchBox.value = '';
    document.querySelectorAll('.delay-input').forEach(i => i.value = '');
    document.querySelectorAll('.delay-check').forEach(c => c.checked = false);
    loadDelayUrgentData('DELAY');
  });
});

function hideAllViews() {
  document.getElementById('section-bar').innerHTML = '';
  document.getElementById('searchResult').innerHTML = '';
  document.getElementById('table-container').innerHTML = '';
  document.getElementById('details-container').classList.add('hidden');
  document.getElementById('progress-search-bar').classList.add('hidden');
  document.getElementById('progress-advanced-filter').classList.add('hidden');
  document.getElementById('basic-search-title')?.classList.add('hidden');
  document.getElementById('advanced-search-title')?.classList.add('hidden');
  document.getElementById('delay-tabs')?.classList.add('hidden');
  document.getElementById('delay-search-bar')?.classList.add('hidden');
  document.getElementById('delay-advanced-filter')?.classList.add('hidden');
}
function formatExcelDate(serial) {
  if (!serial || isNaN(serial)) return '';
  const base = new Date(1899, 11, 30);
  const date = new Date(base.getTime() + serial * 86400000);
  return `${String(date.getDate()).padStart(2, '0')}/` +
         `${String(date.getMonth() + 1).padStart(2, '0')}/` +
         `${date.getFullYear()}`;
}

function loadDelayUrgentData(type) {
  fetch('/powerapp.json')
    .then(res => res.json())
    .then(data => {

      const keyword = delaySearchBox.value.trim().toLowerCase();
      const selectedField = delayColumnSelect.value;

      // Lọc theo điều kiện nâng cao
      const inputs = document.querySelectorAll('.delay-input');
      const checks = document.querySelectorAll('.delay-check');
      const filters = {};
      checks.forEach(chk => {
        if (chk.checked) {
          const key = chk.dataset.key;
          const input = [...inputs].find(i => i.dataset.key === key);
          if (input && input.value.trim()) filters[key] = input.value.trim().toLowerCase();
        }
      });

      const filtered = data.filter(row => {
        const delayVal = (row['Delay/Urgent'] || '').toUpperCase();
        if ((type === 'DELAY' && delayVal !== 'PRODUCTION DELAY') || (type === 'URGENT' && delayVal !== 'URGENT')) return false;

        const main = (row[selectedField] || '').toString().toLowerCase();
        const matchBasic = !keyword || main.includes(keyword);

        const matchAdvanced = Object.entries(filters).every(([k, v]) => {
          return (row[k] || '').toString().toLowerCase().includes(v);
        });

        return matchBasic && matchAdvanced;
      });

      const headers = ['STT', 'PRO ODER', 'Brand Code', 'Loại hàng', 'Mã khuôn', 'BOM', 'Total Qty', 'Finish date', 'PPC Confirm', 'STORED', 'STATUS'];

      let html = `
        <table class="min-w-full text-sm text-left border">
          <thead class="bg-gray-200">
            <tr>${headers.map(h => `<th class="px-2 py-1 border">${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filtered.map((row, i) => {
              const finishDate = row['Finish date'];
              const ppcConfirm = row['PPC Confirm'];
              const stored = row['STORED'];

              return `
                <tr>
                  <td class="border px-2 py-1">${i + 1}</td>
                  <td class="border px-2 py-1">${row['PRO ODER'] || ''}</td>
                  <td class="border px-2 py-1">${row['Brand Code'] || ''}</td>
                  <td class="border px-2 py-1">${row['#MOLDED'] || ''}</td>
                  <td class="border px-2 py-1">${row['#MOLD']      || ''}</td>
                  <td class="border px-2 py-1">${row['BOM'] || ''}</td>
                  <td class="border px-2 py-1">${row['Total Qty'] || ''}</td>
                  <td class="border px-2 py-1">${formatExcelDate(Number(finishDate))}</td>
                  <td class="border px-2 py-1">${formatExcelDate(Number(ppcConfirm))}</td>
                  <td class="border px-2 py-1">${formatExcelDate(Number(stored))}</td>
                  <td class="border px-2 py-1">${row['STATUS'] || ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      document.getElementById('table-container').innerHTML = html;
    });
}

function hideDelayUrgentButtons() {
  btnDelay.classList.add('hidden');
  btnUrgent.classList.add('hidden');
}
// ==== Load Delay hoặc Urgent View ====
function loadDelayUrgentView(type) {
 // 1. Ẩn sạch mọi view cũ
  hideAllViews();

  // 2. Hiện tiêu đề tìm kiếm
  document.getElementById('basic-search-title').classList.remove('hidden');
  document.getElementById('advanced-search-title').classList.remove('hidden');
  
  delayTabs.classList.remove('hidden');
  delaySearchBar.classList.remove('hidden');
  delayAdvancedFilter.classList.remove('hidden');
  // Ẩn các phần khác

    document.getElementById('progress-search-bar').classList.add('hidden');
    document.getElementById('progress-advanced-filter').classList.add('hidden');
    document.getElementById('section-bar').classList.add('hidden');
    document.getElementById('details-container').classList.add('hidden');
    document.getElementById('searchResult').innerHTML = '';
    document.getElementById('table-container').innerHTML = '';


  // Hiện bảng chính
  const container = document.getElementById('table-container');
  container.innerHTML = '';

  // Đổi màu nút
  document.getElementById('btn-delay').classList.remove('bg-red-500');
  document.getElementById('btn-urgent').classList.remove('bg-red-500');
  if (type === 'DELAY') {
    document.getElementById('btn-delay').classList.add('bg-red-500');
  } else {
    document.getElementById('btn-urgent').classList.add('bg-red-500');
  }

  // Lọc dữ liệu
  const table = document.createElement('table');
  table.className = 'min-w-full table-auto border border-gray-300';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr class="bg-gray-200 text-left">
      <th class="border px-2 py-1">STT</th>
      <th class="border px-2 py-1">PRO ODER</th>
      <th class="border px-2 py-1">Brand Code</th>
      <th class="border px-2 py-1">#MOLDED</th>
      <th class="border px-2 py-1">BOM</th>
      <th class="border px-2 py-1">Total Qty</th>
      <th class="border px-2 py-1">Finish Date</th>
      <th class="border px-2 py-1">PPC Confirm</th>
      <th class="border px-2 py-1">STORED</th>
      <th class="border px-2 py-1">STATUS</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let filtered = jsonData.filter(row => (row['Delay/Urgent'] || '').toUpperCase() === type);

  filtered.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-2 py-1">${i + 1}</td>
      <td class="border px-2 py-1">${row['PRO ODER'] || ''}</td>
      <td class="border px-2 py-1">${row['Brand Code'] || ''}</td>
      <td class="border px-2 py-1">${row['#MOLDED'] || ''}</td>
      <td class="border px-2 py-1">${row['BOM'] || ''}</td>
      <td class="border px-2 py-1">${row['Total Qty'] || ''}</td>
      <td class="border px-2 py-1">${row['Finish date'] || ''}</td>
      <td class="border px-2 py-1">${row['PPC Confirm'] || ''}</td>
      <td class="border px-2 py-1">${row['STORED'] || ''}</td>
      <td class="border px-2 py-1">${row['STATUS'] || ''}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}
// Xử lý đổi màu khi chọn Delay hoặc Xuất gấp


// Sự kiện nút Delay
btnDelayTab.addEventListener('click', () => {
  loadDelayUrgentData('DELAY');

  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');

  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});

// Sự kiện nút Xuất gấp
btnUrgentTab.addEventListener('click', () => {
  loadDelayUrgentData('URGENT');

  btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.remove('bg-gray-300', 'text-black');

  btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
  btnDelayTab.classList.add('bg-gray-300', 'text-black');
});
