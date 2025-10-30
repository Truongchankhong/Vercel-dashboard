// Dùng bản cho browser
import { supabase } from "./supabaseClient.js";

// === BIẾN TOÀN CỤC ===
let currentBox = null;
let bagList = [];
let qrScanner = null; // Sẽ được tạo và hủy liên tục
let allowScan = true;
let isCameraOn = false;

// ========== HÀM TRỢ GIÚP MỚI: Dọn dẹp Camera ==========

/**
 * Hàm này dùng để dừng, dọn dẹp và hủy hoàn toàn đối tượng camera.
 * SỬA LỖI: Thay thế getState() bằng thuộc tính isScanning an toàn hơn.
 */
async function stopAndClearScanner() {
  if (qrScanner) {
    try {
      // SỬA LỖI: Dùng thuộc tính isScanning thay vì hàm getState()
      if (qrScanner.isScanning) {
        await qrScanner.stop();
        console.log("Scanner stopped.");
      }
      await qrScanner.clear();
      console.log("Scanner cleared.");
    } catch (err) {
      console.error("Error stopping or clearing scanner:", err);
    } finally {
      qrScanner = null;
      isCameraOn = false;
      const qrReaderEl = document.getElementById("qr-reader");
      if (qrReaderEl) {
        qrReaderEl.innerHTML = ""; // Dọn dẹp DOM cuối cùng
        qrReaderEl.classList.add("hidden");
      }
    }
  }
}

// ========== LOGIC QUÉT VÀ CHỤP ẢNH ĐÃ SỬA LỖI ==========

/**
 * Bắt đầu quét tem thùng. Sẽ tạo một đối tượng camera mới.
 */
function startBoxScanner() {
  if (qrScanner) {
    console.warn("Scanner already exists, stopping it first.");
    stopAndClearScanner();
  }
  allowScan = true;
  const qrReaderEl = document.getElementById("qr-reader");
  if(qrReaderEl) qrReaderEl.classList.remove("hidden");

  qrScanner = new Html5Qrcode("qr-reader");
  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 200, height: 200 } },
    (qrText) => {
      if (allowScan) {
        allowScan = false; // Chặn quét lại ngay lập tức
        handleBoxQR(qrText);
      }
    }
  ).catch(err => {
    setStatus(`❌ Lỗi camera ban đầu: ${err.message}`);
    console.error("Scan init error:", err)
  });
}

/**
 * Xử lý sau khi quét tem thùng thành công.
 */
async function handleBoxQR(qr) {
  setStatus("🔄 Đang xử lý QR thùng...");
  await stopAndClearScanner(); // Hủy camera ngay sau khi quét được mã

  // THAY ĐỔI: Tách chuỗi QR theo định dạng mới
  const parts = qr.split("|");
  const rpro = parts[1]?.trim();
  const boxInfo = parts[2]?.trim().split('/'); // Tách "1/8" thành ["1", "8"]

  // Kiểm tra định dạng có hợp lệ không
  if (!rpro || !boxInfo || boxInfo.length < 1) {
    setStatus("❌ Lỗi định dạng QR không hợp lệ. Vui lòng quét lại.");
    startBoxScanner();
    return;
  }

  const boxNo = boxInfo[0]; // Số thứ tự thùng, ví dụ: "1"
  const totalBoxes = boxInfo[1] || boxNo; // Tổng số thùng, ví dụ: "8"

  try {
    const res = await fetch("/powerapp.json");
    const { data } = await res.json();
    const rec = data.find(r => r["PRO ODER"] === rpro);

    if (!rec) {
      setStatus("❌ Không tìm thấy đơn " + rpro + ". Vui lòng quét lại.");
      startBoxScanner();
      return;
    }

    // THAY ĐỔI: Lưu boxNo và totalBoxes vào đối tượng currentBox
    currentBox = { rpro, boxNo, totalBoxes, ...rec };
    bagList = [];
    setStatus("✅ Đã quét thùng: " + rpro + ". Bấm 'Mở Camera' để bắt đầu chụp ảnh.");

    document.getElementById("box-info").innerHTML = `
      <p><b>RPRO:</b> ${rpro}</p>
      <p><b>Thùng:</b> ${boxNo} / ${totalBoxes}</p> <p><b>Customer:</b> ${rec["CUSTOMERS"] || "-"}</p>
      <p><b>Brand:</b> ${rec["Brand Code"] || "-"}</p>
      <p><b>#MOLDED:</b> ${rec["#MOLDED"] || "-"}</p>
      <p><b>Total Qty:</b> ${rec["Total Qty"] || "-"}</p>
      <p><b>BOM:</b> ${rec["BOM"] || "-"}</p>
      <p><b>PU:</b> ${rec["PU"] || "-"}</p>
      <p><b>FB:</b> ${rec["FB"] || "-"}</p>
    `;
    document.getElementById("box-info").classList.remove("hidden");
    renderBagTable();
    updateSaveButton();
    showPhotoSection();

  } catch (e) {
    console.error(e);
    setStatus("❌ Lỗi đọc dữ liệu đơn! Vui lòng quét lại.");
    startBoxScanner();
  }
}

/**
 * Bắt đầu camera ở chế độ chụp ảnh.
 */
/**
 * Reset toàn bộ giao diện và trạng thái để sẵn sàng quét thùng mới.
 */
function resetForNewScan() {
    setStatus("📦 Vui lòng quét tem thùng.");
    currentBox = null;
    bagList = [];

    // Ẩn các thành phần không cần thiết
    document.getElementById("box-info").classList.add("hidden");
    document.querySelector("#bag-table tbody").innerHTML = "";
    document.getElementById("bag-table").classList.add("hidden");
    document.getElementById("btn-save").classList.add("hidden");
    document.getElementById("photo-section").classList.add("hidden");
    
    // Bắt đầu lại camera để quét thùng
    startBoxScanner();
}
async function startCaptureMode(bagIndex) {
    if(isCameraOn) return;

    const qrContainer = document.getElementById('qr-reader');
    qrContainer.classList.remove('hidden');
    document.getElementById("photo-canvas").classList.add("hidden");

    qrScanner = new Html5Qrcode("qr-reader");
    setStatus("🔄 Đang mở camera...");

    try {
        await qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            () => {}
        );
        isCameraOn = true;

        const btnTake = document.getElementById("btn-take-photo");
        btnTake.textContent = `📷 CHỤP Ảnh ${bagIndex + 1}`;
        btnTake.classList.remove("bg-blue-500", "bg-orange-500");
        btnTake.classList.add("bg-green-600");
        setStatus(`✅ Camera đã mở. Căn chỉnh và nhấn 'CHỤP'.`);

    } catch (err) {
        console.error("Lỗi khởi tạo camera chụp ảnh:", err);
        setStatus(`❌ Lỗi camera: ${err.message}`);
        await stopAndClearScanner();
    }
}

/**
 * Thực hiện chụp ảnh và tắt camera.
 */
async function executeCapture(bagIndex, bagToUpdate) {
  if (!isCameraOn || !qrScanner) {
    setStatus("❌ Lỗi: Camera chưa được mở.");
    return;
  }

  setStatus("📸 Đang chụp...");
  const qrVideo = document.querySelector("#qr-reader video");
  const canvas  = document.getElementById("photo-canvas");
  const ctx     = canvas.getContext("2d");

  const targetWidth = 1280;
  const scale = targetWidth / qrVideo.videoWidth;
  canvas.width  = targetWidth;
  canvas.height = qrVideo.videoHeight * scale;
  ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);

  await stopAndClearScanner();

  canvas.toBlob(blob => {
    bagToUpdate.photoBlob   = blob;
    bagToUpdate.photoStatus = `✅ Đã chụp (${Math.round(blob.size/1024)} KB)`;
    renderBagTable();
    updateSaveButton();

    document.getElementById("photo-canvas").classList.remove("hidden");
    const btnTake = document.getElementById("btn-take-photo");
    const btnRetake = document.getElementById("btn-retake");
    btnTake.classList.add("hidden");
    btnRetake.classList.remove("hidden");
    
    const nextBagNumber = bagList.length + 1;
    btnTake.textContent = `▶️ Mở Camera Ảnh ${nextBagNumber}`;
    btnTake.classList.remove("bg-green-600", "bg-orange-500");
    btnTake.classList.add("bg-blue-500");

    if (confirm(`✅ Đã chụp Ảnh ${bagIndex + 1}. Bạn có muốn chụp ảnh tiếp theo?`)) {
        btnRetake.classList.add("hidden");
        btnTake.classList.remove("hidden");
        document.getElementById("photo-canvas").classList.add("hidden");
        setStatus(`📸 Sẵn sàng chụp ảnh tiếp theo.`);
    } else {
        setStatus(`📸 Đã chụp xong. Bấm 'Mở Camera' để chụp tiếp hoặc 'Lưu'.`);
    }
  }, "image/jpeg", 0.8);
}

// ========== CÁC HÀM KHÁC (GIỮ NGUYÊN) ==========

function setStatus(msg) {
  const statusEl = document.getElementById("scan-status");
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
}

function showPhotoSection() {
    if (currentBox) {
        document.getElementById("photo-section").classList.remove("hidden");
        const btnTake = document.getElementById("btn-take-photo");
        const nextBagNumber = bagList.length + 1;
        btnTake.textContent = `▶️ Mở Camera Ảnh ${nextBagNumber}`;
        btnTake.classList.remove("hidden", "bg-green-600", "bg-orange-500");
        btnTake.classList.add("bg-blue-500");
        document.getElementById("btn-retake").classList.add("hidden");
        document.getElementById("photo-canvas").classList.add("hidden");
    } else {
        document.getElementById("photo-section").classList.add("hidden");
    }
}

function updateSaveButton() {
  const btnSave = document.getElementById("btn-save");
  if (currentBox && bagList.some(b => b.photoBlob)) {
    const capturedCount = bagList.filter(b => b.photoBlob).length;
    btnSave.classList.remove("hidden");
    btnSave.disabled = false;
    btnSave.textContent = `Lưu ${capturedCount} ảnh lên Supabase`;
  } else {
    btnSave.classList.add("hidden");
  }
}

function createMockBag(index) {
    const boxNo = currentBox?.boxNo || "UNKNOWN";
    return {
        rpro: currentBox?.rpro || "UNKNOWN",
        boxNo: boxNo,
        bagNo: `IMG_${index}`,
        photoBlob: null,
        photoStatus: "❌ Chưa chụp"
    };
}

async function queryImagesByRpro() {
    const queryInputEl = document.getElementById('queryRpro');
    const resultEl = document.getElementById('query-result');
    const queryValue = queryInputEl.value.trim();

    if (!queryValue) {
        resultEl.innerHTML = '<span class="text-red-500">Vui lòng nhập RPRO hoặc RPRO|SốThùng.</span>';
        return;
    }

    resultEl.innerHTML = '🔄 Đang tìm kiếm...';

    // THAY ĐỔI: Xử lý cú pháp mới RPRO|SốThùng
    let rpro = queryValue;
    let boxNo = null;

    if (queryValue.includes('|')) {
        const parts = queryValue.split('|');
        rpro = parts[0].trim().toUpperCase();
        boxNo = parts[1].trim();
    } else {
        rpro = queryValue.toUpperCase();
    }

    try {
        // Xây dựng câu truy vấn động
        let query = supabase
            .from('supplement_scans')
            .select('*')
            .eq('rpro', rpro);

        // Nếu có số thùng, thêm điều kiện lọc theo số thùng
        if (boxNo) {
            query = query.eq('box_no', boxNo);
        }

        // Thực thi câu truy vấn
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            let message = `❌ Không tìm thấy ảnh nào cho RPRO ${rpro}`;
            if (boxNo) {
                message += ` và thùng số ${boxNo}.`;
            }
            resultEl.innerHTML = `<span class="text-gray-500">${message}</span>`;
            return;
        }

        let html = `<p class="font-semibold text-green-600">✅ Tìm thấy ${data.length} ảnh:</p><div class="flex flex-wrap gap-2 mt-2">`;
        data.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString('vi-VN');
            const time = new Date(item.created_at).toLocaleTimeString('vi-VN');
            html += `
                <div class="text-center p-1 border rounded bg-white">
                    <p class="text-xs font-bold">Thùng ${item.box_no || '?'}</p>
                    <img src="${item.photo_url}" class="w-20 h-20 object-cover cursor-pointer" onclick="window.open('${item.photo_url}', '_blank')"/>
                    <p class="text-xs text-gray-700 mt-1">${item.bag_no}</p>
                    <p class="text-xs text-gray-500">${date} ${time}</p>
                </div>`;
        });
        html += '</div>';
        resultEl.innerHTML = html;

    } catch (err) {
        console.error("Lỗi truy vấn Supabase:", err);
        resultEl.innerHTML = `<span class="text-red-500">❌ Lỗi truy vấn: ${err.message}</span>`;
    }
}

function renderBagTable() {
    const tbody = document.querySelector("#bag-table tbody");
    tbody.innerHTML = ""; 

    bagList.forEach((b, i) => {
        const isCaptured = !!b.photoBlob;
        const previewUrl = isCaptured ? URL.createObjectURL(b.photoBlob) : '';
        const previewHtml = isCaptured 
            ? `<img src="${previewUrl}" class="w-10 h-10 object-cover cursor-pointer" onclick="window.open('${previewUrl}', '_blank')"/>` 
            : '';

        tbody.innerHTML += `<tr>
            <td class="border px-2">${b.rpro}</td>
            <td class="border px-2">${b.boxNo}</td>
            <td class="border px-2">Ảnh ${i + 1}</td>
            <td class="border px-2">${b.photoStatus}</td>
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
    renderBagTable();
    updateSaveButton();
    setStatus(`🗑️ Đã xóa Ảnh ${index + 1}. Tổng còn ${bagList.length} ảnh.`);
};

async function saveToSupabase() {
    if (!currentBox) return alert("❌ Chưa scan thùng!");
    const bagsToSave = bagList.filter(b => b.photoBlob);
    if (bagsToSave.length === 0) return alert("❌ Chưa chụp ảnh nào để lưu!");

    const btnSave = document.getElementById("btn-save");
    btnSave.disabled = true;
    btnSave.textContent = "⏳ Đang lưu...";
    setStatus("🔄 Đang lưu lên Supabase...");

    try {
        // ... (vòng lặp for để upload ảnh giữ nguyên, không thay đổi)
        for (const [index, b] of bagsToSave.entries()) {
            const path = `${b.rpro}/Thung_${b.boxNo}/Img${index + 1}_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase
                .storage.from("supplement-temp")
                .upload(path, b.photoBlob, { upsert: true });
            if (uploadError) throw new Error(`Lỗi upload ảnh ${index + 1}: ${uploadError.message}`);

            const { data: publicUrlData } = supabase.storage.from("supplement-temp").getPublicUrl(path);

            const { error: insertError } = await supabase.from("supplement_scans").insert([{
                rpro: b.rpro, box_no: b.boxNo, brand_code: currentBox["Brand Code"],
                customer: currentBox["CUSTOMERS"], molded: currentBox["#MOLDED"],
                bom: currentBox["BOM"], total_qty: currentBox["Total Qty"],
                pu: currentBox["PU"], fb: currentBox["FB"], bag_no: `IMG_${index + 1}`,
                photo_url: publicUrlData.publicUrl,
            }]);
            if (insertError) throw new Error(`Lỗi insert record ảnh ${index + 1}: ${insertError.message}`);
        }

        setStatus("✅ Đã lưu thành công!");
        
        // THAY ĐỔI: Gọi hàm reset tập trung
        resetForNewScan();

    } catch (err) {
        console.error("LỖI LƯU TỔNG HỢP:", err);
        setStatus("❌ Lỗi khi lưu: " + err.message);
        btnSave.disabled = false;
        btnSave.textContent = "Lưu Supabase";
    }
}

// ========== KHỞI TẠO ==========

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-back")
    .addEventListener("click", () => window.location.href = "/");
  document.getElementById("btn-query-rpro")
    ?.addEventListener("click", queryImagesByRpro);
  document.getElementById("btn-save").onclick = saveToSupabase;
// THÊM SỰ KIỆN CHO NÚT MỚI
  document.getElementById("btn-reset-scan")
    .addEventListener("click", () => location.reload());


  document.getElementById("btn-back")
    .addEventListener("click", () => window.location.href = "/");
  document.getElementById("btn-query-rpro")
    ?.addEventListener("click", queryImagesByRpro);
  document.getElementById("btn-save").onclick = saveToSupabase;
  // SỬA LỖI: Tách biệt logic Mở camera và Chụp ảnh
  document.getElementById("btn-take-photo").onclick = () => {
    if (!currentBox) {
        setStatus("❌ Vui lòng quét thùng trước.");
        return;
    }

    if (isCameraOn) {
        // --- Logic Chụp ảnh ---
        // Chụp cho ảnh cuối cùng trong danh sách
        const captureIndex = bagList.length - 1;
        const bagToUpdate = bagList[captureIndex];
        if (bagToUpdate) {
            executeCapture(captureIndex, bagToUpdate);
        }
    } else {
        // --- Logic Mở camera cho ảnh MỚI ---
        // Chỉ tạo ảnh mới khi bấm Mở camera
        const newBagIndex = bagList.length;
        bagList.push(createMockBag(newBagIndex + 1));
        renderBagTable();
        startCaptureMode(newBagIndex);
    }
  };

  document.getElementById("btn-retake").onclick = () => {
    const lastIndex = bagList.length - 1;
    if (lastIndex >= 0) {
        const bagToUpdate = bagList[lastIndex];
        bagToUpdate.photoBlob = null;
        bagToUpdate.photoStatus = "❌ Chưa chụp";
        renderBagTable();
        startCaptureMode(lastIndex);
    }
  };
  
  
  document.getElementById("btn-scan-box")?.classList.add("hidden");
  document.getElementById("btn-scan-bag")?.classList.add("hidden");
  document.getElementById("input-bag-count")?.closest("div").classList.add("hidden");

  setStatus("📦 Vui lòng quét tem thùng.");
  startBoxScanner();
});