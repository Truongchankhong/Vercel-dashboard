// Thay thế phần upload hiện tại bằng hàm này
import { supabase } from './supabaseClient.js';

async function uploadSupplementData() {
  try {
    // đảm bảo total mới nhất
    updateTotal();

    const rpro = currentRpro;
    if (!rpro) {
      alert("Chưa chọn RPRO!");
      return;
    }

    const payload = {
      rpro,
      gender: document.getElementById("info-gender")?.textContent.trim() || "",
      mold: document.getElementById("info-mold")?.textContent.trim() || "",
      tool: document.getElementById("info-tool")?.textContent.trim() || "",
      fabric: document.getElementById("info-fabric")?.textContent.trim() || "",
      bom: document.getElementById("info-bom")?.textContent.trim() || "",
      total: Number(document.getElementById("supp-total")?.textContent || 0),
      note: document.getElementById("note-textarea")?.value?.trim() || ""
    };

    console.log("STEP 1 — payload base:", payload);

    // 1) Try get columns via RPC (if you created get_table_columns)
    let columnNames = [];
    try {
      const { data: colsRpc, error: errRpc } = await supabase
        .rpc('get_table_columns', { p_table: 'supplement' });

      if (errRpc) {
        console.warn("RPC get_table_columns error (ok to ignore if not created):", errRpc);
      } else if (Array.isArray(colsRpc) && colsRpc.length > 0) {
        // rpc may return array of objects { column_name: '...' }
        columnNames = colsRpc.map(c => (c.column_name || c.name || c).toString());
      }
    } catch (e) {
      console.warn("RPC call failed:", e);
    }

    console.log("STEP 2 — columnNames from RPC (may be empty):", columnNames);

    // 2) fallback: try to get one row to read keys (works only if table has at least one row)
    if (columnNames.length === 0) {
      try {
        const { data: sampleRows, error: errSample } = await supabase
          .from('supplement')
          .select('*')
          .limit(1);

        if (!errSample && Array.isArray(sampleRows) && sampleRows.length > 0) {
          columnNames = Object.keys(sampleRows[0]);
        }
      } catch (e) {
        console.warn("Fallback sampleRows failed:", e);
      }
    }

    console.log("STEP 3 — columnNames after fallback (may still be empty):", columnNames);

    // 3) Build list of size keys from inputs
    const inputSizeKeys = [];
    document.querySelectorAll('.input-supp').forEach(inp => {
      const size = inp.dataset.size;
      const key = normalizeSizeKey(size); // e.g. size_9_5
      const value = Number(inp.value) || 0;
      inputSizeKeys.push(key);
      // If columnNames known, only add if exists; if columnNames empty, add anyway
      if (columnNames.length === 0 || columnNames.includes(key)) {
        payload[key] = value;
      } else {
        console.warn(`Column ${key} not found in DB columns; skipping (or create column in table)`);
      }
    });

    // If columnNames was empty, ensure we still attempted to include input keys (log)
    if (columnNames.length === 0) {
      console.log("WARNING: columnNames empty — adding all detected size keys to payload (DB may ignore unknown fields).");
      // ensure any keys not present were added (already added above when columnNames empty)
    }

    console.log("FINAL payload to send:", payload);
    console.log("Detected inputSizeKeys:", inputSizeKeys);

    // 4) Upsert — wrap payload in array to be explicit
    const { data, error } = await supabase
      .from('supplement')
      .upsert([payload], { onConflict: 'rpro', returning: 'representation' });

    console.log("Supabase response:", { data, error });

    if (error) {
      // Common errors: RLS (permission), column does not exist (will be ignored), conflict on unique constraint
      alert("Lỗi khi lưu: " + error.message + ". Kiểm tra console để biết chi tiết.");
      console.error("Supabase upsert error detail:", error);
      // Helpful hint
      if (error.message && error.message.toLowerCase().includes('permission')) {
        alert("Có vẻ quyền (RLS) đang chặn. Kiểm tra policy RLS cho table supplement.");
      }
      return;
    }

    alert("✅ Lưu thành công!");
    console.log("Upsert result data:", data);
  } catch (err) {
    console.error("Unexpected error in uploadSupplementData:", err);
    alert("Lỗi bất ngờ: " + (err.message || JSON.stringify(err)));
  }
}

// Gắn vào nút
document.getElementById("btn-confirm-supplement")?.addEventListener("click", uploadSupplementData);
