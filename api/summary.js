import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'powerapp.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const machineKey = 'LAMINATION MACHINE (PLAN)';  // ✅ cột đúng theo file JSON
    const qtyKey = 'Total Qty';
    const sheetKey = 'DL PU';

    const machineMap = {};

    data.forEach(row => {
      const machine = (row[machineKey] || '').toString().trim();
      const qty = Number(row[qtyKey]?.toString().replace(/,/g, '')) || 0;
      if (!machine) return;
      machineMap[machine] = (machineMap[machine] || 0) + qty;
    });

    const result = Object.entries(machineMap).map(([machine, total]) => ({
      machine,
      total,
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (err) {
    console.error('SUMMARY API ERROR:', err);
    res.status(500).json({ error: 'Lỗi server đọc JSON' });
  }
}
