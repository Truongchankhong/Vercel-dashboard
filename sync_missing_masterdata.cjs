/**
 * sync_missing_masterdata.cjs
 * So sánh MASTER DATA.xlsx với bảng Masterdata trên Supabase
 * và upload các đơn còn thiếu
 */
const XLSX = require('xlsx');
const path = require('path');
const https = require('https');

// === CẤU HÌNH ===
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const CHUNK_SIZE = 200;
const BATCH_SIZE = 1000;

// === MAPPING: TÊN CỘT EXCEL (DATABASE sheet) → TÊN CỘT SUPABASE (Masterdata) ===
const EXCEL_TO_SUPABASE = {
  'So': 'SO',
  'PRO ORDER': 'PRO ODER',          // ← ĐÂY LÀ KEY KHÁC NHAU
  'Brand': 'Brand Code',
  'Customer': 'CUSTOMERS',
  'Type Oder': '#MOLDED',
  '#MOLDTYPE': '#MOLD',
  'QtyOrder': 'Total Qty',
  'Recieved Material': 'RECEIVED (MATERIAL)',
  'Recieved Logo': 'RECEIVED (LOGO)',
  'LAMINATION(PRO)': 'Laminating (Pro)',
  'PRE(PRO)': 'Prefitting (Pro)',
  'Slipting(PRO)': 'Slipting (Pro)',
  'Sub Return': 'THĂNG HOA',
  'Instruction Sub': 'SUB',
  'MOLD_IN(PRO)': 'Molding Pro (IN)',
  'MOLD_OUT(PRO)': 'Molding Pro',
  'LEAN_IN(PRO)': 'IN lean Line (Pro)',
  'LEAN_OUT(PRO)': 'Out lean Line (Pro)',
  'LINE CODE': 'IN lean Line (MACHINE)',
  'STORED': 'STORED',
  'Finish Date(PPC)': 'Finish date',
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
  'CODE LOGO1': 'LOGO',
  'Description LOGO1': 'LOGO DESCRIPTION',
  'DL LOGO1': 'DL LOGO',
  'CODE LOGO2': 'CODE LOGO2',
  'Description LOGO2': 'Description LOGO2',
  'DL LOGO2': 'DL LOGO2',
  'CODE LOGO3': 'CODE LOGO3',
  'Description LOGO3': 'Description LOGO3',
  'DL LOGO3': 'DL LOGO3',
  'CODE LOGO4': 'CODE LOGO4',
  'Description LOGO4': 'Description LOGO4',
  'DL LOGO4': 'DL LOGO4',
  // Size columns
  'S3': '3', 'S3.5': '3.5', 'S4': '4', 'S4.5': '4.5',
  'S5': '5', 'S5.5': '5.5', 'S6': '6', 'S6.5': '6.5',
  'S7': '7', 'S7.5': '7.5', 'S8': '8', 'S8.5': '8.5',
  'S9': '9', 'S9.5': '9.5', 'S10': '10', 'S10.5': '10.5',
  'S11': '11', 'S11.5': '11.5', 'S12': '12', 'S12.5': '12.5',
  'S13': '13', 'S13.5': '13.5', 'S14': '14', 'S14.5': '14.5',
  'S15': '15', 'S15.5': '15.5', 'S16': '16', 'S16.5': '16.5',
  'S17': '17', 'S18': '18', 'S19': '19', 'S20': '20',
  'S21': '21', 'S22': '22', 'S23': '23', 'S24': '24',
  'S25': '25', 'S26': '26', 'S27': '27', 'S28': '28',
  'S29': '29', 'S30': '30', 'S31': '31', 'S32': '32',
  'S33': '33', 'S34': '34', 'S35': '35', 'S36': '36',
  'S37': '37', 'S38': '38', 'S39': '39', 'S40': '40',
  'S41': '41', 'S42': '42', 'S43': '43', 'S44': '44',
  'S45': '45', 'S46': '46', 'S47': '47', 'S48': '48',
  'S49': '49',
};

const NUMERIC_COLS = ['Total Qty', 'DL PU', 'DL FB', 'DL LOGO',
  'DL PU2', 'DL PU3', 'DL LOGO2', 'DL LOGO3', 'DL LOGO4'];

// Kiểm tra có phải cột size không (là số hoặc số.5)
const isSizeCol = (key) => /^\s*\d+(\.\d+)?\s*$/.test(String(key).trim());

// === HÀM GỌI SUPABASE REST API ===
function supabaseRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
      }
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(data ? JSON.parse(data) : []); }
          catch { resolve([]); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fetchAllExistingProOder(allProOders) {
  const existingSet = new Set();
  for (let i = 0; i < allProOders.length; i += BATCH_SIZE) {
    const batch = allProOders.slice(i, i + BATCH_SIZE);
    const filter = batch.map(p => encodeURIComponent(p)).join(',');
    try {
      const data = await supabaseRequest(
        'GET',
        `Masterdata?select="PRO ODER"&"PRO ODER"=in.(${batch.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')})`
      );
      (data || []).forEach(r => existingSet.add(r['PRO ODER']));
    } catch (e) {
      console.error(`  ⚠️ Lỗi fetch batch ${i}-${i+BATCH_SIZE}:`, e.message);
    }
    process.stdout.write(`\r  Đang kiểm tra Supabase: ${Math.min(i + BATCH_SIZE, allProOders.length)}/${allProOders.length}...`);
  }
  return existingSet;
}

async function upsertChunk(chunk) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/Masterdata`);
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(chunk));
    req.end();
  });
}

async function main() {
  console.log('🚀 === SYNC MISSING MASTERDATA ===\n');

  // 1. Đọc file Excel
  console.log('📂 Đọc file MASTER DATA.xlsx (sheet DATABASE)...');
  const wb = XLSX.readFile(path.join(__dirname, 'MASTER DATA.xlsx'));
  const ws = wb.Sheets['DATABASE'];
  if (!ws) { console.error('❌ Không tìm thấy sheet DATABASE'); process.exit(1); }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`📊 Tổng số dòng trong Excel: ${rawRows.length}`);

  // 2. Map cột và clean dữ liệu
  console.log('🔄 Đang chuyển đổi tên cột...');
  const mappedRows = rawRows
    .map(row => {
      const newRow = {};
      for (const excelKey of Object.keys(EXCEL_TO_SUPABASE)) {
        const supaKey = EXCEL_TO_SUPABASE[excelKey];
        let val = row[excelKey];

        // Normalize string
        if (typeof val === 'string') val = val.trim();
        if (val === '' || val === 'NONE' || val === 'null' || val === undefined) val = null;

        // Convert numeric
        if (NUMERIC_COLS.includes(supaKey) || isSizeCol(supaKey)) {
          if (val !== null) {
            const num = Number(val);
            val = !isNaN(num) ? num : null;
          }
        }

        // Convert Excel date serial to string if needed
        if (typeof val === 'number' && (supaKey.includes('date') || supaKey.includes('Date') ||
          supaKey.includes('(Pro)') || supaKey.includes('STORED') || supaKey === 'PPC Confirm' ||
          supaKey.includes('lean Line') || supaKey.includes('Molding') || supaKey.includes('Received') || 
          supaKey.includes('Laminating') || supaKey.includes('Prefitting') || supaKey.includes('Slipting') ||
          supaKey === 'THĂNG HOA' || supaKey === 'SUB' || supaKey === 'Finish date')) {
          // Keep as string representation
          val = String(val);
        }

        newRow[supaKey] = val;
      }
      return newRow;
    })
    .filter(row => row['PRO ODER'] && String(row['PRO ODER']).trim() !== '');

  console.log(`✅ Sau khi map: ${mappedRows.length} dòng hợp lệ (có PRO ODER)`);

  // 3. Lấy danh sách PRO ODER đã có trên Supabase
  console.log('\n🔍 Kiểm tra Supabase - lấy danh sách PRO ODER đã có...');
  const allProOders = [...new Set(mappedRows.map(r => r['PRO ODER']))];
  console.log(`  Tổng unique PRO ODER trong Excel: ${allProOders.length}`);

  // Dùng Supabase JS client thay vì raw HTTP để handle filtering tốt hơn
  // Load @supabase/supabase-js
  let existingSet;
  try {
    // Try using node-fetch + supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    existingSet = new Set();
    for (let i = 0; i < allProOders.length; i += BATCH_SIZE) {
      const batch = allProOders.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('Masterdata')
        .select('"PRO ODER"')
        .in('"PRO ODER"', batch);
      
      if (error) {
        console.error(`  ⚠️ Lỗi:`, error.message);
      } else {
        (data || []).forEach(r => existingSet.add(r['PRO ODER']));
      }
      process.stdout.write(`\r  Đã kiểm tra: ${Math.min(i + BATCH_SIZE, allProOders.length)}/${allProOders.length}...`);
    }
    console.log(`\n✅ Số PRO ODER đã có trên Supabase: ${existingSet.size}`);

    // 4. Lọc ra các đơn còn thiếu
    const missingRows = mappedRows.filter(r => !existingSet.has(r['PRO ODER']));
    console.log(`\n📋 === KẾT QUẢ ===`);
    console.log(`  📊 Tổng đơn trong Excel: ${mappedRows.length}`);
    console.log(`  ✅ Đã có trên Supabase: ${existingSet.size}`);
    console.log(`  ❌ Còn thiếu: ${missingRows.length}`);

    if (missingRows.length === 0) {
      console.log('\n🎉 Tất cả đơn đã có trên Supabase! Không cần upload thêm.');
      return;
    }

    console.log('\n📝 Danh sách 20 đơn thiếu đầu tiên:');
    missingRows.slice(0, 20).forEach((r, i) => {
      console.log(`  [${i+1}] ${r['PRO ODER']} | ${r['CUSTOMERS'] || ''} | Status: ${r['STATUS'] || ''}`);
    });

    // 5. Hỏi xác nhận trước khi upload
    const answer = process.argv[2];
    if (answer !== '--upload') {
      console.log(`\n💡 Chạy lại với flag --upload để upload ${missingRows.length} đơn còn thiếu:`);
      console.log(`   node sync_missing_masterdata.cjs --upload`);
      return;
    }

    // 6. Upload các đơn còn thiếu
    console.log(`\n📤 Bắt đầu upload ${missingRows.length} đơn còn thiếu...`);
    let totalSuccess = 0;
    let totalError = 0;

    for (let i = 0; i < missingRows.length; i += CHUNK_SIZE) {
      const chunk = missingRows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('Masterdata')
        .upsert(chunk, { onConflict: '"PRO ODER"' });

      if (error) {
        console.error(`\n  ❌ Lỗi chunk ${i}-${i+CHUNK_SIZE}:`, error.message);
        if (error.details) console.error('  Chi tiết:', error.details);
        totalError += chunk.length;
      } else {
        totalSuccess += chunk.length;
        process.stdout.write(`\r  Tiến độ upload: ${totalSuccess}/${missingRows.length}...`);
      }
    }

    console.log(`\n\n✅ === HOÀN TẤT ===`);
    console.log(`  ✅ Upload thành công: ${totalSuccess} đơn`);
    if (totalError > 0) console.log(`  ❌ Lỗi: ${totalError} đơn`);

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    throw err;
  }
}

main().catch(err => {
  console.error('❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
