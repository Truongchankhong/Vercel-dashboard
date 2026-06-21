import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const RPRO = 'RPRO-260526-0272';

async function check() {
  console.log(`\n🔍 Checking data for: ${RPRO}\n`);

  const { data: tracking, error: trackingError } = await supabase
    .from('supplement_tracking')
    .select('id, rpro, section, action, quantity, created_at')
    .eq('rpro', RPRO)
    .order('created_at', { ascending: true });

  if (trackingError) {
    console.error('Error fetching tracking:', trackingError);
    return;
  }

  const { data: confirm, error: confirmError } = await supabase
    .from('supplement_confirm')
    .select('id, rpro, updated_at, created_at')
    .eq('rpro', RPRO)
    .maybeSingle();

  if (confirmError) {
    console.error('Error fetching confirm:', confirmError);
    return;
  }

  console.log('supplement_confirm row:');
  console.log(JSON.stringify(confirm, null, 2));

  if (confirm) {
    console.log(`- confirm.updated_at raw: ${confirm.updated_at}`);
    const d = new Date(confirm.updated_at);
    console.log(`  parsed Date: ${d.toString()}`);
    console.log(`  toLocaleString: ${d.toLocaleString('vi-VN')}`);
    const toLocalDate = (dateVal) => {
        if (!dateVal) return null;
        const d2 = new Date(dateVal);
        return new Date(d2.getTime() - d2.getTimezoneOffset() * 60000);
    };
    console.log(`  export/toLocalDate: ${toLocalDate(confirm.updated_at)?.toISOString()}`);
  }
}

check().catch(console.error);
