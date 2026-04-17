import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAllSync() {
    console.log("🔍 Fetching ALL 9.STORED orders from powerapp...");
    const { data: pData, error: pError } = await supabase
        .from('powerapp')
        .select('STT')
        .eq('STATUS', '9.STORED');

    if (pError) {
        console.error("Error fetching powerapp:", pError);
        return;
    }

    if (!pData || pData.length === 0) {
        console.log("No 9.STORED found in powerapp.");
        return;
    }

    console.log(`Found ${pData.length} rows with 9.STORED in powerapp.`);
    const stts = pData.map(i => i.STT);

    // Batch check in Masterdata because 'in' filter has limits if stts is too large (though 387 is fine)
    const { data: mData, error: mError } = await supabase
        .from('Masterdata')
        .select('STT')
        .in('STT', stts);

    if (mError) {
        console.error("Error fetching Masterdata:", mError);
        return;
    }

    const mStts = new Set(mData.map(i => i.STT));
    const missing = stts.filter(s => !mStts.has(s));

    console.log(`Matching in Masterdata: ${mData.length}`);
    console.log(`Missing in Masterdata: ${missing.length}`);
    
    if (missing.length > 0) {
        console.log("Sample missing STTs:", missing.slice(0, 10));
        
        // Let's check why they might be missing.
        // Maybe check the raw status of one missing order in powerapp
        const { data: sampleRow } = await supabase
            .from('powerapp')
            .select('*')
            .eq('STT', missing[0]);
        console.log("Sample missing row details:", sampleRow[0]);
    }
}

checkAllSync();
