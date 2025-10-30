import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'powerapp.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const { machine } = req.query;
    const machineKey = 'LAMINATION MACHINE (PLAN)';

    const filtered = data
      .filter(row =>
        (row[machineKey] || '').toString().trim().toUpperCase() === machine.toString().trim().toUpperCase()
      )
      .map(row => Object.values(row));

    if (filtered.length === 0) {
      return res.status(200).json([]);
    }

    const header = Object.keys(data[0]);
    res.status(200).json([header, ...filtered]);
  } catch (err) {
    console.error('DETAILS API ERROR:', err);
    res.status(500).json({ error: 'Lỗi đọc JSON' });
  }
}
