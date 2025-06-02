import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'data', 'Powerapp.xlsx');
const outputPath = path.join(process.cwd(), 'data', 'powerapp.json');

try {
  if (!fs.existsSync(inputPath)) {
    throw new Error('❌ Không tìm thấy file Powerapp.xlsx trong thư mục /data');
  }

  const workbook = xlsx.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Sử dụng header thực tế thay vì index
  const json = xlsx.utils.sheet_to_json(sheet, {
    defval: "",     // giữ ô trống là chuỗi rỗng thay vì undefined
    raw: false      // ép dữ liệu về dạng string nếu có thể
  });

  fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');
  console.log('✅ Đã tạo file powerapp.json thành công!');
} catch (error) {
  console.error('🚫 Lỗi:', error.message);
}
