import { supabase } from './supabaseClient.js';


let currentRpro = null;
let headersArr = [];
let useSizeFix = false;         
let showSizeFixValues = true;   
let rawRecord = null;           
let sizeFixData = {};           
let existingRecord = null;      

// === QR/CAMERA variables ===
let qrScanner = null;
let allowScan = true; 
let bagList = []; 
const safeIsScanning = () => typeof qrScanner?.isScanning === 'function' ? qrScanner.isScanning() : false;


// ========== QR/Status Helpers (Từ supplement-qr.js) ==========

function setStatus(msg) {
  const status = document.getElementById("scan-status");
  if (!status) return;

  let cleanMsg = (msg || "").toString();
  cleanMsg = cleanMsg.replace("qrScanner.isScanning is not a function", "Lỗi khởi động camera, vui lòng tải lại trang.").replace("Cannot clear while scan is ongoing, close it first.", "Đã dừng máy quét trước khi chụp.");
  
  status.classList.remove("hidden");
  status.textContent = cleanMsg;
}

function createMockBag(index, boxNo) {
    return {
        rpro: currentRpro || "UNKNOWN",
        boxNo: boxNo || "UNKNOWN",
        bagNo: `IMG_${index}`,
        photoBlob: null,
        photoStatus: "❌ Chưa chụp"
    };
}

function updateSaveButton() {
  const btnConfirm = document.getElementById("btn-confirm-supplement");
  if (!btnConfirm) return;

  if (currentRpro && document.getElementById("order-info-area")?.classList.contains('hidden') === false) {
    btnConfirm.disabled = false;
    btnConfirm.textContent = `Xác nhận Bù hàng (Lưu Size & ${bagList.length} Ảnh)`;
  } else {
    btnConfirm.disabled = true;
    btnConfirm.textContent = `Xác nhận Bù hàng (Lưu Size & Ảnh)`;
  }
}

// ========== Camera/QR Control (Từ supplement-qr.js) ==========

function updateAllowScan() {
  if (!qrScanner) return; 
  
  allowScan = !currentRpro;
  if (!allowScan) {
     if (safeIsScanning()) {
        qrScanner.stop().catch(e => console.error("Error stopping scanner:", e));
     }
  } else {
     document.getElementById("qr-reader")?.classList.remove('hidden');
     if (!safeIsScanning()) {
         startScanner();
     }
  }
}

function startScanner() {
  if (!qrScanner) return;
  
  document.getElementById("qr-reader")?.classList.remove('hidden');

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 200, height: 200 } },
    (qrText) => {
      if (allowScan) handleScanned(qrText);
    }
  ).catch(err => console.error("Scan init error:", err));
}

// ========== Lưu ảnh và bảng (Từ supplement-qr.js) ==========

async function saveImagesToSupabase() {
    if (bagList.length === 0) return { success: true };

    for (const b of bagList) {
        if (!b.photoBlob) continue;
        
        const bagIndex = bagList.indexOf(b) + 1;
        const boxNo = rawRecord.currentBoxNo || "NO_BOX";
        
        const path = `${b.rpro}/${boxNo}_Img${bagIndex}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase
            .storage.from("supplement-temp")
            .upload(path, b.photoBlob, { upsert: true });
        if (uploadError) throw new Error(`Lỗi upload ảnh ${bagIndex}: ${uploadError.message}`);

        const { data: publicUrlData } = supabase
            .storage.from("supplement-temp")
            .getPublicUrl(path);

        const { error: insertError } = await supabase.from("supplement_scans").insert([{
            rpro: b.rpro,
            box_no: boxNo,
            brand_code: rawRecord["Brand Code"],
            customer: rawRecord["CUSTOMERS"],
            molded: rawRecord["#MOLDED"],
            bom: rawRecord["BOM"],
            total_qty: rawRecord["Total Qty"],
            pu: rawRecord["PU"],
            fb: rawRecord["FB"],
            bag_no: `IMG_${bagIndex}`, 
            photo_url: publicUrlData.publicUrl,
        }]);
        if (insertError) throw new Error(`Lỗi insert record ảnh ${bagIndex}: ${insertError.message}`);
    }

    bagList.forEach(b => {
        if(b.photoBlob) URL.revokeObjectURL(URL.createObjectURL(b.photoBlob));
    });

    return { success: true };
}

function captureFromQrCamera(bagIndex, isRetake = false) {
  
  const qrVideo = document.querySelector("#qr-reader video");
  const canvas  = document.getElementById("photo-canvas");
  const ctx     = canvas.getContext("2d");
  const isNew = bagIndex === bagList.length && !isRetake;

  if (isNew) {
      const boxNo = rawRecord?.currentBoxNo || "NO_BOX";
      bagList.push(createMockBag(bagIndex + 1, boxNo));
  }
  
  const bagToUpdate = bagList[bagIndex];

  const targetWidth = 1280;
  const scale = targetWidth / qrVideo.videoWidth;
  canvas.width  = targetWidth;
  canvas.height = qrVideo.videoHeight * scale;

  ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);

  const btnTake = document.getElementById("btn-take-photo");
  const btnRetake = document.getElementById("btn-retake");
  const canvasEl = document.getElementById("photo-canvas");

  // HIỂN THỊ PREVIEW & NÚT CHỤP LẠI
  canvasEl.classList.remove("hidden");
  btnTake.classList.add("hidden");
  btnRetake.classList.remove("hidden"); 

  canvas.toBlob(blob => {
    bagToUpdate.photoBlob   = blob;
    bagToUpdate.photoStatus = `✅ Đã chụp (${Math.round(blob.size/1024)} KB)`;
    renderBagTable();

    const capturedCount = bagList.length;
    
    if (confirm(`✅ Đã ${isRetake ? 'chụp lại' : 'chụp'} Ảnh ${bagIndex + 1}/${capturedCount}. Bạn có muốn chụp ảnh tiếp theo?`)) {
        // RESET ĐỂ HIỆN LẠI NÚT CHỤP MỚI
        btnRetake.classList.add("hidden");
        btnTake.classList.remove("hidden"); 
        canvasEl.classList.add("hidden"); // Ẩn preview
        setStatus(`📸 Sẵn sàng chụp Ảnh ${capturedCount + 1}.`);
    } else {
         setStatus(`📸 Đã chụp ${capturedCount} ảnh. Bấm 'Chụp ảnh bịch' để chụp tiếp.`);
    }

    updateSaveButton();
  }, "image/jpeg", 0.8);
}


function renderBagTable() {
  const tbody = document.querySelector("#bag-table tbody");
  const thead = document.querySelector("#bag-table thead tr");

  // Đảm bảo tiêu đề có 6 cột
  if(thead && thead.children.length !== 6) {
      thead.innerHTML = `
          <th class="border px-2">RPRO</th>
          <th class="border px-2">Thùng</th>
          <th class="border px-2">Ảnh</th>
          <th class="border px-2">Trạng thái</th>
          <th class="border px-2">Preview</th> 
          <th class="border px-2">Thao tác</th>
      `;
  }
  
  tbody.innerHTML = ""; 

  bagList.forEach((b, i) => {
    const isCaptured = !!b.photoBlob;
    const saveMark = isCaptured ? "✅" : "❌";
    
    const previewUrl = isCaptured ? URL.createObjectURL(b.photoBlob) : '';
    const previewHtml = isCaptured 
        ? `<img src="${previewUrl}" 
                class="w-10 h-10 object-cover cursor-pointer" 
                onclick="showFullImage('${previewUrl}')"/>`
        : '';


    tbody.innerHTML += `<tr>
      <td class="border px-2">${b.rpro}</td>
      <td class="border px-2">${b.boxNo}</td>
      <td class="border px-2">Ảnh ${i + 1}</td>
      <td class="border px-2">${saveMark} ${b.photoStatus}</td>
      <td class="border px-2 text-center">${previewHtml}</td>
      <td class="border px-2 text-center">
        <button class="bg-red-500 text-white px-2 py-1 rounded text-xs" onclick="deleteBag(${i})">🗑️ Xóa</button>
      </td>
    </tr>`;
  });

  document.getElementById("bag-table")?.classList[bagList.length > 0 ? 'remove' : 'add']("hidden");
}

window.deleteBag = function(index) {
  if (index < 0 || index >= bagList.length) return;

  const removed = bagList.splice(index, 1)[0];
  
  if (removed.photoBlob) {
      URL.revokeObjectURL(URL.createObjectURL(removed.photoBlob));
  }
  
  bagList.forEach((b, i) => {
      b.bagNo = `IMG_${i + 1}`;
  });

  renderBagTable();
  updateSaveButton();
  setStatus(`🗑️ Đã xóa Ảnh ${index + 1}. Tổng còn ${bagList.length} ảnh.`);
};

window.showFullImage = function(url) {
    window.open(url, '_blank');
}


// ========== Size Logic (Từ supplement.js) ==========

function normalizeSizeKey(size) {
  return 'size_' + size.replace(/\./g, '_');
}

// Hàm tải dữ liệu và reset trạng thái khi quét/nhập RPRO
async function loadOrderInfo(rpro) {
  const loadingEl = document.getElementById("loading-status");
  if (loadingEl) loadingEl.classList.remove("hidden");

  const parts = rpro.split("|");
  const rproCode = parts.find(p => p.startsWith("RPRO")) || rpro;
  const boxNo = parts[2] ? parts[2].split("/")[0].trim() : "NO_BOX";
  
  // RESET TRẠNG THÁI
  currentRpro = rproCode;
  bagList = []; // Reset list ảnh khi load đơn hàng mới
  rawRecord = null;
  existingRecord = null;
  
  // DỪNG SCANNER VĨNH VIÊN VÀ GIỮ HIỂN THỊ CAMERA
  if (qrScanner && safeIsScanning()) {
      qrScanner.stop().catch(e => console.error("Error stopping scanner after successful box scan:", e));
  }
  // KHÔNG ẨN CAMERA TẠI ĐÂY
  allowScan = false;


  try {
    const res = await fetch("/powerapp.json", { cache: "no-store" });
    const { headers, data } = await res.json();
    headersArr = headers;

    const rec = data.find(r => (r["PRO ODER"] || "") === rproCode);
    if (!rec) {
      alert("Không tìm thấy đơn " + rproCode);
      document.getElementById("order-info-area")?.classList.add("hidden");
      document.getElementById("no-order-message")?.classList.remove("hidden");
      return;
    }
    document.getElementById("order-info-area")?.classList.remove("hidden");
    document.getElementById("no-order-message")?.classList.add("hidden");


    // Logic Size Fix
    const gender = rec["Giới tính"] || rec["GENDER"] || "";
    useSizeFix = false;
    showSizeFixValues = true;
    sizeFixData = {};

    if (gender === "Women's") {
      try {
        const resFix = await fetch("/sizefix.json", { cache: "no-store" });
        const sizefixJson = await resFix.json();
        sizeFixData = sizefixJson[rproCode] || {};
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
      .eq('rpro', rproCode)
      .limit(1);

    existingRecord = (existingRows && existingRows.length > 0) ? existingRows[0] : null;
    rawRecord = rec;

    rawRecord.currentBoxNo = boxNo;

    renderOrder(rec, existingRecord);
    renderBagTable(); 
    updateSaveButton(); 

    // Khởi tạo trạng thái chụp ảnh
    document.getElementById("scan-status")?.classList.remove("hidden");
    setStatus("✅ Đã tải đơn hàng. Bắt đầu nhập size bù và chụp ảnh.");
    document.getElementById("photo-section")?.classList.remove("hidden"); // HIỆN KHU VỰC CHỤP ẢNH

  } catch (err) {
    console.error("loadOrderInfo:", err);
    alert("Lỗi khi tải dữ liệu, vui lòng thử lại.");
    document.getElementById("order-info-area")?.classList.add("hidden");
    document.getElementById("no-order-message")?.classList.remove("hidden");
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

// 👉 Vẽ bảng size + metadata
function renderOrder(rec, existing = null) {
  document.getElementById("info-rpro").textContent = rec["PRO ODER"] || "";
  document.getElementById("info-customers").textContent = rec["CUSTOMERS"] || "";
  const gender = rec["Giới tính"] || rec["GENDER"] || "";
  document.getElementById("info-gender").textContent = gender;
  document.getElementById("info-mold").textContent = rec["Mã Khuôn"] || rec["#MOLD"] || "";
  document.getElementById("info-bom").textContent = rec["BOM"] || "";
  
  document.getElementById("order-info-area")?.classList.remove("hidden");


  const idx = headersArr.indexOf("CheckLL");
  const sizeKeys = idx >= 0 ? headersArr.slice(idx + 1) : [];

  const originalData = rec;
  const femaleData = sizeFixData || {};

  const originalSizes = sizeKeys
    .filter(s => Number(originalData[s]) > 0)
    .map(s => parseFloat(s))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)
    .map(n => n.toString());

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
          <th class="border px-2 py-1">Số bù</th>
          <th class="border px-2 py-1">PO Quantity</th>
        </tr>
      </thead>
      <tbody>
  `;

  originalSizes.forEach((sizeOriginal, idx) => {
    const sizeFemale = (gender === "Women's" && femaleSizes[idx] && showSizeFixValues) 
                        ? femaleSizes[idx] 
                        : "";

    const poQtyOriginal = Number(originalData[sizeOriginal]) || 0;
    const poQtyFemale = femaleSizes[idx] ? Number(femaleData[femaleSizes[idx]]) || 0 : 0;
    const poQty = (gender === "Women's" && useSizeFix && showSizeFixValues) ? poQtyFemale : poQtyOriginal;

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
  
  document.querySelectorAll(".input-supp").forEach(inp => {
    inp.addEventListener("input", updateTotal);
  });
  updateTotal();
  document.getElementById("btn-confirm-supplement").disabled = false;
}

function cancelSizeFix() {
  showSizeFixValues = false;  
  renderOrder(rawRecord, existingRecord);
}

function updateTotal() {
  const sum = [...document.querySelectorAll(".input-supp")]
    .reduce((acc, inp) => acc + Number(inp.value || 0), 0);
  document.getElementById("supp-total").textContent = sum;
}


// ========== Confirmation & Main Flow (Hàm Lưu chung) ==========

// 👉 Khi scan hoặc nhập tay
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

  loadOrderInfo(cleanText);
}

async function confirmSupplement() {
    const btnConfirm = document.getElementById("btn-confirm-supplement");
    btnConfirm.disabled = true;
    btnConfirm.textContent = "⏳ Đang lưu...";
    setStatus("🔄 Đang tiến hành lưu size và ảnh...");

    try {
        await saveImagesToSupabase();
        
        const genderVal = document.getElementById("info-gender").textContent.trim();
        const remarkNote = document.getElementById("note-textarea").value.trim();
        const payload = {
            rpro: currentRpro,
            so: rawRecord["SO"] || rawRecord["Sales Order"],
            customers: document.getElementById("info-customers").textContent,
            gender: genderVal,
            mold: document.getElementById("info-mold").textContent,
            pu: rawRecord["Mã dao"] || rawRecord["PU"],
            fabric: rawRecord["Tên vải"] || rawRecord["FB DESCRIPTION"],
            bom: document.getElementById("info-bom").textContent,
            total: Number(document.getElementById("supp-total").textContent),
            remark: (genderVal === "Women's" && useSizeFix && showSizeFixValues) ? "Size fixed" : "",
            remark2: remarkNote
        };
        document.querySelectorAll(".input-supp").forEach(inp => {
            payload[normalizeSizeKey(inp.dataset.size)] = Number(inp.value) || 0;
        });

        const { error: sizeError } = await supabase
            .from("supplement")
            .upsert([payload], { onConflict: "rpro" });
        if (sizeError) throw new Error(`Lỗi khi lưu dữ liệu size: ${sizeError.message}`);

        setStatus("✅ Đã lưu thành công! Tiếp tục scan tem thùng khác!");
        
        currentRpro = null;
        bagList = [];
        document.getElementById("order-info-area")?.classList.add("hidden");
        document.getElementById("no-order-message")?.classList.remove("hidden");
        
        // Khởi động lại scanner
        qrScanner = new Html5Qrcode("qr-reader"); 
        updateAllowScan(); 
        renderBagTable(); 
        
    } catch (err) {
        console.error("LỖI LƯU TỔNG HỢP:", err);
        const errorMsg = err?.message || err || "Lỗi không xác định."; 
        setStatus("❌ Lỗi khi lưu: " + errorMsg);
    } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Xác nhận Bù hàng (Lưu Size & Ảnh)";
    }
}


// ========== KHỞI TẠO CHUNG ==========

window.addEventListener("DOMContentLoaded", () => {
  
  // GÁN SỰ KIỆN CHO NÚT CHỤP ẢNH TẠI ĐÂY
  document.getElementById("btn-take-photo")
      .addEventListener("click", () => captureFromQrCamera(bagList.length));
  
  document.getElementById("btn-retake")
      .addEventListener("click", () => {
          const lastIndex = bagList.length - 1;
          if (lastIndex >= 0) captureFromQrCamera(lastIndex, true); 
      });

  document.getElementById("btn-manual-ok")
    .addEventListener("click", () => handleScanned(document.getElementById("manualRpro").value));

  document.getElementById("btn-confirm-supplement")
    .addEventListener("click", confirmSupplement);
    
  // Khởi tạo QR Scanner
  qrScanner = new Html5Qrcode("qr-reader");
  startScanner();
  setStatus("📦 Vui lòng quét thùng.");
  
  // Ẩn khu vực ảnh lúc đầu
  document.getElementById("photo-section")?.classList.add("hidden");
});

window.handleScanned = handleScanned;
window.cancelSizeFix = cancelSizeFix;