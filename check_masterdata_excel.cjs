/**
 * check_masterdata_excel.cjs
 * Bước 1: Kiểm tra file MASTER DATA.xlsx - tên sheets và tên cột
 */
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'MASTER DATA.xlsx');
console.log('📂 Đọc file:', filePath);

const wb = XLSX.readFile(filePath);
console.log('\n📋 Danh sách Sheets:');
wb.SheetNames.forEach((name, i) => {
  console.log(`  [${i}] ${name}`);
});

// Đọc sheet đầu tiên để xem cột
const firstSheet = wb.SheetNames[0];
console.log(`\n🔍 Đang đọc sheet đầu tiên: "${firstSheet}"`);
const ws = wb.Sheets[firstSheet];

// Lấy header row
const headers = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 })[0];
console.log('\n📌 Các cột trong file Excel:');
headers.forEach((h, i) => {
  if (h) console.log(`  [${i}] "${h}"`);
});

// Lấy 3 dòng đầu để xem dữ liệu mẫu
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log(`\n📊 Tổng số dòng dữ liệu: ${rows.length}`);
console.log('\n🔎 3 dòng đầu tiên:');
rows.slice(0, 3).forEach((row, i) => {
  const key = row['PRO ORDER'] || row['PRO ODER'] || row['RPRO'] || Object.values(row)[2];
  console.log(`  Dòng ${i+1}: PRO ORDER/ODER = "${key}"`);
});

// Tìm cột key (PRO ORDER hoặc PRO ODER)
const sampleRow = rows[0] || {};
const possibleKeys = Object.keys(sampleRow).filter(k => 
  k.includes('PRO') || k.includes('ORDER') || k.includes('ODER')
);
console.log('\n🔑 Các cột có liên quan đến PRO ORDER:', possibleKeys);
