/**
 * debug_rpro.mjs - Kiểm tra đơn cụ thể trên Supabase
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RPRO = 'RPRO-260507-0202';

async function debug() {
  console.log(`\n🔍 Kiểm tra đơn: ${RPRO}\n`);

  // 1. Kiểm tra bảng supplement
  console.log('--- [Tầng 1] Bảng supplement ---');
  const { data: s1, error: e1 } = await supabase
    .from('supplement')
    .select('rpro, customers, pu, fb, total')
    .eq('rpro', RPRO)
    .maybeSingle();
  console.log('Kết quả:', s1, e1 ? '❌ Error: ' + e1.message : '');

  // 2. Kiểm tra bảng powerapp
  console.log('\n--- [Tầng 2] Bảng powerapp ---');
  const { data: s2, error: e2 } = await supabase
    .from('powerapp')
    .select('"PRO ODER", "CUSTOMERS", "PU", "Total Qty"')
    .eq('"PRO ODER"', RPRO)
    .maybeSingle();
  console.log('Kết quả (eq quoted):', s2, e2 ? '❌ ' + e2.message : '✅');

  const { data: s2b, error: e2b } = await supabase
    .from('powerapp')
    .select('"PRO ODER", "CUSTOMERS", "PU", "Total Qty"')
    .eq('PRO ODER', RPRO)
    .maybeSingle();
  console.log('Kết quả (eq unquoted):', s2b, e2b ? '❌ ' + e2b.message : '✅');

  // 3. Kiểm tra bảng Masterdata - cách cũ (sai)
  console.log('\n--- [Tầng 3] Bảng Masterdata - cách cũ (eq không quote) ---');
  const { data: s3old, error: e3old } = await supabase
    .from('Masterdata')
    .select('"PRO ODER", "CUSTOMERS", "PU", "Total Qty"')
    .eq('PRO ODER', RPRO)
    .maybeSingle();
  console.log('Kết quả cách cũ:', s3old, e3old ? '❌ ' + e3old.message : '✅');

  // 4. Kiểm tra bảng Masterdata - cách mới (đã sửa)
  console.log('\n--- [Tầng 3] Bảng Masterdata - cách mới (eq có quote) ---');
  const { data: s3new, error: e3new } = await supabase
    .from('Masterdata')
    .select('"PRO ODER", "CUSTOMERS", "PU", "Total Qty", "FB", "FB DESCRIPTION", "SO", "GENDER", "#MOLD", "BOM"')
    .eq('"PRO ODER"', RPRO)
    .maybeSingle();
  console.log('Kết quả cách mới:', s3new, e3new ? '❌ ' + e3new.message : '✅');

  // 5. Fuzzy search để xem đơn có tồn tại với tên gần giống không
  console.log('\n--- Tìm kiếm fuzzy trong Masterdata ---');
  const { data: fuzzy, error: efuzz } = await supabase
    .from('Masterdata')
    .select('"PRO ODER", "CUSTOMERS", "STATUS"')
    .ilike('"PRO ODER"', '%260507%')
    .limit(10);
  console.log('Fuzzy 260507:', fuzzy, efuzz ? '❌ ' + efuzz.message : '');

  // 6. Tìm trong Excel có không
  console.log('\n--- Kiểm tra xem supplement_confirm có không ---');
  const { data: sc, error: esc } = await supabase
    .from('supplement_confirm')
    .select('rpro, customers, created_at')
    .ilike('rpro', '%260507%')
    .limit(10);
  console.log('supplement_confirm fuzzy:', sc, esc ? '❌ ' + esc.message : '');
}

debug().catch(console.error);
