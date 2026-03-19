// Lấy createClient từ global supabase
const supabaseLib = window.supabase;
if (!supabaseLib || !supabaseLib.createClient) {
    console.error("Supabase library not found! (script.js)");
}
const { createClient } = supabaseLib;

// Khai báo Supabase (Phải khớp với dự án mới)
const supabaseUrl = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
export const supabase = createClient(supabaseUrl, supabaseKey);
window.supabaseClient = supabase;

// --- Loading Helpers ---
const loadingOverlay = document.getElementById('loading-overlay');
const progressBarFill = document.getElementById('progress-bar-fill');
const loadingPercentage = document.getElementById('loading-percentage');
const loadingSubtext = document.getElementById('loading-subtext');

function updateLoading(percent, text) {
  if (progressBarFill) progressBarFill.style.width = `${percent}%`;
  if (loadingPercentage) loadingPercentage.textContent = Math.round(percent);
  if (loadingSubtext && text) loadingSubtext.textContent = text;
}

function showLoading(initialText = 'Đang chuẩn bị kết nối dữ liệu...') {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    updateLoading(0, initialText);
  }
}

function hideLoading() {
  updateLoading(100, 'Tải dữ liệu hoàn tất!');
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }, 500);
}

// --- Helper: Fetch all data from Supabase (pagination) ---
async function fetchAllPowerAppData() {
  let allRows = [];
  let from = 0;
  const step = 1000;
  
  // Get total count first for progress calculation
  const { count, error: countError } = await supabase
    .from('powerapp')
    .select('*', { count: 'exact', head: true });
  
  if (countError) console.error('Count error:', countError);
  const totalItems = count || 5000; // Fallback

  // OPTIMIZED: Select only needed columns for dashboard views (with Aliases for mismatched names)
  const selectCols = [
    '"STT"', '"PRO ODER"', '"Total Qty"', '"Finish date"',
    '"Molding (PPC)":"MOLDING PPC"', '"Molding Pro (IN)"', '"Molding Pro"',
    '"STATUS"', '"Brand Code"', '"#MOLD"', '"BOM"', '"PU"', '"FB"', '"FB DESCRIPTION"',
    '"RECEIVED (MATERIAL)"', '"RECEIVED (LOGO)"', '"Laminating (Pro)"',
    '"Prefitting (Pro)"', '"Slipting (Pro)"', '"Bào (Pro)":"TachBao PPC"',
    '"IN lean Line (Pro)"', '"IN lean Line (MACHINE)"', '"Out lean Line (Pro)"',
    '"STORED"', '"PPC Confirm"', '"LAMINATION MACHINE (PLAN)"', '"LAMINATION MACHINE (REALTIME)"',
    '"LEANLINE PLAN"', '"LEANLINE (REALTIME)"', '"Check":"Check2"', '"CheckLL"',
    '"Delay/Urgent":"Delay-Urgent"', '"Giới tính":"GENDER"', '"CUSTOMERS"', '"DL PU"'
  ].join(',');

  while (true) {
    const { data, error } = await supabase
      .from('powerapp')
      .select(selectCols)
      .range(from, from + step - 1);

    if (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    
    // Update progress
    const percent = Math.min(90, (allRows.length / totalItems) * 100);
    updateLoading(percent, `Đang tải: ${allRows.length} / ${totalItems} dòng...`);

    if (data.length < step) break;
    from += step;
  }
  updateLoading(95, 'Đang xử lý dữ liệu...');
  return { data: allRows };
}

// --- DOM elements chung ---
const container = document.getElementById('table-container');
const detailsContainer = document.getElementById('details-container');
const searchResult = document.getElementById('searchResult');
const lastUpdatedEl = document.getElementById('lastPushTime');
const lastLaminationEl = document.getElementById('lastLaminationTime');

// --- Helper: Format Excel Serial Date to DD/MM/YYYY HH:mm:ss ---
// --- Helper: Format Date object to DD/MM/YYYY HH:mm:ss ---
function formatDateToString(date) {
  if (!date || isNaN(date.getTime())) return "Chưa có dữ liệu";
  const pad = (n) => String(n).padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

// --- Helper: Format Excel Serial Date to DD/MM/YYYY HH:mm:ss ---
function formatExcelDateTime(serial) {
  if (!serial || isNaN(serial) || serial <= 0) return "Chưa có dữ liệu";
  const base = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(base.getTime() + serial * msPerDay);
  return formatDateToString(date);
}

// --- Fetch Last Update Time ---
async function fetchLastPushTime() {
  if (!lastUpdatedEl) return;
  try {
    // 1. Fetch Last Push Time (From Metadata Record with STT = -1)
    const { data: pushData, error: pushError } = await supabase
      .from('powerapp')
      .select('"Finish date"')
      .eq('STT', -1)
      .limit(1);

    if (pushError) {
      console.error("Error fetching metadata record:", pushError);
      throw pushError;
    }

    console.log("Metadata record (STT=-1):", pushData);

    let syncDate = null;
    if (pushData && pushData.length > 0 && pushData[0]['Finish date']) {
      // This is a string in format "yyyy-MM-dd HH:mm:ss" from PowerShell
      const dateStr = pushData[0]['Finish date'];
      syncDate = new Date(dateStr);
      lastUpdatedEl.textContent = formatDateToString(syncDate);
    } else {
      lastUpdatedEl.textContent = "Chưa có dữ liệu";
      console.warn("No metadata record found with STT=-1");
    }

    // 2. Fetch Latest Lamination Time (Max value in Laminating (Pro))
    const { data: lamData, error: lamError } = await supabase
      .from('powerapp')
      .select('"Laminating (Pro)"')
      .not('"Laminating (Pro)"', 'is', null)
      .gt('"Laminating (Pro)"', 0)
      .order('"Laminating (Pro)"', { ascending: false })
      .limit(1);

    if (lamError) throw lamError;

    let lamDate = null;
    if (lamData && lamData.length > 0 && lamData[0]['Laminating (Pro)']) {
      const serial = Number(lamData[0]['Laminating (Pro)']);
      const base = new Date(1899, 11, 30);
      lamDate = new Date(base.getTime() + serial * 86400000);
      lastLaminationEl.textContent = formatDateToString(lamDate);
    } else {
      lastLaminationEl.textContent = "Chưa có dữ liệu";
    }

    // 3. Compare and Warn if diff >= 6 hours
    if (syncDate && lamDate) {
      const diffHrs = Math.abs(syncDate - lamDate) / (1000 * 60 * 60);
      if (diffHrs >= 6) {
        lastLaminationEl.parentElement.classList.add('bg-red-50', 'p-1', 'rounded', 'border', 'border-red-200');
        lastLaminationEl.classList.add('text-red-600', 'font-bold');
        lastLaminationEl.innerHTML += ' <span class="animate-pulse">⚠️ (Dữ liệu Dán đang bị lệch > 6h!)</span>';
      } else {
        lastLaminationEl.parentElement.classList.remove('bg-red-50', 'p-1', 'rounded', 'border', 'border-red-200');
        lastLaminationEl.classList.remove('text-red-600', 'font-bold');
      }
    }

  } catch (err) {
    console.error("Error fetching timestamps:", err);
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Lỗi tải thời gian";
    if (lastLaminationEl) lastLaminationEl.textContent = "Lỗi tải thời gian";
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
const headerDisplayMap = {
  'PRO ODER': 'Order Code',
  'Brand Code': 'Brand',
  '#MOLD': 'Loại hàng',
  'Total Qty': 'PO Quantity (Pairs)',
  'Delay-Urgent': 'Delay/Urgent',
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
  if (!btn) return;
  btn.disabled = isLoading;
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

// Hiện thanh tìm kiếm nâng cao Progress
function showProgressAdvancedFilter() {
  document.getElementById('advanced-search-title').classList.remove('hidden');
  document.getElementById('progress-advanced-filter').classList.remove('hidden');
}

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
  showLoading('Đang tải dữ liệu Summary...');
  hideAllViews();
  selectedSection = 'LAMINATION';
  renderSectionButtons();
  await renderSummarySection();
  currentView = 'summary';
  currentMachine = null;
  hideLoading();
}


// -----------------------------------
// --- PROGRESS VIEW (tiến trình RPRO) ---
// -----------------------------------
async function loadProgress() {
  currentView = 'progress';
  hideAllViews();
  currentMachine = null;
  showProgressSearchBar();
  document.getElementById('basic-search-title').classList.remove('hidden');
  document.getElementById('advanced-search-title').classList.remove('hidden');
  showProgressSearchBar();
  showProgressAdvancedFilter();
  hideDetails();
  container.innerHTML = '';
  searchResult.innerHTML = '';
  hideSectionBar();
  showProgressSearchBar();
}

async function searchProgress() {
  showLoading('Đang tìm kiếm tiến trình...');
  setBtnLoading(progressBtnSearch, true);
  container.innerHTML = '';
  hideDetails();
  searchResult.innerHTML = '';

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
      'PACKING PRO', 'Packing date', 'STORED', 'PPC Confirm'
    ];

    const dateFields = [
      'RECEIVED (MATERIAL)', 'RECEIVED (LOGO)', 'Laminating (Pro)',
      'Prefitting (Pro)', 'Slipting (Pro)', 'Bào (Pro)', 'Molding (PPC)',
      'Molding Pro (IN)', 'Molding Pro', 'IN lean Line (Pro)',
      'IN lean Line (MACHINE)', 'Out lean Line (Pro)',
      'PACKING PRO', 'Packing date', 'Finish date', 'STORED', 'PPC Confirm'
    ];

    const excelDateToString = (serial) => {
      const base = new Date(1899, 11, 30);
      const date = new Date(base.getTime() + Math.floor(serial) * 86400000);
      return `${String(date.getDate()).padStart(2, '0')}/` +
        `${String(date.getMonth() + 1).padStart(2, '0')}/` +
        `${date.getFullYear()}`;
    };

    const rawKeyword = progressSearchBox.value.trim().toUpperCase();
    const rproMatches = rawKeyword.match(/RPRO-[\d-]+/g);
    const cleanMatches = rproMatches ? rproMatches.map(m => m.replace(/[^A-Z0-9]/g, "").toUpperCase()) : [];

    let filtered = data.filter(row => {
      let matchBasic = true;

      if (cleanMatches.length > 0 && selectedField === 'PRO ODER') {
        const cleanRpro = (row['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        matchBasic = cleanMatches.some(m => cleanRpro.includes(m));
      } else {
        const cell = row[selectedField];
        const cellValue = cell !== undefined && cell !== null ? cell.toString().toLowerCase() : '';
        matchBasic = cellValue.includes(keyword);
      }

      const matchAdvanced = Object.entries(filters).every(([key, val]) => {
        const v = (row[key] || '').toString().toLowerCase();
        return v.includes(val);
      });
      return matchBasic && matchAdvanced;
    });

    // Custom Sort by search order
    if (cleanMatches.length > 0 && selectedField === 'PRO ODER') {
      filtered.sort((a, b) => {
        const rproA = (a['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        const rproB = (b['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        let idxA = cleanMatches.findIndex(m => rproA.includes(m));
        let idxB = cleanMatches.findIndex(m => rproB.includes(m));
        return (idxA === -1 ? 99999 : idxA) - (idxB === -1 ? 99999 : idxB);
      });

      // Show alert for missing RPROs
      const foundRpros = filtered.map(row => (row['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase());
      const missing = rproMatches.filter(m => {
        const cleanM = m.replace(/[^A-Z0-9]/g, "").toUpperCase();
        return !foundRpros.some(f => f.includes(cleanM));
      });
      if (missing.length > 0) {
        alert("⚠️ Không tìm thấy các đơn: " + missing.join(", "));
      }
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-red-500">Không tìm thấy dữ liệu khớp.</div>`;
      return;
    }

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
    hideLoading();
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

    const rawKeywordForExport = progressSearchBox.value.trim().toUpperCase();
    const rproMatchesExport = rawKeywordForExport.match(/RPRO-[\d-]+/g);
    const cleanMatchesExport = rproMatchesExport ? rproMatchesExport.map(m => m.replace(/[^A-Z0-9]/g, "").toUpperCase()) : [];

    let filtered = data.filter(row => {
      let matchBasic = true;
      if (cleanMatchesExport.length > 0 && selectedField === 'PRO ODER') {
        const cleanRpro = (row['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        matchBasic = cleanMatchesExport.some(m => cleanRpro.includes(m));
      } else {
        const cell = row[selectedField];
        const cellValue = cell !== undefined && cell !== null ? cell.toString().toLowerCase() : '';
        matchBasic = cellValue.includes(keyword);
      }
      const matchAdvanced = Object.entries(filters).every(([key, val]) => {
        const v = (row[key] || '').toString().toLowerCase();
        return v.includes(val);
      });
      return matchBasic && matchAdvanced;
    });

    // Custom Sort for Export order
    if (cleanMatchesExport.length > 0 && selectedField === 'PRO ODER') {
      filtered.sort((a, b) => {
        const rproA = (a['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        const rproB = (b['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        let idxA = cleanMatchesExport.findIndex(m => rproA.includes(m));
        let idxB = cleanMatchesExport.findIndex(m => rproB.includes(m));
        return (idxA === -1 ? 99999 : idxA) - (idxB === -1 ? 99999 : idxB);
      });
    }

    if (filtered.length === 0 && (keyword || Object.keys(filters).length > 0)) {
      alert("Không có dữ liệu để xuất!");
      return;
    }

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

  if (isInitial) {
    return (d['STATUS'] || '').toUpperCase() === `2.${selectedSection.toUpperCase()}`;
  }

  if (selectedField === 'ALL' || keyword === '') {
    return true;
  }

  return (d[selectedField] || '').toString().toUpperCase().includes(keyword);
}

async function loadDetailsClient(
  machine,
  isInitial = false,
  rememberedField = 'ALL',
  rememberedKeyword = ''
) {
  showLoading(`Đang tải chi tiết cho máy ${machine}...`);
  currentView = 'detail';
  currentMachine = machine;

  detailsContainer.classList.remove('hidden');
  detailsContainer.innerHTML = '<div class="text-center py-4">Loading chi tiết…</div>';

  try {
    const json = await fetchAllPowerAppData();
    const fullData = json.data;

    const planCol = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE PLAN'
      : 'LAMINATION MACHINE (PLAN)';
    const realtimeCol = selectedSection === 'LEANLINE_DC'
      ? 'LEANLINE (REALTIME)'
      : 'LAMINATION MACHINE (REALTIME)';
    const verifyCol = selectedSection === 'LEANLINE_DC'
      ? 'CheckLL'
      : 'Check';

    const rows = fullData.filter(row => row[planCol] === machine);

    if (rows.length === 0) {
      detailsContainer.innerHTML = `
        <div class="text-center py-4">
          Không có dữ liệu cho máy ${machine}
        </div>`;
      return;
    }

    const selectedColumns = [
      'PRO ODER', 'Brand Code', '#MOLD', 'Delay/Urgent', 'Total Qty',
      'STATUS', 'PU', 'FB', 'FB DESCRIPTION', planCol, realtimeCol, verifyCol
    ];

    const details = rows.map((row, i) => {
      const obj = { STT: i + 1 };
      selectedColumns.forEach(col => {
        obj[col] = row[col] ?? '';
      });
      return obj;
    });

    const filtered = details.filter(d => {
      if (isInitial) {
        return !(d[realtimeCol] || '').toString().trim();
      }
      if (rememberedField === 'ALL' || !rememberedKeyword.trim()) {
        return true;
      }
      return ('' + d[rememberedField])
        .toUpperCase()
        .includes(rememberedKeyword.trim().toUpperCase());
    });

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

    const palette = ['#fef08a', '#a7f3d0', '#fca5a5', '#c4b5fd', '#f9a8d4', '#fde68a', '#bfdbfe', '#6ee7b7'];
    const groups = [...new Set(details.map(d => `${d.PU}_${d.FB}`))];
    const colorMap = {};
    groups.forEach((g, idx) => {
      colorMap[g] = palette[idx % palette.length];
    });

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

    document.getElementById('detailsSearchBtn').addEventListener('click', () => {
      const f = document.getElementById('detailsColumnSelect').value;
      const kw = document.getElementById('detailsSearchInput').value.trim();
      loadDetailsClient(machine, false, f, kw);
    });
    document.getElementById('detailsClearBtn').addEventListener('click', () => {
      document.getElementById('detailsSearchInput').value = '';
      loadDetailsClient(machine, false, rememberedField, '');
    });

  } finally {
    hideLoading();
  }
}

// -----------------------------------
// --- REFRESH BUTTON (F5) ---
btnRefresh.addEventListener('click', () => {
  window.location.reload();
});

// --- Biến toàn cục ---
let selectedSection = 'LAMINATION';
const sectionButtons = [
  { id: 'btn-lamination', label: 'Lamination', value: 'LAMINATION' },
  { id: 'btn-leanline-dc', label: 'Leanline DC', value: 'LEANLINE_DC' },
];

function renderSectionButtons() {
  const bar = document.getElementById('section-bar');
  if (!bar) return;
  bar.innerHTML = '';
  sectionButtons.forEach(({ id, label, value }) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    btn.className = `px-4 py-1 rounded font-medium text-white ${selectedSection === value ? 'bg-green-600' : 'bg-gray-400'}`;
    btn.onclick = () => {
      selectedSection = value;
      renderSectionButtons();
      renderSummarySection();
    };
    bar.appendChild(btn);
  });
}

function getDelayUrgentQty(machine, data) {
  const planKey = selectedSection === 'LEANLINE_DC' ? 'LEANLINE PLAN' : 'LAMINATION MACHINE (PLAN)';
  return data.reduce((sum, row) => {
    const status = (row['STATUS'] || '').toUpperCase();
    const delayType = (row['Delay/Urgent'] || '').toUpperCase();
    const qty = Number(row['Total Qty']) || 0;
    if (
      row[planKey] === machine &&
      (['URGENT', 'PRODUCTION DELAY'].includes(delayType)) &&
      (
        (selectedSection === 'LEANLINE_DC' && ['5.LEAN LINE DC', '6.IN LEAN LINE DC'].includes(status)) ||
        (selectedSection !== 'LEANLINE_DC' && status === `2.${selectedSection.toUpperCase()}`)
      )
    ) {
      return sum + qty;
    }
    return sum;
  }, 0);
}

async function renderSummarySection() {
  // loading is handled by loadSummary
  hideDetails();
  hideProgressSearchBar();
  container.innerHTML = '';
  const sectionBarEl = document.getElementById('section-bar');
  if (sectionBarEl) sectionBarEl.innerHTML = '';
  renderSectionButtons();

  try {
    const json = await fetchAllPowerAppData();
    const data = json.data;
    const planKey = selectedSection === 'LEANLINE_DC' ? 'LEANLINE PLAN' : 'LAMINATION MACHINE (PLAN)';
    const statusFilter = selectedSection === 'LEANLINE_DC' ? '6.WIP IN LEAN LINE' : '2.MATERIAL CHƯA DÁN';
    const delayKey = 'Delay/Urgent';

    const machines = {};
    const delayCounts = {};
    const sheetCounts = {};

    data.forEach(row => {
      const machine = row[planKey];
      const status = (row['STATUS'] || '').trim().toUpperCase();
      const delayFlag = (row[delayKey] || '').trim().toUpperCase();
      const qty = Number(row['Total Qty']) || 0;
      const sheets = Number(row['DL PU']) || 0;

      if (status === statusFilter.toUpperCase() && machine) {
        machines[machine] = (machines[machine] || 0) + qty;
        if (selectedSection === 'LAMINATION') {
          sheetCounts[machine] = (sheetCounts[machine] || 0) + sheets;
        }
      }
      if (machine && ['PRODUCTION DELAY', 'URGENT'].includes(delayFlag)) {
        delayCounts[machine] = (delayCounts[machine] || 0) + qty;
      }
    });

    let html = `
      <table class="min-w-full text-sm border border-gray-300 bg-white shadow">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-6 py-3 text-left">MACHINE</th>
            <th class="px-6 py-3 text-right">QUANTITY PAIR PLAN</th>
            <th class="px-6 py-3 text-right text-red-600">Delay/Urgent</th>
            ${selectedSection === 'LAMINATION' ? `<th class="px-6 py-3 text-right">SỐ TẤM (SHEET)</th>` : ''}
          </tr>
        </thead>
        <tbody>
    `;

    let totalQty = 0, totalDelay = 0, totalSheets = 0;
    Object.keys({ ...machines, ...delayCounts }).sort().forEach(machine => {
      const qty = machines[machine] || 0;
      const delay = delayCounts[machine] || 0;
      const sheets = sheetCounts[machine] || 0;
      totalQty += qty; totalDelay += delay; totalSheets += sheets;
      html += `
        <tr class="hover:bg-gray-50 cursor-pointer" data-machine="${machine}">
          <td class="px-6 py-3 text-sm text-gray-700">${machine}</td>
          <td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(qty)}</td>
          <td class="px-6 py-3 text-sm text-right text-red-600 font-semibold">${formatNumber(delay)}</td>
          ${selectedSection === 'LAMINATION' ? `<td class="px-6 py-3 text-sm text-gray-900 text-right">${formatNumber(sheets)}</td>` : ''}
        </tr>
      `;
    });

    html += `
        <tr class="font-bold bg-gray-100">
          <td class="px-6 py-3 text-right">Tổng cộng:</td>
          <td class="px-6 py-3 text-right">${formatNumber(totalQty)}</td>
          <td class="px-6 py-3 text-right text-red-600 font-semibold">${formatNumber(totalDelay)}</td>
          ${selectedSection === 'LAMINATION' ? `<td class="px-6 py-3 text-right">${formatNumber(totalSheets)}</td>` : ''}
        </tr>
      </tbody>
      </table>
    `;
    container.innerHTML = html;
    container.querySelectorAll('tbody tr[data-machine]').forEach(row => row.addEventListener('click', () => loadDetailsClient(row.getAttribute('data-machine'), true)));
  } catch (err) {
    console.error('[renderSummarySection error]', err);
    container.innerHTML = `<div class="text-red-500 py-4">⚠️ Lỗi tải dữ liệu section</div>`;
  } finally {
    // hideLoading is handled by loadSummary
  }
}

window.addEventListener('DOMContentLoaded', () => {
  showWelcome();
  fetchLastPushTime();
  btnSummary.addEventListener('click', loadSummary);
  btnProgress.addEventListener('click', loadProgress);
  btnRefresh.addEventListener('click', () => window.location.reload());
  progressBtnSearch.addEventListener('click', searchProgress);
  progressBtnClear.addEventListener('click', clearProgressSearch);
  progressBtnExport.addEventListener('click', exportProgressToExcel);

  progressSearchBox.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchProgress(); });

  let searchTimeout;
  progressSearchBox.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (progressSearchBox.value.trim().length >= 3 || progressSearchBox.value.trim().length === 0) searchProgress();
    }, 800);
  });

  delayBtnSearch.addEventListener('click', () => loadDelayUrgentData(currentDelayType));
  delaySearchBox.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadDelayUrgentData(currentDelayType); });
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

  btnDelayTab.addEventListener('click', () => {
    currentDelayType = 'DELAY';
    hideAllViews();
    delayTabs.classList.remove('hidden');
    showDelaySearchWidgets();
    loadDelayUrgentData('DELAY');
    btnDelayTab.classList.add('bg-yellow-400', 'text-white');
    btnDelayTab.classList.remove('bg-gray-300', 'text-black');
    btnUrgentTab.classList.remove('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.add('bg-gray-300', 'text-black');
  });

  btnUrgentTab.addEventListener('click', () => {
    currentDelayType = 'URGENT';
    hideAllViews();
    delayTabs.classList.remove('hidden');
    showDelaySearchWidgets();
    loadDelayUrgentData('URGENT');
    btnUrgentTab.classList.add('bg-yellow-400', 'text-white');
    btnUrgentTab.classList.remove('bg-gray-300', 'text-black');
    btnDelayTab.classList.remove('bg-yellow-400', 'text-white');
    btnDelayTab.classList.add('bg-gray-300', 'text-black');
  });

  delayErrorOnly.addEventListener('change', () => loadDelayUrgentData(currentDelayType));
});

function hideAllViews() {
  const ids = ['section-bar', 'searchResult', 'table-container'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  document.getElementById('details-container').classList.add('hidden');
  document.getElementById('progress-search-bar').classList.add('hidden');
  document.getElementById('progress-advanced-filter').classList.add('hidden');
  document.querySelectorAll('#basic-search-title, #advanced-search-title, #delay-tabs, #delay-basic-search-title, #delay-advanced-search-title, #delay-search-bar, #delay-advanced-filter').forEach(el => el.classList.add('hidden'));
}

function showWelcome() {
  hideAllViews();
  currentView = 'welcome';
  const container = document.getElementById('table-container');
  if (container) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div class="bg-blue-100 p-6 rounded-full inline-block mb-4">
          <span class="text-6xl">👋</span>
        </div>
        <h1 class="text-4xl font-black text-gray-800 tracking-tight">Xin chào bạn!</h1>
        <p class="text-xl text-gray-500 max-w-md">Chào mừng bạn quay lại hệ thống Dashboard. Vui lòng chọn một mục ở thanh menu phía trên để bắt đầu làm việc.</p>
        <div class="flex gap-4 mt-8 opacity-50">
          <div class="h-1 w-12 bg-blue-500 rounded-full"></div>
          <div class="h-1 w-12 bg-purple-500 rounded-full"></div>
          <div class="h-1 w-12 bg-red-500 rounded-full"></div>
        </div>
      </div>
    `;
  }
}

function formatExcelDate(serial) {
  if (!serial || isNaN(serial)) return '';
  const base = new Date(1899, 11, 30);
  const date = new Date(base.getTime() + serial * 86400000);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

async function loadDelayUrgentData(type) {
  showLoading(`Đang tải dữ liệu ${type === 'DELAY' ? 'Delay' : 'Xuất gấp'}...`);
  const btn = document.getElementById('delayBtnSearch');
  if (btn) setBtnLoading(btn, true);
  try {
    const json = await fetchAllPowerAppData();
    const data = json.data;
    const heading = document.getElementById('delay-basic-search-title');
    if (heading) heading.textContent = (type === 'DELAY' ? 'TÌM KIẾM DELAY' : 'TÌM KIẾM XUẤT GẤP');
    const keyword = delaySearchBox.value.trim().toLowerCase();
    const selectedField = delayColumnSelect.value;
    const errorOnly = delayErrorOnly.checked;
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

    const rawKeywordDelay = delaySearchBox.value.trim().toUpperCase();
    const rproMatchesDelay = rawKeywordDelay.match(/RPRO-[\d-]+/g);
    const cleanMatchesDelay = rproMatchesDelay ? rproMatchesDelay.map(m => m.replace(/[^A-Z0-9]/g, "").toUpperCase()) : [];

    let filtered = data.filter(row => {
      const delayVal = (row['Delay/Urgent'] || '').toUpperCase();
      if ((type === 'DELAY' && delayVal !== 'PRODUCTION DELAY') || (type === 'URGENT' && delayVal !== 'URGENT')) return false;

      let matchBasic = true;
      if (cleanMatchesDelay.length > 0 && selectedField === 'PRO ODER') {
        const cleanRpro = (row['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        matchBasic = cleanMatchesDelay.some(m => cleanRpro.includes(m));
      } else {
        const main = (row[selectedField] || '').toString().toLowerCase();
        matchBasic = keyword ? main.includes(keyword) : true;
      }

      if (!matchBasic) return false;
      for (let [k, v] of Object.entries(filters)) { if (!(row[k] || '').toString().toLowerCase().includes(v)) return false; }
      if (errorOnly) {
        const st = (row['STATUS'] || '').toUpperCase();
        if (st === '7.PACKING' || st === '9.STORED') return false;
      }
      return true;
    });

    // Custom Sort for Delay order
    if (cleanMatchesDelay.length > 0 && selectedField === 'PRO ODER') {
      filtered.sort((a, b) => {
        const rproA = (a['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        const rproB = (b['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase();
        let idxA = cleanMatchesDelay.findIndex(m => rproA.includes(m));
        let idxB = cleanMatchesDelay.findIndex(m => rproB.includes(m));
        return (idxA === -1 ? 99999 : idxA) - (idxB === -1 ? 99999 : idxB);
      });

      // Show alert for missing RPROs
      const foundRpros = filtered.map(row => (row['PRO ODER'] || "").replace(/[^A-Z0-9]/g, "").toUpperCase());
      const missing = rproMatchesDelay.filter(m => {
        const cleanM = m.replace(/[^A-Z0-9]/g, "").toUpperCase();
        return !foundRpros.some(f => f.includes(cleanM));
      });
      if (missing.length > 0) {
        alert("⚠️ Không tìm thấy các đơn trong danh mục này: " + missing.join(", "));
      }
    }

    const headers = ['STT', 'PRO ODER', 'Brand Code', 'Loại hàng', 'Mã khuôn', 'BOM', 'Total Qty', 'Finish date', 'PPC Confirm', 'STORED', 'STATUS'];
    let html = `<table class="min-w-full text-sm text-left border"><thead class="bg-gray-200"><tr>${headers.map(h => `<th class="px-2 py-1 border">${h}</th>`).join('')}</tr></thead><tbody>`;
    html += filtered.map((row, i) => {
      const status = row['STATUS'] || '';
      const highlight = (!errorOnly && status !== '7.PACKING' && status !== '9.STORED') ? 'bg-red-100' : '';
      return `<tr class="${highlight}"><td class="border px-2 py-1">${i + 1}</td><td class="border px-2 py-1">${row['PRO ODER'] || ''}</td><td class="border px-2 py-1">${row['Brand Code'] || ''}</td><td class="border px-2 py-1">${row['#MOLDED'] || ''}</td><td class="border px-2 py-1">${row['#MOLD'] || ''}</td><td class="border px-2 py-1">${row['BOM'] || ''}</td><td class="border px-2 py-1">${row['Total Qty'] || ''}</td><td class="border px-2 py-1">${formatExcelDate(Number(row['Finish date']))}</td><td class="border px-2 py-1">${formatExcelDate(Number(row['PPC Confirm']))}</td><td class="border px-2 py-1">${formatExcelDate(Number(row['STORED']))}</td><td class="border px-2 py-1">${status}</td></tr>`;
    }).join('');
    html += '</tbody></table>';
    if (filtered.length === 0) document.getElementById('table-container').innerHTML = '<div class="text-center py-4 text-red-500 font-semibold">❌ Không tìm thấy dữ liệu phù hợp!</div>';
    else document.getElementById('table-container').innerHTML = html;
  } catch (err) {
    console.error('Lỗi loadDelayUrgentData:', err);
    document.getElementById('table-container').innerHTML = '<div class="text-red-500 p-4">Không tải được dữ liệu</div>';
  } finally {
    if (btn) setBtnLoading(btn, false);
    hideLoading();
  }
}

document.getElementById("btn-supplement")?.addEventListener("click", () => { window.location.href = "/supplement.html"; });
document.getElementById("btn-confirm-page")?.addEventListener("click", () => { window.location.href = "/supplement-confirm.html"; });
document.getElementById("btn-supplement-count")?.addEventListener("click", () => { window.location.href = "/supplement-count.html"; });

const btnSurplusGoods = document.getElementById('btn-surplus-goods');
if (btnSurplusGoods) {
  btnSurplusGoods.addEventListener('click', () => {
    window.location.href = 'surplus-landing.html';
  });
}
