import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSync() {
    console.log("🔍 Fetching 9.STORED orders from powerapp...");
    const { data: pData } = await supabase
        .from('powerapp')
        .select('STT, STATUS')
        .eq('STATUS', '9.STORED')
        .limit(10);

    if (!pData || pData.length === 0) {
        console.log("No 9.STORED found in powerapp.");
        return;
    }

    const stts = pData.map(i => i.STT);
    console.log("STTs to check in Masterdata:", stts);

    const { data: mData } = await supabase
        .from('Masterdata')
        .select('STT, STATUS')
        .in('STT', stts);

    console.log("Found in Masterdata:");
    console.table(mData);

    const missing = stts.filter(s => !mData.find(m => m.STT == s));
    console.log("Missing STTs in Masterdata:", missing);
}

checkSync();
