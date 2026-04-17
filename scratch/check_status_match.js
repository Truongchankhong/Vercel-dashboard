import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatusMatch() {
    console.log("🔍 Comparing status between powerapp and Masterdata for 9.STORED orders...");
    const { data: pData } = await supabase
        .from('powerapp')
        .select('STT, STATUS')
        .eq('STATUS', '9.STORED');

    const stts = pData.map(i => i.STT);
    const { data: mData } = await supabase
        .from('Masterdata')
        .select('STT, STATUS')
        .in('STT', stts);

    const mismatches = [];
    pData.forEach(p => {
        const m = mData.find(i => i.STT == p.STT);
        if (!m) {
            mismatches.push({ STT: p.STT, pStatus: p.STATUS, mStatus: 'MISSING' });
        } else if (m.STATUS !== p.STATUS) {
            mismatches.push({ STT: p.STT, pStatus: p.STATUS, mStatus: m.STATUS });
        }
    });

    console.log(`Total checked: ${pData.length}`);
    console.log(`Mismatches: ${mismatches.length}`);
    if (mismatches.length > 0) {
        console.log("Variations in Masterdata status:", [...new Set(mismatches.map(i => i.mStatus))]);
        console.table(mismatches.slice(0, 10));
    } else {
        console.log("✅ All statuses match perfectly.");
    }
}

checkStatusMatch();
