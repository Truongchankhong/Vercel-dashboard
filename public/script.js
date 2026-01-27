// Lấy createClient từ global supabase (đã load bằng <script> trong index.html)
const { createClient } = window.supabase;

// Khai báo Supabase (Phải khớp với dự án mới)
const supabaseUrl = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
export const supabase = createClient(supabaseUrl, supabaseKey);
window.supabaseClient = supabase;

// --- Helper: Fetch all data from Supabase (pagination) ---
async function fetchAllPowerAppData() {
  let allRows = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('powerapp')
      .select('*')
      .range(from, from + step - 1);

    if (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);

    if (data.length < step) break;
    from += step;
  }
  return { data: allRows };
}


// --- DOM elements chung ---
const container = document.getElementById('table-container');
const detailsContainer = document.getElementById('details-container');
const searchResult = document.getElementById('searchResult');
const lastUpdatedEl = document.getElementById('lastPushTime'); // Corrected ID

// --- Fetch Last Update Time ---
async function fetchLastPushTime() {
  if (!lastUpdatedEl) return;
  try {
    const { data, error } = await supabase
      .from('powerapp')
      .select('"Finish date"') // Use existing column
      .eq('STT', -1) // Metadata record (Numeric)
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0 && data[0]['Finish date']) {
      // Format time
      const date = new Date(data[0]['Finish date']);
      // Format: Wed 01/14/2026 11:01:43
      const formatted = date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      lastUpdatedEl.textContent = formatted;
    } else {
      lastUpdatedEl.textContent = "Chưa có dữ liệu";
    }
  } catch (err) {
    console.error("Error fetching last update:", err);
    lastUpdatedEl.textContent = "Lỗi tải thời gian";
  }
}
// Call immediately
fetchLastPushTime();


const btnRaw = document.getElementById('btn-raw');
const btnSummary = document.getElementById('btn-summary');
const btnProgress = document.getElementById('btn-progress');
const btnRefresh = document.getElementById('btn-refresh');
const btnDelayUrgent = document.getElementById('btn-delay-urgent');      // nút đỏ chuyển view
const btnDelayTab = document.getElementById('btn-delay-tab');      // nút tab "Delay"
const btnUrgentTab = document.getElementById('btn-urgent-tab');    // nút tab "Xuất gấp"
const delayTabs = document.getElementById('delay-tabs');

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
const progressBtnClear = document.getElementById('progressBtnClear');
const progressBtnExport = document.getElementById('progressBtnExport');

// Xử lý khi quét QR Progress
function handleProgressQR(text) {
  const cleanText = (text || "").trim();
  let rpro = "";

  if (cleanText.includes("|")) {
    // Nếu QR chứa SO|RPRO
    const parts = cleanText.split("|");
    const rproPart = parts.find(p => p.startsWith("RPRO"));
    rpro = rproPart || cleanText;
  } else {
    // Nếu QR chỉ có 1 phần
    if (cleanText.startsWith("RPRO")) {
      rpro = cleanText;
    } else {
      alert("❌ Mã QR không hợp lệ: " + cleanText);
      return;
    }
  }

  // Gán vào ô tìm kiếm và tự động tìm kiếm
  document.getElementById("progressSearchBox").value = rpro;
  searchProgress();
}

// --- QR Scan for Progress View ---
const progressBtnScan = document.getElementById('progressBtnScan');
const progressQrReader = document.getElementById('progress-qr-reader');
let html5QrScanner = null;

progressBtnScan?.addEventListener('click', () => {
  progressQrReader.classList.remove('hidden');

  if (!html5QrScanner) {
    html5QrScanner = new Html5Qrcode("progress-qr-reader");
  }

  html5QrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 200 },
    (decodedText) => {
      console.log("Scanned:", decodedText);
      html5QrScanner.stop();
      progressQrReader.classList.add('hidden');

      // ✅ Gọi hàm xử lý để lấy RPRO
      handleProgressQR(decodedText);
    },
    (errorMessage) => {
      // Lỗi scan, bỏ qua
    }
  ).catch(err => {
    console.error("QR start failed", err);
  });
});



const delayErrorOnly = document.getElementById('delayErrorOnly');
// Và biến lưu kiểu hiện tại của bảng Delay (DELAY hoặc URGENT):
let currentDelayType = 'DELAY';

// đổi tên cho dễ đọc
// đổi tên cho dễ đọc
const headerDisplayMap = {
  'PRO ODER': 'Order Code',
  'Brand Code': 'Brand',
  '#MOLD': 'Loại hàng',
  'Total Qty': 'PO Quantity (Pairs)',
  'Delay/Urgent': 'Delay/Urgent',    // ← add this line
  'STATUS': 'Status – Trạng thái đơn',
  'PU': 'Mã PU',
  'FB': 'Mã Vải',
  'FB DESCRIPTION': 'Tên Vải',
  'LAMINATION MACHINE (PLAN)': 'Plan Machine',
  'LAMINATION MACHINE (REALTIME)': 'Actual Machine',
  'LEANLINE PLAN': 'Plan Machine',
  'LEANLINE (REALTIME)': 'Actual Machine',
  'Check': 'Verify',
  'CheckLL': 'Verify'
};


// Track view hiện tại: 'summary' | 'raw' | 'progress' | 'detail'
let currentView = 'summary';
let currentMachine = null;

// --- Utility functions ---
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

// ← Chèn ngay dưới đây
function showDelaySearchWidgets() {
  document.getElementById('delay-basic-search-title').classList.remove('hidden');
  document.getElementById('delay-search-bar').classList.remove('hidden');
  document.getElementById('delay-advanced-search-title').classList.remove('hidden');
  document.getElementById('delay-advanced-filter').classList.remove('hidden');
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

  // 1) thiết lập section mặc định là Lamination
  selectedSection = 'LAMINATION';

  // 2) vẽ lại nút Lamination/Leanline
  renderSectionButtons();

  // 3) vẽ bảng Section summary (có cột SỐ TẤM nếu là Lamination)
  await renderSummarySection();

  // 4) đánh dấu view hiện tại
  currentView = 'summary';
  currentMachine = null;
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
    // → fetch data from Supabase
    // const res  = await fetch('/powerapp.json', { cache: 'no-store' });
    // if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // const json = await res.json();
    const json = await fetchAllPowerAppData();
    const data = json.data;

    const fields = [
      'PRO ODER', 'Total Qty', 'Finish date', 'Molding (PPC)', 'Molding Pro (IN)', 'Molding Pro', 'STATUS', 'Brand Code', '#MOLD', 'BOM', 'PU', 'FB', ,
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)', 'IN lean Line (Pro)',
      'IN lean Line (MACHINE)', 'Out lean Line (Pro)',
      'PACKING PRO', 'Packing date', 'STORED'
    ];

    const dateFields = [
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)', 'Molding (PPC)',
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


  } catch (err) {
    console.error('[searchProgress error]', err);
    container.innerHTML = `<div class="text-red-500 text-center py-4">Lỗi tìm tiến trình</div>`;
  } finally {
    setBtnLoading(progressBtnSearch, false);
  }
}

async function exportProgressToExcel() {
  setBtnLoading(progressBtnExport, true);

  const keyword = progressSearchBox.value.trim().toLowerCase();
  const selectedField = document.getElementById('progressColumnSelect').value;
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
    const json = await fetchAllPowerAppData();
    const data = json.data;

    const fields = [
      'PRO ODER', 'Total Qty', 'Finish date', 'Molding (PPC)', 'Molding Pro (IN)', 'Molding Pro', 'STATUS', 'Brand Code', '#MOLD', 'BOM', 'PU', 'FB',
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)', 'IN lean Line (Pro)',
      'IN lean Line (MACHINE)', 'Out lean Line (Pro)',
      'PACKING PRO', 'Packing date', 'STORED'
    ];

    const dateFields = [
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)', 'Molding (PPC)',
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

    // Lọc dữ liệu
    const filtered = data.filter(row => {
      const cell = row[selectedField];
      const cellValue = cell !== undefined && cell !== null ? cell.toString().toLowerCase() : '';
      const matchBasic = cellValue.includes(keyword);
      const matchAdvanced = Object.entries(filters).every(([key, val]) => {
        const v = (row[key] || '').toString().toLowerCase();
        return v.includes(val);
      });
      return matchBasic && matchAdvanced;
    });

    if (filtered.length === 0 && (keyword || Object.keys(filters).length > 0)) {
      alert("Không có dữ liệu để xuất!");
      return;
    }

    // Chuẩn bị dữ liệu cho ExcelJS/SheetJS
    // SheetJS hoạt động tốt với mảng các mảng (AoA) hoặc mảng các đối tượng
    const excelData = filtered.map((row, idx) => {
      const newRow = { 'STT': idx + 1 };
      fields.forEach(key => {
        let val = row[key] ?? '';
        if (dateFields.includes(key) && val) {
          const serial = Number(val);
          if (!isNaN(serial) && serial > 0) {
            val = excelDateToString(serial);
          }
        }
        newRow[key] = val;
      });
      return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Progress");

    // Xuất file
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Progress_Export_${dateStr}.xlsx`);

  } catch (err) {
    console.error('[exportProgress error]', err);
    alert('Lỗi xuất Excel: ' + err.message);
  } finally {
    setBtnLoading(progressBtnExport, false);
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
} async function loadDetailsClient(
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
    // 1) Fetch data from Supabase
    // const res = await fetch('/powerapp.json', { cache: 'no-store' });
    // if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // const json     = await res.json();
    const json = await fetchAllPowerAppData();
    const fullData = json.data;

    // 2) Xác định các cột Plan / Actual / Verify
    const planCol = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE PLAN'
      : 'LAMINATION MACHINE (PLAN)';
    const realtimeCol = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE (REALTIME)'
      : 'LAMINATION MACHINE (REALTIME)';
    const verifyCol = selectedSection === 'LEANLINE_DC'
      ? 'CheckLL'
      : 'Check';

    // 3) (Không dùng statusKeys ở đây vì chỉ hiển thị theo máy)
    // const statusKeys = selectedSection === 'LEANLINE_DC'
    //   ? ['5.LEAN LINE DC', '6.IN LEAN LINE DC']
    //   : [`2.${selectedSection.toUpperCase()}`];

    // 4) Lọc bản ghi cho máy hiện tại
    const rows = fullData.filter(row => row[planCol] === machine);

    if (rows.length === 0) {
      detailsContainer.innerHTML = `
        <div class="text-center py-4">
          Không có dữ liệu cho máy ${machine}
        </div>`;
      return;
    }

    // 5) Chọn các cột cần hiển thị
    const selectedColumns = [
      'PRO ODER',
      'Brand Code',
      '#MOLD',
      'Delay/Urgent',
      'Total Qty',
      'STATUS',
      'PU',
      'FB',
      'FB DESCRIPTION',
      planCol,
      realtimeCol,
      verifyCol
    ];

    // 6) Xây array details với STT và các trường đã chọn
    const details = rows.map((row, i) => {
      const obj = { STT: i + 1 };
      selectedColumns.forEach(col => {
        obj[col] = row[col] ?? '';
      });
      return obj;
    });

    // 7) Áp filter initial / tìm kiếm
    const filtered = details.filter(d => {
      if (isInitial) {
        // initial: chỉ show các đơn chưa có Actual Machine
        return !(d[realtimeCol] || '').toString().trim();
      }
      if (rememberedField === 'ALL' || !rememberedKeyword.trim()) {
        return true;
      }
      return ('' + d[rememberedField])
        .toUpperCase()
        .includes(rememberedKeyword.trim().toUpperCase());
    });

    // 8) Tính phần trăm Verify
    const validRows = details.filter(d =>
      d[verifyCol] === true || d[verifyCol] === 'True' ||
      d[verifyCol] === false || d[verifyCol] === 'False'
    );
    const trueCount = validRows.filter(d =>
      d[verifyCol] === true || d[verifyCol] === 'True'
    ).length;
    const percentVerify = validRows.length
      ? ((trueCount / validRows.length) * 100).toFixed(1)
      : '0.0';

    // 9) Gán màu nhóm theo PU + FB
    const palette = ['#fef08a', '#a7f3d0', '#fca5a5', '#c4b5fd', '#f9a8d4', '#fde68a', '#bfdbfe', '#6ee7b7'];
    const groups = [...new Set(details.map(d => `${d.PU}_${d.FB}`))];
    const colorMap = {};
    groups.forEach((g, idx) => {
      colorMap[g] = palette[idx % palette.length];
    });

    // 10) Build HTML chi tiết
    const headerMap = {
      ...headerDisplayMap,
      [planCol]: 'Plan Machine',
      [realtimeCol]: 'Actual Machine',
      [verifyCol]: 'Verify'
    };

    let tbodyHTML = '';
    filtered.forEach(d => {
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

    const optionsHTML = selectedColumns.map(opt => {
      const sel = rememberedField === opt ? ' selected' : '';
      return `<option value="${opt}"${sel}>${headerMap[opt] || opt}</option>`;
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
          <option value="ALL"${rememberedField === 'ALL' ? ' selected' : ''}>Tất cả (All)</option>
          ${optionsHTML}
        </select>
        <input id="detailsSearchInput" type="text" placeholder="Nhập từ khóa..."
          value="${rememberedKeyword}" class="border px-2 py-1 rounded col-span-2" />
        <div class="flex gap-2 col-span-1">
          <button id="detailsSearchBtn" class="bg-blue-600 text-white px-4 py-1 rounded w-full">Tìm</button>
          <button id="detailsClearBtn"  class="bg-gray-400 text-white px-4 py-1 rounded w-full">Xóa</button>
        </div>
      </div>
      <div class="overflow-auto max-h-[70vh]">
        <table id="detailsTable" class="min-w-full table-fixed text-sm border border-gray-300 bg-white shadow">
          <thead class="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th class="border px-2 py-1">STT</th>
              ${selectedColumns.map(col => {
      const extra = (col === planCol || col === realtimeCol)
        ? ' max-w-[150px] truncate'
        : (col === 'FB DESCRIPTION'
          ? ' max-w-[180px] break-words'
          : '');
      return `<th class="border px-2 py-1${extra}">${headerMap[col] || col}</th>`;
    }).join('')}
            </tr>
          </thead>
          <tbody>${tbodyHTML}</tbody>
        </table>
      </div>
    `;

    // 11) Gắn event cho Tìm / Xóa
    document.getElementById('detailsSearchBtn')
      .addEventListener('click', () => {
        const f = document.getElementById('detailsColumnSelect').value;
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
  // Hiện tiêu đề & thanh tìm kiếm cơ bản + nâng cao
  document.getElementById('delay-basic-search-title').classList.remove('hidden');
  document.getElementById('delay-advanced-search-title').classList.remove('hidden');

  delaySearchBar.classList.remove('hidden');
  delayAdvancedFilter.classList.remove('hidden');

  loadDelayUrgentData('DELAY');

  // Mặc định highlight nút Delay khi mở
  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');
  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});


// Sự kiện nút Delay
btnDelayTab.addEventListener('click', () => {
  currentDelayType = 'DELAY';
  hideAllViews();
  delayTabs.classList.remove('hidden');
  showDelaySearchWidgets();
  loadDelayUrgentData('DELAY');

  // highlight nút
  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');
  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});

// Sự kiện nút Xuất gấp
btnUrgentTab.addEventListener('click', () => {
  currentDelayType = 'URGENT';
  hideAllViews();
  delayTabs.classList.remove('hidden');
  showDelaySearchWidgets();
  loadDelayUrgentData('URGENT');

  // highlight nút
  btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.remove('bg-gray-300', 'text-black');
  btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
  btnDelayTab.classList.add('bg-gray-300', 'text-black');
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
  sectionButtons.forEach(({ id, label, value }) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    btn.className = `px-4 py-1 rounded font-medium text-white ${selectedSection === value ? 'bg-green-600' : 'bg-gray-400'
      }`;
    btn.onclick = () => {
      selectedSection = value;
      renderSectionButtons();
      renderSummarySection();
    };
    bar.appendChild(btn);
  });

}
function getDelayUrgentQty(machine, data) {
  const planKey = selectedSection === 'LEANLINE_DC'
    ? 'LEANLINE PLAN'
    : 'LAMINATION MACHINE (PLAN)';

  return data.reduce((sum, row) => {
    const status = (row['STATUS'] || '').toUpperCase();
    const delayType = (row['Delay/Urgent'] || '').toUpperCase();
    const qty = Number(row['Total Qty']) || 0;
    if (
      row[planKey] === machine &&
      (delayType === 'URGENT' || delayType === 'PRODUCTION DELAY') &&
      (
        (selectedSection === 'LEANLINE_DC' && ['5.LEAN LINE DC', '6.IN LEAN LINE DC'].includes(status)) ||
        (selectedSection !== 'LEANLINE_DC' && status === `2.${selectedSection.toUpperCase()}`)
      )
    ) {
      return sum + qty;
    }
    return sum;
  }, 0);
} async function renderSummarySection() {
  setBtnLoading(btnSummary, true);
  hideDetails();
  hideProgressSearchBar();
  container.innerHTML = '';

  // Làm mới thanh chọn section
  const sectionBarEl = document.getElementById('section-bar');
  if (sectionBarEl) sectionBarEl.innerHTML = '';
  renderSectionButtons();

  try {
    // const res = await fetch('/powerapp.json', { cache: 'no-store' });
    // if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // const json = await res.json();
    const json = await fetchAllPowerAppData();
    const data = json.data;

    // 🧩 Chọn cột máy và trạng thái cần lọc
    const planKey =
      selectedSection === 'LEANLINE_DC'
        ? 'LEANLINE PLAN'
        : 'LAMINATION MACHINE (PLAN)';

    const statusFilter =
      selectedSection === 'LEANLINE_DC'
        ? '6.WIP IN LEAN LINE'
        : '2.MATERIAL CHƯA DÁN';

    // 🧩 Tên cột Delay/Urgent (đúng như JSON)
    const delayKey = 'Delay-Urgent';

    // 🧩 Gom nhóm dữ liệu
    const machines = {};
    const delayCounts = {};
    const sheetCounts = {};

    data.forEach(row => {
      const machine = row[planKey];
      const status = (row['STATUS'] || '').trim().toUpperCase();
      const delayFlag = (row[delayKey] || '').trim().toUpperCase();
      const qty = Number(row['Total Qty']) || 0;
      const sheets = Number(row['DL PU']) || 0;

      // ✅ 1. Cộng tổng kế hoạch theo Status (QUANTITY PAIR PLAN)
      if (status === statusFilter.toUpperCase() && machine) {
        machines[machine] = (machines[machine] || 0) + qty;
        if (selectedSection === 'LAMINATION') {
          sheetCounts[machine] = (sheetCounts[machine] || 0) + sheets;
        }
      }

      // ✅ 2. Cộng tổng Delay/Urgent theo DelayFlag
      if (
        machine &&
        ['PRODUCTION DELAY', 'URGENT'].includes(delayFlag)
      ) {
        delayCounts[machine] = (delayCounts[machine] || 0) + qty;
      }
    });

    // 🧮 Render bảng
    let html = `
      <table class="min-w-full text-sm border border-gray-300 bg-white shadow">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-6 py-3 text-left">MACHINE</th>
            <th class="px-6 py-3 text-right">QUANTITY PAIR PLAN</th>
            <th class="px-6 py-3 text-right text-red-600">Delay/Urgent</th>
            ${selectedSection === 'LAMINATION'
        ? `<th class="px-6 py-3 text-right">SỐ TẤM (SHEET)</th>`
        : ''}
          </tr>
        </thead>
        <tbody>
    `;

    let totalQty = 0;
    let totalDelay = 0;
    let totalSheets = 0;

    Object.keys({ ...machines, ...delayCounts })
      .sort()
      .forEach(machine => {
        const qty = machines[machine] || 0;
        const delay = delayCounts[machine] || 0;
        const sheets = sheetCounts[machine] || 0;

        totalQty += qty;
        totalDelay += delay;
        totalSheets += sheets;

        html += `
          <tr class="hover:bg-gray-50 cursor-pointer" data-machine="${machine}">
            <td class="px-6 py-3 text-sm text-gray-700">${machine}</td>
            <td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(qty)}</td>
            <td class="px-6 py-3 text-sm text-right text-red-600 font-semibold">${formatNumber(delay)}</td>
            ${selectedSection === 'LAMINATION'
            ? `<td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(sheets)}</td>`
            : ''
          }
          </tr>
        `;
      });

    html += `
        <tr class="font-bold bg-gray-100">
          <td class="px-6 py-3 text-right">Tổng cộng:</td>
          <td class="px-6 py-3 text-right">${formatNumber(totalQty)}</td>
          <td class="px-6 py-3 text-right text-red-600 font-semibold">${formatNumber(totalDelay)}</td>
          ${selectedSection === 'LAMINATION'
        ? `<td class="px-6 py-3 text-right">${formatNumber(totalSheets)}</td>`
        : ''
      }
        </tr>
      </tbody>
      </table>
    `;

    container.innerHTML = html;

    // Gắn sự kiện click xem chi tiết máy
    container.querySelectorAll('tbody tr[data-machine]').forEach(row =>
      row.addEventListener('click', () => {
        const m = row.getAttribute('data-machine');
        loadDetailsClient(m, true);
      })
    );

    console.log(`✅ Summary hiển thị cho ${selectedSection}, STATUS = ${statusFilter}, cột Delay/Urgent = ${delayKey}`);

  } catch (err) {
    console.error('[renderSummarySection error]', err);
    container.innerHTML = `
      <div class="text-red-500 py-4">
        ⚠️ Lỗi tải dữ liệu section
      </div>
    `;
  } finally {
    setBtnLoading(btnSummary, false);
  }
}



// ✅ Gọi khi load trang xong
window.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  fetchLastPushTime();

  btnSummary.addEventListener('click', loadSummary);
  btnProgress.addEventListener('click', loadProgress);
  btnRefresh.addEventListener('click', () => window.location.reload());

  progressBtnSearch.addEventListener('click', searchProgress);
  progressBtnClear.addEventListener('click', clearProgressSearch);
  progressBtnExport.addEventListener('click', exportProgressToExcel);

  delayBtnSearch.addEventListener('click', () => loadDelayUrgentData(currentDelayType));
  delayBtnClear.addEventListener('click', () => {
    delaySearchBox.value = '';
    document.querySelectorAll('.delay-input').forEach(i => i.value = '');
    document.querySelectorAll('.delay-check').forEach(c => c.checked = false);
    loadDelayUrgentData(currentDelayType);
  });

  btnDelayUrgent.addEventListener('click', () => {
    hideAllViews();
    delayTabs.classList.remove('hidden');
    currentDelayType = 'DELAY';

    // Hiện tiêu đề tìm kiếm cơ bản & nâng cao cho Delay
    document.getElementById('delay-basic-search-title').classList.remove('hidden');
    document.getElementById('delay-advanced-search-title').classList.remove('hidden');

    delaySearchBar.classList.remove('hidden');
    delayAdvancedFilter.classList.remove('hidden');
    loadDelayUrgentData('DELAY');

    btnDelayTab.classList.add('bg-yellow-400', 'text-white');
    btnDelayTab.classList.remove('bg-gray-300', 'text-black');
    btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.add('bg-gray-300', 'text-black');
  });

  // Sự kiện nút Delay
  btnDelayTab.addEventListener('click', () => {
    currentDelayType = 'DELAY';
    hideAllViews();
    delayTabs.classList.remove('hidden');
    showDelaySearchWidgets();
    loadDelayUrgentData('DELAY');

    // highlight nút
    btnDelayTab.classList.add('bg-yellow-400', 'text-white');
    btnDelayTab.classList.remove('bg-gray-300', 'text-black');
    btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.add('bg-gray-300', 'text-black');
  });

  // Sự kiện nút Xuất gấp
  btnUrgentTab.addEventListener('click', () => {
    currentDelayType = 'URGENT';
    hideAllViews();
    delayTabs.classList.remove('hidden');
    showDelaySearchWidgets();
    loadDelayUrgentData('URGENT');

    // highlight nút
    btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.remove('bg-gray-300', 'text-black');
    btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
    btnDelayTab.classList.add('bg-gray-300', 'text-black');
  });

  delayErrorOnly.addEventListener('change', () => {
    loadDelayUrgentData(currentDelayType);
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
  document.getElementById('delay-basic-search-title')?.classList.add('hidden');
  document.getElementById('delay-advanced-search-title')?.classList.add('hidden');
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



async function loadDelayUrgentData(type) {
  try {
    const json = await fetchAllPowerAppData();
    const data = json.data;
    const keyword = delaySearchBox.value.trim().toLowerCase();
    const selectedField = delayColumnSelect.value;
    const errorOnly = delayErrorOnly.checked;

    // Lọc theo điều kiện nâng cao
    const inputs = document.querySelectorAll('.delay-input');
    const checks = document.querySelectorAll('.delay-check');
    const filters = {};
    checks.forEach(chk => {
      if (chk.checked) {
        const key = chk.dataset.key;
        const input = [...inputs].find(i => i.dataset.key === key);
        if (input && input.value.trim()) {
          filters[key] = input.value.trim().toLowerCase();
        }
      }
    });

    // Lọc chính
    let filtered = data.filter(row => {
      const delayVal = (row['Delay/Urgent'] || '').toUpperCase();
      // Chọn DELAY hay URGENT
      if ((type === 'DELAY' && delayVal !== 'PRODUCTION DELAY') ||
        (type === 'URGENT' && delayVal !== 'URGENT')) {
        return false;
      }

      // Basic search
      const main = (row[selectedField] || '').toString().toLowerCase();
      if (keyword && !main.includes(keyword)) return false;

      // Advanced filters
      for (let [k, v] of Object.entries(filters)) {
        if (!(row[k] || '').toString().toLowerCase().includes(v)) {
          return false;
        }
      }

      // Nếu check “Chỉ lỗi” thì chỉ lấy status ≠ 7.PACKING & ≠ 9.STORED
      if (errorOnly) {
        const st = (row['STATUS'] || '').toUpperCase();
        if (st === '7.PACKING' || st === '9.STORED') return false;
      }

      return true;
    });

    // Tạo table
    const headers = [
      'STT', 'PRO ODER', 'Brand Code', 'Loại hàng', 'Mã khuôn',
      'BOM', 'Total Qty', 'Finish date', 'PPC Confirm', 'STORED', 'STATUS'
    ];
    let html = `
        <table class="min-w-full text-sm text-left border">
          <thead class="bg-gray-200">
            <tr>${headers
        .map(h => `<th class="px-2 py-1 border">${h}</th>`)
        .join('')}
            </tr>
          </thead>
          <tbody>
      `;
    html += filtered.map((row, i) => {
      const status = row['STATUS'] || '';
      const highlight = (!errorOnly && status !== '7.PACKING' && status !== '9.STORED')
        ? 'bg-red-100'
        : '';
      return `
          <tr class="${highlight}">
            <td class="border px-2 py-1">${i + 1}</td>
            <td class="border px-2 py-1">${row['PRO ODER'] || ''}</td>
            <td class="border px-2 py-1">${row['Brand Code'] || ''}</td>
            <td class="border px-2 py-1">${row['#MOLDED'] || ''}</td>
            <td class="border px-2 py-1">${row['#MOLD'] || ''}</td>
            <td class="border px-2 py-1">${row['BOM'] || ''}</td>
            <td class="border px-2 py-1">${row['Total Qty'] || ''}</td>
            <td class="border px-2 py-1">${formatExcelDate(Number(row['Finish date']))}</td>
            <td class="border px-2 py-1">${formatExcelDate(Number(row['PPC Confirm']))}</td>
            <td class="border px-2 py-1">${formatExcelDate(Number(row['STORED']))}</td>
            <td class="border px-2 py-1">${status}</td>
          </tr>
        `;
    }).join('');
    html += `
          </tbody>
        </table>
      `;

    document.getElementById('table-container').innerHTML = html;
  } catch (err) {
    console.error('Lỗi loadDelayUrgentData:', err);
    document.getElementById('table-container').innerHTML =
      '<div class="text-red-500 p-4">Không tải được dữ liệu</div>';
  }
}


// Sau khi định nghĩa hàm, đừng quên gắn sự kiện để khi check/uncheck “Chỉ lỗi” lại load lại bảng:
delayErrorOnly.addEventListener('change', () => {
  // Giữ lại type hiện tại (DELAY hay URGENT), ví dụ bạn lưu ở biến global currentDelayType
  loadDelayUrgentData(currentDelayType);
});



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
      <th class="border px-2 py-1 w-[180px]">Tên Vải</th>
      <th class="border px-2 py-1">PRO ODER</th>
      <th class="border px-2 py-1">Brand Code</th>
      <th class="border px-2 py-1">#MOLDED</th>
      <th class="border px-2 py-1">BOM</th>
      <th class="border px-2 py-1">Total Qty</th>
      <th class="px-2 py-1 text-[12px] font-bold text-gray-700 border">Delay/Urgent</th>
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
      <td class="px-2 py-1 text-[12px] border text-red-600 font-semibold">${row['Delay/Urgent'] || ''}</td>
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
  currentDelayType = 'DELAY';
  hideAllViews();
  delayTabs.classList.remove('hidden');
  showDelaySearchWidgets();
  loadDelayUrgentData('DELAY');

  // highlight nút Delay
  btnDelayTab.classList.add('bg-yellow-400', 'text-white');
  btnDelayTab.classList.remove('bg-gray-300', 'text-black');
  btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.add('bg-gray-300', 'text-black');
});

// Sự kiện nút Xuất gấp
btnUrgentTab.addEventListener('click', () => {
  currentDelayType = 'URGENT';
  hideAllViews();
  delayTabs.classList.remove('hidden');
  showDelaySearchWidgets();
  loadDelayUrgentData('URGENT');

  // highlight nút Xuất gấp
  btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
  btnUrgentTab.classList.remove('bg-gray-300', 'text-black');
  btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
  btnDelayTab.classList.add('bg-gray-300', 'text-black');
});
delayErrorOnly.addEventListener('change', () => {
  loadDelayUrgentData(currentDelayType);
});
document.getElementById("btn-supplement")?.addEventListener("click", () => {
  window.location.href = "/supplement.html";
});

// Gọi cập nhật Last Push từ Supabase khi load trang
document.addEventListener("DOMContentLoaded", fetchLastPushTime);


// === Import supabase client ===

// === Hàm ghi nhận lượt truy cập ===
// Mock logVisit to stop errors
function logVisit(page, button) {
  console.log(`[Mock] Visit: ${page} - ${button}`);
}

// Ghi nhận khi mở trang Summary View
logVisit('Summary View', 'page-load');
logVisit('Progress', 'page-load');
logVisit('Delay-Xuất gấp', 'page-load');