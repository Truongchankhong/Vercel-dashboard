import { supabase } from './supabaseClient.js';

// ==================== GLOBAL BIẾN ==================== //
let currentRpro = null;
let headersArr = [];
let useSizeFix = false;
let showSizeFixValues = true;
let rawRecord = null;
let sizeFixData = {};
let existingRecord = null;
let removedSizeFix = false; // ✅ Đánh dấu đã bấm nút Bỏ giảm size

// ==================== HÀM CHUẨN HÓA SIZE ==================== //
function normalizeSizeKey(size) {
  return 'size_' + size.replace(/\./g, '_');
}
// ==================== HÀM KIỂM TRA SIZE FIX CÓ THẬT SỰ KHÁC KHÔNG ==================== //
function checkHasRealSizeFix(originalSizes, femaleSizes) {
  if (!originalSizes || !femaleSizes) return false;
  if (originalSizes.length !== femaleSizes.length) return true;
  for (let i = 0; i < originalSizes.length; i++) {
    if (originalSizes[i] !== femaleSizes[i]) return true; // chỉ cần 1 size khác là coi như có giảm size
  }
  return false; // tất cả giống nhau → không giảm size
}
// ==================== GHI LOG VISIT ==================== //
async function logVisit(page, button = null) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.rpc('increment_visit', {
    p_date: today,
    p_page: page || '',
    p_button: button || 'unknown'
  });
  if (error) console.error("❌ logVisit error:", error);
}

// ==================== LOAD ĐƠN HÀNG ==================== //
async function loadOrderInfo(rpro) {
  currentRpro = rpro;
  const loadingEl = document.getElementById("loading-status");
  if (loadingEl) loadingEl.classList.remove("hidden");

  try {
    const res = await fetch("/powerapp.json?v=" + Date.now(), { cache: "no-store" });
    const { headers, data } = await res.json();
    headersArr = headers;

    console.log("📋 headersArr =", headersArr);

    const rec = data.find(r => (r["PRO ODER"] || "") === rpro);
    if (!rec) {
      alert("Không tìm thấy đơn " + rpro);
      if (loadingEl) loadingEl.classList.add("hidden");
      return;
    }

    const gender = rec["Giới tính"] || rec["GENDER"] || "";
    useSizeFix = false;
    showSizeFixValues = true;
    sizeFixData = {};

    if (gender === "Women's") {
      try {
        const resFix = await fetch("/sizefix.json?v=" + Date.now(), { cache: "no-store" });
        const sizefixJson = await resFix.json();
        sizeFixData = sizefixJson[rpro] || {};
        if (Object.keys(sizeFixData).length > 0) {
          useSizeFix = true;
        }
      } catch (err) {
        console.warn("Không thể tải sizefix.json:", err);
      }
    }

    const { data: existingRows } = await supabase
      .from('supplement')
      .select('*')
      .eq('rpro', rpro)
      .limit(1);

    existingRecord = (existingRows && existingRows.length > 0) ? existingRows[0] : null;
    rawRecord = rec;

    renderOrder(rec, existingRecord);

  } catch (err) {
    console.error("loadOrderInfo:", err);
    alert("Lỗi khi tải dữ liệu!");
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

// ==================== HIỂN THỊ BẢNG SIZE ==================== //
function renderOrder(rec, existing = null) {
  console.log("🧩 renderOrder chạy, headersArr:", headersArr);

  // Gán metadata cơ bản
  document.getElementById("info-rpro").textContent = rec["PRO ODER"] || "";
  document.getElementById("info-so").textContent = rec["SO"] || rec["Sales Order"] || "";
  document.getElementById("info-customers").textContent = rec["CUSTOMERS"] || "";
  const gender = rec["Giới tính"] || rec["GENDER"] || "";
  document.getElementById("info-gender").textContent = gender;
  document.getElementById("info-mold").textContent = rec["Mã Khuôn"] || rec["#MOLD"] || "";
  document.getElementById("info-pu").textContent = rec["Mã dao"] || rec["PU"] || "";
  document.getElementById("info-fabric").textContent = rec["Tên vải"] || rec["FB DESCRIPTION"] || "";
  document.getElementById("info-bom").textContent = rec["BOM"] || "";
  document.getElementById("order-info").classList.remove("hidden");

  // ✅ Lấy danh sách size có giá trị từ headersArr
  const sizeKeys = headersArr
    .filter(h => !isNaN(parseFloat(h)))
    .map(s => s.trim())
    .filter(Boolean)
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  console.log("📏 sizeKeys phát hiện:", sizeKeys);

  const originalData = rec;
  const femaleData = sizeFixData || {};

  const originalSizes = sizeKeys
    .filter(s => Number(originalData[s]) > 0)
    .map(s => s.toString());

  const femaleSizes = Object.keys(femaleData)
    .map(s => parseFloat(s))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)
    .map(n => n.toString());

  let html = `
    <table class="min-w-full border border-gray-300">
      <thead class="bg-gray-100">
        <tr>
          <th class="border px-2 py-1">Size gốc</th>
          <th class="border px-2 py-1">Size nữ</th>
          <th class="border px-2 py-1">Số thiếu</th>
          <th class="border px-2 py-1">PO Quantity</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (originalSizes.length === 0) {
    html += `<tr><td colspan="4" class="text-center p-4 text-red-600">Không tìm thấy dữ liệu size cho đơn hàng này!</td></tr>`;
  }

  originalSizes.forEach((sizeOriginal, idx) => {
    const sizeFemale = (gender === "Women's" && femaleSizes[idx] && showSizeFixValues)
      ? femaleSizes[idx]
      : "";

    const poQtyOriginal = Number(originalData[sizeOriginal]) || 0;
    const poQtyFemale = femaleSizes[idx] ? Number(femaleData[femaleSizes[idx]]) || 0 : 0;

    const poQty = (gender === "Women's" && useSizeFix && showSizeFixValues)
      ? poQtyFemale
      : poQtyOriginal;

    const inputKey = sizeOriginal;
    const oldQty = existing?.[normalizeSizeKey(inputKey)] || "";

    html += `
      <tr>
        <td class="border px-2 py-1 text-center">${sizeOriginal}</td>
        <td class="border px-2 py-1 text-center">${sizeFemale}</td>
        <td class="border px-2 py-1 text-center">
          <input type="number" min="0"
                 value="${oldQty}"
                 data-size="${inputKey}"
                 class="w-16 input-supp" />
        </td>
        <td class="border px-2 py-1 text-center">${poQty}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot class="bg-gray-50">
        <tr>
          <td class="border px-2 py-1 font-bold" colspan="2">TOTAL</td>
          <td class="border px-2 py-1 font-bold" id="supp-total">0</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;

  // ✅ Nếu là Women's thì hiển thị cảnh báo
  if (useSizeFix && showSizeFixValues) {
    html = `
      <div class="bg-yellow-200 text-yellow-800 p-2 mb-2 rounded">
        ⚠️ CẢNH BÁO SIZE NỮ!! ĐÃ TỰ ĐỘNG GIẢM SIZE NẾU CÓ!!
        <button onclick="cancelSizeFix()"
                class="ml-4 bg-red-600 text-white px-2 py-1 rounded">
          Bỏ giảm size
        </button>
      </div>` + html;
  }

  const container = document.getElementById("size-table-container");
  container.innerHTML = html;
  container.classList.remove("hidden");

  document.querySelectorAll(".input-supp").forEach(inp => {
    inp.addEventListener("input", updateTotal);
  });

  console.log("✅ Rendered size inputs:",
    [...document.querySelectorAll(".input-supp")].map(i => i.dataset.size)
  );

  updateTotal();
  document.getElementById("btn-confirm-supplement").disabled = false;
}
function cancelSizeFix() {
  removedSizeFix = true; // ✅ đánh dấu người dùng đã bỏ giảm size
  showSizeFixValues = false;

  // Ẩn cột "Size nữ" ngay trên giao diện
  const femaleCells = document.querySelectorAll("td:nth-child(2), th:nth-child(2)");
  femaleCells.forEach(cell => {
    if (cell.textContent?.includes("Size nữ") || cell.closest("thead")) return;
    cell.textContent = ""; // Xoá nội dung cột Size nữ
  });
  
  
  alert("✅ Đã bỏ giảm size. Khi lưu, hệ thống sẽ không ghi chú 'Size fixed'.");
}
window.cancelSizeFix = cancelSizeFix;



// ==================== CẬP NHẬT TOTAL ==================== //
function updateTotal() {
  const sum = [...document.querySelectorAll(".input-supp")]
    .reduce((acc, inp) => acc + Number(inp.value || 0), 0);
  document.getElementById("supp-total").textContent = sum;
}

// ==================== QUÉT HOẶC NHẬP RPRO ==================== //
function handleScanned(text) {
  const cleanText = (text || "").trim();
  let rpro = "";

  if (cleanText.includes("|")) {
    const parts = cleanText.split("|");
    const rproPart = parts.find(p => p.startsWith("RPRO"));
    rpro = rproPart || cleanText;
  } else if (cleanText.startsWith("RPRO")) {
    rpro = cleanText;
  } else {
    alert("❌ Mã QR không hợp lệ: " + cleanText);
    return;
  }
  loadOrderInfo(rpro);
}
async function askNextAction() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50";
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6 w-[320px] text-center">
        <div class="text-lg font-semibold text-gray-800 mb-4">
          ✅ Đã lưu bù hàng thành công!
        </div>
        <div class="text-gray-700 mb-5">
          Bạn muốn quét qua đơn mới không hay ở lại đơn vừa quét?
        </div>
        <div class="flex justify-around">
          <button id="btn-new-order"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded">
            Quét đơn mới
          </button>
          <button id="btn-stay"
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-3 py-1 rounded">
            Ở lại
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector("#btn-new-order").addEventListener("click", () => {
      dialog.remove();
      resolve("new");
    });
    dialog.querySelector("#btn-stay").addEventListener("click", () => {
      dialog.remove();
      resolve("stay");
    });
  });
}
// ==================== DOM EVENT ==================== //
window.addEventListener("DOMContentLoaded", () => {
  logVisit("Supplement");

  document.getElementById("btn-manual-ok")
    .addEventListener("click", () => handleScanned(document.getElementById("manualRpro").value));

  document.getElementById("btn-confirm-supplement")
    .addEventListener("click", async () => {
      const genderVal = document.getElementById("info-gender").textContent.trim();
      const remarkNote = document.getElementById("note-textarea").value.trim();

      // === Tạo remark đúng theo thực tế ===

        let remarkValue = "";
        if (
          genderVal === "Women's" &&
          showSizeFixValues &&
          !removedSizeFix // ✅ nếu đã bấm "Bỏ giảm size" thì không ghi chú nữa
        ){
          const originalSizes = headersArr
            .filter(h => !isNaN(parseFloat(h)))
            .map(s => s.trim())
            .filter(Boolean)
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .filter(s => Number(rawRecord[s]) > 0)
            .map(s => s.toString());

          const femaleSizes = Object.keys(sizeFixData)
            .map(s => parseFloat(s))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b)
            .map(n => n.toString());

          if (checkHasRealSizeFix(originalSizes, femaleSizes)) {
            remarkValue = "Size fixed";
          }
        }


      const payload = {
        rpro: currentRpro,
        so: document.getElementById("info-so").textContent,
        customers: document.getElementById("info-customers").textContent,
        gender: genderVal,
        mold: document.getElementById("info-mold").textContent,
        pu: document.getElementById("info-pu").textContent,
        fabric: document.getElementById("info-fabric").textContent,
        bom: document.getElementById("info-bom").textContent,
        total: Number(document.getElementById("supp-total").textContent) || 0,
        remark: remarkValue, // ✅ chỉ ghi "Size fixed" khi có giảm thật
        remark2: remarkNote
      };


      const inputs = document.querySelectorAll(".input-supp");
      console.log("🔍 Số ô nhập tìm thấy:", inputs.length);

      const sizeArray = [];
      inputs.forEach(inp => {
        const size = inp.dataset.size;
        const key = normalizeSizeKey(size);
        const numValue = Number(inp.value) || 0;
        payload[key] = numValue;
        sizeArray.push({ size: key, value: numValue });
      });

      console.table(sizeArray);
      console.log("📦 Payload gửi lên Supabase:", payload);

      try {
        const { error } = await supabase
          .from("supplement")
          .upsert([payload], { onConflict: "rpro" });

        if (error) throw error;

        // ✅ Gọi popup xác nhận hành động tiếp theo
        const action = await askNextAction();
        if (action === "new") {
          // 🧹 Reset form & quay về màn hình quét
          document.getElementById("manualRpro").value = "";
          document.getElementById("size-table-container").innerHTML = "";
          document.getElementById("order-info").classList.add("hidden");
          document.getElementById("btn-confirm-supplement").disabled = true;
          
        } else {
          // ⏸ Ở lại đơn hiện tại
          console.log("🟢 Người dùng chọn ở lại đơn hiện tại.");
        }

        logVisit("Supplement", "Confirm");
      } catch (err) {
        alert("❌ Lỗi khi lưu: " + err.message);
        console.error(err);
      }
    });
});



// ==================== KHỞI TẠO QR ==================== //
window.addEventListener("load", () => {
  const container = document.getElementById("qr-reader");
  if (!container) return;

  const html5QrCode = new Html5Qrcode("qr-reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.3333 },
    qrText => {
      html5QrCode.stop().catch(console.error);
      handleScanned(qrText);
    }
  ).catch(err => console.error("Could not start scanner:", err));
});
