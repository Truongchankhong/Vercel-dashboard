import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'powerapp.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json([]);
    }

    const header = Object.keys(data[0]);
    const rows = data.map(item => Object.values(item));
    res.status(200).json([header, ...rows]);
  } catch (err) {
    console.error('DATA API ERROR:', err);
    res.status(500).json({ error: 'Lỗi server đọc JSON' });
  }
}
