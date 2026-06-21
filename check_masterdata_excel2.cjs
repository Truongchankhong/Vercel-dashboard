/**
 * check_masterdata_excel2.cjs
 * Bước 2: Đọc sheet DATABASE từ MASTER DATA.xlsx và kiểm tra cột
 */
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'MASTER DATA.xlsx');
console.log('📂 Đọc file:', filePath);

const wb = XLSX.readFile(filePath);
const sheetName = 'DATABASE';
console.log(`\n🔍 Đọc sheet: "${sheetName}"`);
const ws = wb.Sheets[sheetName];

if (!ws) {
  console.error('❌ Không tìm thấy sheet DATABASE');
  process.exit(1);
}

// Lấy header row
const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const headers = allRows[0];
console.log('\n📌 Các cột trong sheet DATABASE:');
headers.forEach((h, i) => {
  if (h !== null && h !== undefined && h !== '') {
    console.log(`  [${i}] "${h}"`);
  }
});

// Lấy dữ liệu
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log(`\n📊 Tổng số dòng dữ liệu: ${rows.length}`);

// Tìm cột PRO ORDER trong sheet này
const sampleRow = rows[0] || {};
const allKeys = Object.keys(sampleRow);
console.log('\n🔑 Tất cả tên cột trong dữ liệu:');
allKeys.slice(0, 30).forEach(k => console.log(`  "${k}"`));

// Tìm cột key
const proOrderKey = allKeys.find(k => 
  k.includes('PRO') || k.toUpperCase().includes('RPRO') || k.toUpperCase().includes('ORDER') || k.toUpperCase().includes('ODER')
);
console.log('\n🎯 Cột PRO ORDER tìm được:', proOrderKey);

// Xem 5 giá trị đầu của cột PRO ORDER
if (proOrderKey) {
  console.log('\n📋 5 giá trị đầu của cột PRO ORDER:');
  rows.slice(0, 5).forEach((row, i) => {
    console.log(`  [${i+1}] "${row[proOrderKey]}"`);
  });
}
