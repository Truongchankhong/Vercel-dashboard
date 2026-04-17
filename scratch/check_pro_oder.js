import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProOderSync() {
    console.log("🔍 Checking 9.STORED orders by PRO ODER...");
    const { data: pData } = await supabase
        .from('powerapp')
        .select('STT, "PRO ODER"')
        .eq('STATUS', '9.STORED');

    if (!pData || pData.length === 0) {
        console.log("No 9.STORED in powerapp.");
        return;
    }

    const proOders = pData.map(i => i['PRO ODER']).filter(Boolean);
    console.log(`Found ${pData.length} records in powerapp. Unique PRO ODERs: ${new Set(proOders).size}`);

    const { data: mData } = await supabase
        .from('Masterdata')
        .select('STT, "PRO ODER"')
        .in('PRO ODER', proOders);

    console.log(`Found ${mData.length} matching records in Masterdata by PRO ODER.`);

    const mProOders = new Set(mData.map(i => i['PRO ODER']));
    const missing = proOders.filter(p => !mProOders.has(p));

    console.log(`Missing PRO ODERs in Masterdata: ${missing.length}`);
    if (missing.length > 0) {
        console.log("Sample missing PRO ODERs:", missing.slice(0, 5));
    }
}

checkProOderSync();
