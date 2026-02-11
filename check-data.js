import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log("🔍 Checking database for NIKE orders with status 9.STORED...");

    // 1. Check exact match
    const { data: exact, error: err1 } = await supabase
        .from('powerapp')
        .select('count')
        .ilike('Brand Code', '%NIKE%')
        .eq('STATUS', '9.STORED');

    console.log(`- Exact '9.STORED': ${exact?.length || 0} records.`);

    // 2. Check similar status (maybe just '9' or 'STORED' or whitespace)
    const { data: similar, error: err2 } = await supabase
        .from('powerapp')
        .select('STATUS')
        .ilike('Brand Code', '%NIKE%')
        .ilike('STATUS', '9%'); // Starts with 9

    if (similar && similar.length > 0) {
        console.log(`- Status starting with '9': ${similar.length} records.`);
        const uniqueStatuses = [...new Set(similar.map(i => i.STATUS))];
        console.log(`  > Unique statuses found:`, uniqueStatuses);
    } else {
        console.log("- No status starting with '9' found for NIKE.");
    }

    // 3. List some NIKE orders to see their actual status
    const { data: samples } = await supabase
        .from('powerapp')
        .select('PRO ODER, STATUS')
        .ilike('Brand Code', '%NIKE%')
        .limit(5);

    console.log("- Sample NIKE orders:", samples);
}

check();
