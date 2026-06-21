/**
 * sync_missing_masterdata.mjs
 * So sánh MASTER DATA.xlsx (sheet DATABASE) với bảng Masterdata trên Supabase
 * và upload các đơn còn thiếu
 * 
 * Chạy:  node sync_missing_masterdata.mjs          ← chỉ kiểm tra
 *        node sync_missing_masterdata.mjs --upload  ← kiểm tra + upload
 */
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === CẤU HÌNH ===
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const CHECK_BATCH = 100;   // batch nhỏ để tránh URL quá dài
const UPLOAD_CHUNK = 200;  // batch upload

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === MAPPING: Tên cột Excel DATABASE → Tên cột Supabase Masterdata ===
const EXCEL_TO_SUPABASE = {
  'So':               'SO',
  'PRO ORDER':        'PRO ODER',       // ← KEY KHÁC NHAU CHÍNH
  'Brand':            'Brand Code',
  'Customer':         'CUSTOMERS',
  'Type Oder':        '#MOLDED',
  '#MOLDTYPE':        '#MOLD',
  'QtyOrder':         'Total Qty',
  'Recieved Material':'RECEIVED (MATERIAL)',
  'Recieved Logo':    'RECEIVED (LOGO)',
  'LAMINATION(PRO)':  'Laminating (Pro)',
  'PRE(PRO)':         'Prefitting (Pro)',
  'Slipting(PRO)':    'Slipting (Pro)',
  'Sub Return':       'THĂNG HOA',
  'Instruction Sub':  'SUB',
  'MOLD_IN(PRO)':     'Molding Pro (IN)',
  'MOLD_OUT(PRO)':    'Molding Pro',
  'LEAN_IN(PRO)':     'IN lean Line (Pro)',
  'LEAN_OUT(PRO)':    'Out lean Line (Pro)',
  'LINE CODE':        'IN lean Line (MACHINE)',
  'STORED':           'STORED',
  'Finish Date(PPC)': 'Finish date',
  'PPC CMF':          'PPC Confirm',
  'Status':           'STATUS',
  'BOM':              'BOM',
  '#LAST':            '#Last',
  'Gender':           'GENDER',
  'CODE PU1':         'PU',
  'Description PU1':  'PU DESCRIPTION',
  'DL PU1':           'DL PU',
  'CODE PU2':         'PU2',
  'Description PU2':  'PU2 DESCRIPTION',
  'DL PU2':           'DL PU2',
  'CODE PU3':         'PU3',
  'Description PU3':  'PU3 DESCRIPTION',
  'DL PU3':           'DL PU3',
  'CODE FABRIC':      'FB',
  'Description FB':   'FB DESCRIPTION',
  'DL FB':            'DL FB',
  'CODE LOGO1':       'LOGO',
  'Description LOGO1':'LOGO DESCRIPTION',
  'DL LOGO1':         'DL LOGO',
  'CODE LOGO2':       'CODE LOGO2',
  'Description LOGO2':'Description LOGO2',
  'DL LOGO2':         'DL LOGO2',
  'CODE LOGO3':       'CODE LOGO3',
  'Description LOGO3':'Description LOGO3',
  'DL LOGO3':         'DL LOGO3',
  'CODE LOGO4':       'CODE LOGO4',
  'Description LOGO4':'Description LOGO4',
  'DL LOGO4':         'DL LOGO4',
  // Sizes
  'S3':'3',     'S3.5':'3.5',   'S4':'4',     'S4.5':'4.5',
  'S5':'5',     'S5.5':'5.5',   'S6':'6',     'S6.5':'6.5',
  'S7':'7',     'S7.5':'7.5',   'S8':'8',     'S8.5':'8.5',
  'S9':'9',     'S9.5':'9.5',   'S10':'10',   'S10.5':'10.5',
  'S11':'11',   'S11.5':'11.5', 'S12':'12',   'S12.5':'12.5',
  'S13':'13',   'S13.5':'13.5', 'S14':'14',   'S14.5':'14.5',
  'S15':'15',   'S15.5':'15.5', 'S16':'16',   'S16.5':'16.5',
  'S17':'17',   'S18':'18',     'S19':'19',   'S20':'20',
  'S21':'21',   'S22':'22',     'S23':'23',   'S24':'24',
  'S25':'25',   'S26':'26',     'S27':'27',   'S28':'28',
  'S29':'29',   'S30':'30',     'S31':'31',   'S32':'32',
  'S33':'33',   'S34':'34',     'S35':'35',   'S36':'36',
  'S37':'37',   'S38':'38',     'S39':'39',   'S40':'40',
  'S41':'41',   'S42':'42',     'S43':'43',   'S44':'44',
  'S45':'45',   'S46':'46',     'S47':'47',   'S48':'48',
  'S49':'49',
};

const NUMERIC_SUPABASE_COLS = new Set([
  'Total Qty', 'DL PU', 'DL FB', 'DL LOGO',
  'DL PU2', 'DL PU3', 'DL LOGO2', 'DL LOGO3', 'DL LOGO4',
  // sizes
  '3','3.5','4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5',
  '10','10.5','11','11.5','12','12.5','13','13.5','14','14.5','15','15.5',
  '16','16.5','17','18','19','20','21','22','23','24','25','26','27','28',
  '29','30','31','32','33','34','35','36','37','38','39','40','41','42',
  '43','44','45','46','47','48','49',
]);

// Hàm sleep để tránh rate limit
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const doUpload = process.argv.includes('--upload');
  
  console.log('🚀 === SYNC MISSING MASTERDATA ===');
  console.log(`📋 Chế độ: ${doUpload ? '✅ KIỂM TRA + UPLOAD' : '🔍 CHỈ KIỂM TRA'}\n`);

  // 1. Đọc file Excel
  console.log('📂 Đọc MASTER DATA.xlsx (sheet DATABASE)...');
  const wb = XLSX.readFile(path.join(__dirname, 'MASTER DATA.xlsx'));
  const ws = wb.Sheets['DATABASE'];
  if (!ws) { console.error('❌ Không tìm thấy sheet DATABASE'); process.exit(1); }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`📊 Tổng số dòng trong Excel: ${rawRows.length}`);

  // 2. Map cột
  console.log('🔄 Chuyển đổi tên cột Excel → Supabase...');
  const mappedRows = rawRows
    .map(row => {
      const newRow = {};
      for (const [excelKey, supaKey] of Object.entries(EXCEL_TO_SUPABASE)) {
        let val = row[excelKey];

        if (typeof val === 'string') val = val.trim();
        if (val === '' || val === 'NONE' || val === 'null' || val === undefined) val = null;

        if (NUMERIC_SUPABASE_COLS.has(supaKey) && val !== null) {
          const num = Number(val);
          val = !isNaN(num) ? num : null;
        }

        newRow[supaKey] = val;
      }
      return newRow;
    })
    .filter(row => row['PRO ODER'] && String(row['PRO ODER']).trim() !== '');

  const uniqueProOders = [...new Set(mappedRows.map(r => r['PRO ODER']))];
  console.log(`✅ Sau khi map: ${mappedRows.length} dòng | ${uniqueProOders.length} PRO ODER unique\n`);

  // 3. Fetch existing PRO ODER từ Supabase (batch nhỏ 100 để tránh URL limit)
  console.log(`🔍 Kiểm tra Supabase (batch ${CHECK_BATCH} mỗi lần)...`);
  const existingSet = new Set();
  let errors = 0;

  for (let i = 0; i < uniqueProOders.length; i += CHECK_BATCH) {
    const batch = uniqueProOders.slice(i, i + CHECK_BATCH);
    
    try {
      const { data, error } = await supabase
        .from('Masterdata')
        .select('"PRO ODER"')
        .in('"PRO ODER"', batch);

      if (error) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Lỗi batch ${i}: ${error.message}`);
      } else {
        (data || []).forEach(r => existingSet.add(r['PRO ODER']));
      }
    } catch (e) {
      errors++;
      if (errors <= 3) console.error(`\n  ⚠️ Exception batch ${i}: ${e.message}`);
    }

    const done = Math.min(i + CHECK_BATCH, uniqueProOders.length);
    process.stdout.write(`\r  Tiến độ: ${done}/${uniqueProOders.length} | Tìm thấy: ${existingSet.size}`);
    
    // Rate limit: 10ms giữa các request
    await sleep(10);
  }

  console.log(`\n✅ Supabase có: ${existingSet.size} PRO ODER`);
  if (errors > 0) console.log(`  ⚠️ Có ${errors} lỗi trong quá trình kiểm tra`);

  // 4. Tìm đơn thiếu
  const missingRows = mappedRows.filter(r => !existingSet.has(r['PRO ODER']));
  // Deduplicate by PRO ODER (keep last occurrence)
  const missingMap = new Map();
  missingRows.forEach(r => missingMap.set(r['PRO ODER'], r));
  const missingDedup = [...missingMap.values()];

  console.log(`\n📋 === KẾT QUẢ KIỂM TRA ===`);
  console.log(`  📊 Tổng đơn Excel:        ${mappedRows.length}`);
  console.log(`  ✅ Đã có trên Supabase:   ${existingSet.size}`);
  console.log(`  ❌ Còn thiếu (unique):    ${missingDedup.length}`);

  if (missingDedup.length === 0) {
    console.log('\n🎉 Tất cả đơn đã có trên Supabase! Không cần upload thêm.');
    return;
  }

  console.log('\n📝 Danh sách 20 đơn thiếu đầu tiên:');
  missingDedup.slice(0, 20).forEach((r, i) => {
    console.log(`  [${i+1}] ${r['PRO ODER']} | ${r['CUSTOMERS'] || ''} | ${r['STATUS'] || ''}`);
  });

  if (!doUpload) {
    console.log(`\n💡 Chạy lại với --upload để upload ${missingDedup.length} đơn:`);
    console.log(`   node sync_missing_masterdata.mjs --upload`);
    return;
  }

  // 5. Lấy max STT hiện có trên Supabase để gán tiếp
  console.log('\n🔢 Lấy max STT từ Supabase...');
  let maxSTT = 0;
  try {
    const { data: sttData } = await supabase
      .from('Masterdata')
      .select('"STT"')
      .order('"STT"', { ascending: false })
      .limit(1);
    if (sttData && sttData.length > 0 && sttData[0]['STT']) {
      maxSTT = Number(sttData[0]['STT']) || 0;
    }
  } catch (e) { /* ignore */ }
  console.log(`  Max STT hiện tại: ${maxSTT} → Sẽ gán từ ${maxSTT + 1}`);

  // Gán STT cho các đơn thiếu
  const missingWithSTT = missingDedup.map((row, idx) => ({
    ...row,
    'STT': maxSTT + idx + 1,
  }));

  // 6. UPLOAD đơn còn thiếu
  console.log(`\n📤 Bắt đầu upload ${missingWithSTT.length} đơn còn thiếu...`);
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < missingWithSTT.length; i += UPLOAD_CHUNK) {
    const chunk = missingWithSTT.slice(i, i + UPLOAD_CHUNK);

    try {
      const { error } = await supabase
        .from('Masterdata')
        .insert(chunk);

      if (error) {
        console.error(`\n  ❌ Lỗi chunk ${i}-${i+chunk.length}: ${error.message}`);
        if (error.details) console.error(`     ${error.details}`);
        totalFailed += chunk.length;
      } else {
        totalSuccess += chunk.length;
      }
    } catch (e) {
      console.error(`\n  ❌ Exception chunk ${i}: ${e.message}`);
      totalFailed += chunk.length;
    }

    process.stdout.write(`\r  Tiến độ: ${Math.min(i + UPLOAD_CHUNK, missingWithSTT.length)}/${missingWithSTT.length} | ✅ ${totalSuccess} | ❌ ${totalFailed}`);
    await sleep(50); // Rate limit
  }

  console.log(`\n\n🎉 === HOÀN TẤT ===`);
  console.log(`  ✅ Upload thành công: ${totalSuccess} đơn`);
  if (totalFailed > 0) console.log(`  ❌ Thất bại: ${totalFailed} đơn`);
}

main().catch(err => {
  console.error('\n❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
