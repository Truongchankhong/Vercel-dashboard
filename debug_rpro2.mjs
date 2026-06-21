/**
 * debug_rpro2.mjs - Kiểm tra chi tiết hơn
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RPRO = 'RPRO-260507-0202';

async function debug() {
  console.log(`\n🔍 Debug chi tiết: ${RPRO}\n`);

  // 1. Kiểm tra schema bảng supplement (lấy 1 dòng để xem cột)
  console.log('--- Schema bảng supplement (cột thực tế) ---');
  const { data: sSchema, error: eSchema } = await supabase
    .from('supplement')
    .select('*')
    .limit(1);
  if (sSchema && sSchema.length > 0) {
    console.log('Các cột supplement:', Object.keys(sSchema[0]));
  } else {
    console.log('Lỗi:', eSchema?.message);
  }

  // 2. Query supplement không có cột fb
  console.log('\n--- Tầng 1: supplement (không chọn fb) ---');
  const { data: s1, error: e1 } = await supabase
    .from('supplement')
    .select('rpro, customers, pu, total')
    .eq('rpro', RPRO)
    .maybeSingle();
  console.log('Kết quả:', s1 || '❌ Không có', e1?.message || '');

  // 3. Kiểm tra powerapp - xem cột thực tế
  console.log('\n--- Schema bảng powerapp (cột thực tế) ---');
  const { data: pSchema } = await supabase
    .from('powerapp')
    .select('*')
    .limit(1);
  if (pSchema && pSchema.length > 0) {
    const cols = Object.keys(pSchema[0]);
    const relevant = cols.filter(c => 
      c.includes('ODER') || c.includes('ORDER') || c.includes('FB') || 
      c.includes('vải') || c.includes('Vải') || c.includes('Khuôn') ||
      c.includes('dao') || c.includes('SO') || c.includes('Sales')
    );
    console.log('Các cột liên quan:', relevant);
  }

  // 4. Lấy đơn 260507-0202 từ powerapp với tất cả cột
  console.log('\n--- Tầng 2: powerapp - lấy đơn 260507-0202 ---');
  const { data: p1, error: ep1 } = await supabase
    .from('powerapp')
    .select('*')
    .eq('"PRO ODER"', RPRO)
    .maybeSingle();
  if (p1) {
    // Chỉ hiện các cột không null
    const relevant2 = {};
    Object.keys(p1).forEach(k => {
      if (p1[k] !== null && p1[k] !== '' && p1[k] !== 0) relevant2[k] = p1[k];
    });
    console.log('Powerapp data (non-null fields):', relevant2);
  } else {
    console.log('Lỗi powerapp:', ep1?.message);
  }

  // 5. Check xem đơn 260507-0202 có trong Excel không
  console.log('\n--- Kiểm tra Masterdata fuzzy cho 0202 ---');
  const { data: fuzz2 } = await supabase
    .from('Masterdata')
    .select('"PRO ODER", "CUSTOMERS", "STATUS"')
    .ilike('"PRO ODER"', '%260507-020%')
    .limit(20);
  console.log('Masterdata 260507-020x:', fuzz2?.map(r => r['PRO ODER']));
}

debug().catch(console.error);
