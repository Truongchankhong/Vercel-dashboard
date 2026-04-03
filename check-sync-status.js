
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSyncStatus() {
    console.log("Checking Sync Status...");
    
    // 1. Last metadata update
    const { data: meta, error: metaErr } = await supabase
        .from('powerapp')
        .select('"PRO ODER", "Finish date"')
        .eq('STT', -1)
        .limit(1);
    
    if (metaErr) console.error("Meta Err:", metaErr);
    else if (meta && meta.length > 0) {
        console.log("Last Metadata Update Time:", meta[0]['Finish date']);
    }

    // 2. Latest Lamination Time (Dán)
    const { data: lamData, error: lamError } = await supabase
      .from('powerapp')
      .select('"Laminating (Pro)"')
      .not('"Laminating (Pro)"', 'is', null)
      .gt('"Laminating (Pro)"', 0)
      .order('"Laminating (Pro)"', { ascending: false })
      .limit(1);

    if (lamError) console.error("Lamination Err:", lamError);
    else if (lamData && lamData.length > 0) {
        const serial = Number(lamData[0]['Laminating (Pro)']);
        const base = new Date(1899, 11, 30);
        const msPerDay = 86400000;
        const date = new Date(base.getTime() + serial * msPerDay);
        console.log("Latest Lamination Date in Supabase:", date.toLocaleString('vi-VN'));
    }
}

checkSyncStatus();
