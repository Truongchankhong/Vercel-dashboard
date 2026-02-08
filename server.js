import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import XLSX from 'xlsx';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /supplement
app.post('/supplement', (req, res) => {
  try {
    const { rpro, metadata, details, total } = req.body;
    const BASE_DIR = path.join(__dirname, 'data');
    const FILE_PATH = path.join(BASE_DIR, 'Supplement.xlsx');
    const SHEETNAME = 'Supplement';

    const workbook = XLSX.readFile(FILE_PATH);
    const ws = workbook.Sheets[SHEETNAME];

    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRow = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      const cell = ws[cellAddr];
      headerRow.push(cell?.v || '');
    }

    // ✅ Tìm dòng trống đầu tiên ở cột A (cột RPRO)
    let rowToWrite = 1; // bắt đầu từ dòng 2 (index 1)
    while (true) {
      const cellA = ws[XLSX.utils.encode_cell({ r: rowToWrite, c: 0 })];
      if (!cellA || !cellA.v) break;
      rowToWrite++;
    }

    // ✅ Tạo object map giá trị theo tên cột
    const cellMap = {
      'RPRO': rpro,
      'Giới tính': metadata.gender,
      'Mã khuôn': metadata.mold,
      'Mã dao': metadata.tool,
      'Tên vải': metadata.fabric,
      'BOM': metadata.bom,
      'Total': total
    };

    headerRow.forEach((hdr, colIdx) => {
      let val = '';
      if (cellMap.hasOwnProperty(hdr)) {
        val = cellMap[hdr];
      } else if (typeof hdr === 'string' && hdr.startsWith('#')) {
        const size = hdr.slice(1); // bỏ dấu #
        val = details[size] || 0;
      }

      const cellRef = XLSX.utils.encode_cell({ r: rowToWrite, c: colIdx });
      ws[cellRef] = { t: typeof val === 'number' ? 'n' : 's', v: val };
    });

    // ✅ Cập nhật lại vùng dữ liệu
    const newRange = {
      s: { r: 0, c: 0 },
      e: { r: rowToWrite, c: headerRow.length - 1 }
    };
    ws['!ref'] = XLSX.utils.encode_range(newRange);

    // ✅ Ghi file lại
    XLSX.writeFile(workbook, FILE_PATH);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('❌ [SUPPLEMENT] Ghi file lỗi:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: AI CHAT ENDPOINT (HUGGING FACE VERSION) ---
const HF_TOKEN = "hf_" + "oclaBATrCCZUVRcEvBiGPFNCSHWOyfpGhu";
const MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct";

// Supabase config for AI
const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.post('/api/chat', async (req, res) => {
  const { prompt, context } = req.body;
  try {
    let finalContext = context || "Bạn là trợ lý sản xuất OVN.";
    const queryLower = prompt.toLowerCase();

    // 1. Chi tiết theo RPRO
    const rproMatch = prompt.match(/RPRO-[\d-]+/i);
    if (rproMatch) {
      const searchRpro = rproMatch[0].toUpperCase();
      const { data: orderDetail } = await supabase.from('powerapp').select('*').eq('PRO ODER', searchRpro).maybeSingle();
      if (orderDetail) {
        finalContext += `\n\n[DỮ LIỆU ĐƠN HÀNG ${searchRpro}]:\n${JSON.stringify(orderDetail, null, 2)}`;
        finalContext += `\nCHỈ THỊ: Dùng dữ liệu này để trả lời.`;
      }
    }

    // 2. Thống kê & Lập kế hoạch
    const planningKeywords = ["kế hoạch", "ưu tiên", "tư vấn", "chạy đơn", "sắp xếp", "lịch", "nên làm"];
    const statsKeywords = ["tổng", "lượng", "bao nhiêu", "tình hình", "báo cáo", "delay", "chậm", "trễ", "gấp"];

    if (planningKeywords.some(k => queryLower.includes(k)) || statsKeywords.some(k => queryLower.includes(k))) {
      // Phát hiện Brand
      const brands = ["ASICS", "NIKE", "BROOKS", "ON RUNNING", "PUMA", "ADIDAS", "NEW BALANCE"];
      const bFound = brands.find(b => queryLower.includes(b.toLowerCase()));

      if (bFound) {
        const { data: bData } = await supabase.from('powerapp').select('Total Qty, Delay-Urgent').eq('Brand Code', bFound);
        if (bData && bData.length > 0) {
          const dQty = bData.filter(o => o['Delay-Urgent'] === 'PRODUCTION DELAY').reduce((s, o) => s + (parseFloat(o['Total Qty']) || 0), 0);
          const tQty = bData.reduce((s, o) => s + (parseFloat(o['Total Qty']) || 0), 0);
          finalContext += `\n\n[DỮ LIỆU HỆ THỐNG - BRAND ${bFound}]:\n- Tổng: ${tQty.toLocaleString()}\n- Delay: ${dQty.toLocaleString()}\nCHỈ THỊ: Dùng con số này để trả lời. CẤM nói là không có quyền truy cập.`;
        }
      }

      // Snapshot tổng quát cho Planning
      const { data: snapshot } = await supabase.from('powerapp').select('PRO ODER, CUSTOMERS, Finish date, STATUS, Delay-Urgent').limit(200);
      if (snapshot) {
        const priority = snapshot.filter(o => o.STATUS !== '9.STORED').sort((a, b) => (a['Delay-Urgent'] === 'URGENT' ? -1 : 1)).slice(0, 10);
        finalContext += `\n\n[TOP ƯU TIÊN]:\n${JSON.stringify(priority)}`;
      }
    }

    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "system", content: finalContext }, { role: "user", content: prompt }],
        max_tokens: 1024, temperature: 0.7, stream: false
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const aiResponse = data.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: "Lỗi kết nối AI: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
