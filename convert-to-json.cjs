const XLSX = require('xlsx');
const fs = require('fs');

// === 1. Đọc file Excel MỚI ===
const wb = XLSX.readFile('./data/Powerapp (V21.10.25).xlsx');

// === 2. Tạo BẢN ĐỒ ÁNH XẠ (TỪ MỚI SANG CŨ) ===
// ĐÃ SỬA: Bỏ "CheckLL" và thêm các cột LOGO mới
const newToOldMapping = {
  // Cú pháp: 'Tên Cột Mới': 'Tên Cột Cũ'
  'Index': 'STT',
  'So': 'SO',
  'PRO ORDER': 'PRO ODER',
  'Brand': 'Brand Code',
  'Customer': 'CUSTOMERS',
  'Type Oder': '#MOLDED',
  '#MOLDTYPE': '#MOLD',
  'QtyOrder': 'Total Qty',
  'Recieved Material': 'RECEIVED (MATERIAL)',
  'Recieved Logo': 'RECEIVED (LOGO)',
  'LAMINATION (PRO)': 'Laminating (Pro)',
  'PRE (PRO)': 'Prefitting (Pro)',
  'Slipting (PRO)': 'Slipting (Pro)',
  'Sub Return': 'THĂNG HOA',
  'Instruction Sub': 'SUB',
  'MOLD_IN (PRO)': 'Molding Pro (IN)',
  'MOLD_OUT (PRO)': 'Molding Pro',
  'LEAN_IN (PRO)': 'IN lean Line (Pro)',
  'LEAN_OUT (PRO)': 'Out lean Line (Pro)',
  'LINE CODE': 'IN lean Line (MACHINE)',
  'STORED': 'STORED',
  'Finish Date (PPC)': 'Finish date',
  'PPC CMF': 'PPC Confirm',
  'Status': 'STATUS',
  'BOM': 'BOM',
  '#LAST': '#Last',
  'Gender': 'GENDER',
  'CODE PU1': 'PU',
  'Description PU1': 'PU DESCRIPTION',
  'DL PU1': 'DL PU',
  'CODE PU2': 'PU2',
  'Description PU2': 'PU2 DESCRIPTION',
  'DL PU2': 'DL PU2',
  'CODE PU3': 'PU3',
  'Description PU3': 'PU3 DESCRIPTION',
  'DL PU3': 'DL PU3',
  'CODE FABRIC': 'FB',
  'Description FB': 'FB DESCRIPTION',
  'DL FB': 'DL FB',
  
  // === SỬA LỖI QUAN TRỌNG: Thêm các cột LOGO ===
  // Dịch cột mốc cũ (DL LOGO)
  'CODE LOGO1': 'LOGO',
  'Description LOGO1': 'LOGO DESCRIPTION',
  'DL LOGO1': 'DL LOGO', // Cột mốc cũ là "DL LOGO"
  
  // Thêm các cột logo mới (để giữ thứ tự)
  // Chúng ta sẽ dịch chúng về chính nó
  'CODE LOGO2': 'CODE LOGO2',
  'Description LOGO2': 'Description LOGO2',
  'DL LOGO2': 'DL LOGO2',
  'CODE LOGO3': 'CODE LOGO3',
  'Description LOGO3': 'Description LOGO3',
  'DL LOGO3': 'DL LOGO3',
  
  // Cột mốc MỚI (DL LOGO4) mà bạn chỉ
  // Chúng ta cũng dịch nó về chính nó
  'CODE LOGO4': 'CODE LOGO4',
  'Description LOGO4': 'Description LOGO4',
  'DL LOGO4': 'DL LOGO4', 
  
  // === TOÀN BỘ CỘT SIZE (TỪ MỚI -> CŨ) ===
  // Bỏ qua S1, S2 (vì web cũ ko hiểu)
  'S3': '3',
  'S3.5': '3.5',
  'S4': '4',
  'S4.5': '4.5',
  'S5': '5',
  'S5.5': '5.5',
  'S6': '6',
  'S6.5': '6.5',
  'S7': '7',
  'S7.5': '7.5',
  'S8': '8',
  'S8.5': '8.5',
  'S9': '9',
  'S9.5': '9.5',
  'S10': '10',
  'S10.5': '10.5',
  'S11': '11',
  'S11.5': '11.5',
  'S12': '12',
  'S12.5': '12.5',
  'S13': '13',
  'S13.5': '13.5',
  'S14': '14',
  'S14.5': '14.5',
  'S15': '15',
  'S15.5': '15.5',
  'S16': '16',


  'M.LAM (PLAN)':'LAMINATION MACHINE (PLAN)',
  'M. LEANLINE(PLAN)':'LEANLINE PLAN',
  'LAMINATION MACHINE (REALTIME)': 'LAMINATION MACHINE (REALTIME)',
  'LEANLINE (REALTIME)': 'LEANLINE (REALTIME)',
  'DL-XG':'Delay-Urgent',

};

// === 3. Tạo powerapp.json từ sheet "Data Power app" ===
const sheetName = 'Data Power app';
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.error(`❌ Không tìm thấy sheet "${sheetName}"`);
  process.exit(1);
}

// Đọc header MỚI từ file Excel
const headersNew = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 })[0]
  .map(h => (h || "").toString().trim())
  .filter(h => h.length > 0);

// Đọc data
const jsonDataNew = XLSX.utils.sheet_to_json(ws, { defval: '' });

// "Dịch" dữ liệu sang tên cột CŨ
const dataOldFormat = jsonDataNew.map(rowNew => {
  const rowOld = {};
  for (const newKey in newToOldMapping) {
    if (Object.prototype.hasOwnProperty.call(newToOldMapping, newKey)) {
      const oldKey = newToOldMapping[newKey];
      rowOld[oldKey] = rowNew[newKey] || ''; 
    }
  }
  return rowOld;
});

// "Dịch" HEADER sang tên cột CŨ (Giữ nguyên thứ tự từ file Excel)
const finalHeadersOld = headersNew
  .map(newKey => newToOldMapping[newKey]) 
  .filter(oldKey => oldKey !== undefined); // Lọc bỏ S1, S2...

// Ghi ra file powerapp.json
fs.writeFileSync(
  './public/powerapp.json',
  JSON.stringify({ headers: finalHeadersOld, data: dataOldFormat }, null, 2),
  'utf-8'
);
console.log(`✅ powerapp.json đã được tạo (${dataOldFormat.length} dòng, ${finalHeadersOld.length} cột)`);


// === 4. Tạo sizefix.json từ sheet "Size run fix" (GIỮ NGUYÊN) ===
const sizeFixSheet = wb.Sheets['Size run fix'];
if (!sizeFixSheet) {
  console.warn("⚠️ Không tìm thấy sheet 'Size run fix'. Bỏ qua việc tạo sizefix.json.");
  console.log('✅ Tất cả chuyển đổi hoàn tất.');
  process.exit(0); 
}
try {
  const range = XLSX.utils.decode_range(sizeFixSheet['!ref']);
  const headerRow = range.s.r + 1;
  const dataStartRow = headerRow + 1;
  const startCol = range.s.c;
  const endCol = range.e.c;
  const sizeFixData = {};
  for (let r = dataStartRow; r <= range.e.r; r++) {
    const rproCell = sizeFixSheet[XLSX.utils.encode_cell({ r, c: startCol })];
    if (!rproCell || !rproCell.v) continue;
    const rpro = rproCell.v.toString().trim();
    const sizes = {};
    for (let c = startCol + 1; c <= endCol; c++) {
      const sizeCell = sizeFixSheet[XLSX.utils.encode_cell({ r: headerRow, c })];
      const qtyCell = sizeFixSheet[XLSX.utils.encode_cell({ r, c })];
      if (!sizeCell || sizeCell.v === undefined || sizeCell.v === '' || !qtyCell || qtyCell.v === undefined || qtyCell.v === '') {
        continue;
      }
      const size = sizeCell.v.toString().trim();
      const qty = parseInt(qtyCell.v, 10);
      if (!isNaN(qty) && qty > 0) {
        sizes[size] = qty;
      }
    }
    if (Object.keys(sizes).length > 0) {
      sizeFixData[rpro] = sizes;
    }
  }
  fs.writeFileSync('./public/sizefix.json', JSON.stringify(sizeFixData, null, 2), 'utf-8');
  console.log(`✅ sizefix.json đã được tạo (${Object.keys(sizeFixData).length} đơn hàng)`);
} catch (e) {
  console.error("❌ Đã xảy ra lỗi khi xử lý 'Size run fix':", e.message);
}
console.log('✅ Tất cả chuyển đổi hoàn tất.');