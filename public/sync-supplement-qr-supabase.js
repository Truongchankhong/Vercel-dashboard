// public/sync-supplement-qr-supabase.js

import { supabase } from "./supabaseClient.node.js";
import fs from "fs";
import path from "path";

// Thư mục local để lưu dữ liệu và ảnh
const SAVE_DIR = "C:/Users/prod.public/Desktop/SUPPLEMENT QR DATA";

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
}

async function syncFromSupabase() {
  try {
    // Lấy các record chưa tải về
    let { data, error } = await supabase
      .from("supplement_scans")
      .select("*")
      .eq("downloaded", false);

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log("✅ Không có dữ liệu mới");
      return;
    }

    // Tải từng ảnh từ Supabase Storage
    for (const row of data) {
      if (!row.photo_url) {
        console.log(`⚠️ Record ${row.id} không có photo_url`);
        continue;
      }

      try {
        console.log("⬇️ Đang tải:", row.photo_url);
        const res = await fetch(row.photo_url, { method: "GET" });
        if (!res.ok) {
          console.error(`❌ Lỗi tải ảnh (${res.status}): ${row.photo_url}`);
          continue;
        }

        // Lưu ảnh về local
        const buffer = Buffer.from(await res.arrayBuffer());
        const safeRpro = row.rpro.replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `${safeRpro}_Box${row.box_no}_Bag${row.bag_no}.jpg`;
        const imgPath = path.join(SAVE_DIR, fileName);
        fs.writeFileSync(imgPath, buffer);
        console.log("📷 Lưu ảnh:", imgPath);

        // Sau khi tải thành công → Xóa file trên Supabase Storage
        try {
          const url = new URL(row.photo_url);
          const pathname = url.pathname; 
          // "/storage/v1/object/public/supplement-temp/RPRO-250903-1269/11_P10_1758706447012.jpg"

          const bucket = "supplement-temp";
          const objectPath = pathname.split(`${bucket}/`)[1]; 
          // "RPRO-250903-1269/11_P10_1758706447012.jpg"

          const { error: removeError } = await supabase
            .storage
            .from(bucket)
            .remove([objectPath]);

          if (removeError) {
            console.error("❌ Lỗi xóa Supabase:", removeError.message);
          } else {
            console.log("🗑️ Đã xóa Supabase:", objectPath);
          }
        } catch (delErr) {
          console.error("❌ Parse URL lỗi:", delErr.message);
        }

      } catch (imgErr) {
        console.error("❌ Lỗi tải ảnh:", imgErr.message);
      }
    }

    // Đánh dấu record đã tải
    const ids = data.map(r => r.id);
    const { error: updateError } = await supabase
      .from("supplement_scans")
      .update({ downloaded: true })
      .in("id", ids);

    if (updateError) throw updateError;
    console.log("✅ Đã đánh dấu downloaded=true cho record");

  } catch (err) {
    console.error("❌ Lỗi sync:", err.message);
  }
}

// Gọi ngay khi chạy
syncFromSupabase();
