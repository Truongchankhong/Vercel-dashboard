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

// --- NEW: AI CHAT ENDPOINT ---
const GEMINI_API_KEY = "AIzaSyAmZxLaoIh_Ff3nmnzo4iL_lL04js1irec";
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${context}\n\nNgười dùng hỏi: ${prompt}` }]
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error("Gemini Error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    res.json({ response: aiResponse });

  } catch (err) {
    console.error('❌ [CHAT] Lỗi AI:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
