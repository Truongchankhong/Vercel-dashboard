import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDuplicates() {
    console.log("🔍 Checking for PRO ODER duplicates in Masterdata (with different STTs)...");
    
    const { data, error } = await supabase.rpc('get_masterdata_duplicates');
    
    if (error) {
        console.log("RPC get_masterdata_duplicates not found, trying manual check...");
        // Manual check for 1000 rows
        const { data: rows } = await supabase.from('Masterdata').select('STT, "PRO ODER"').limit(2000);
        const counts = {};
        rows.forEach(r => {
            const code = r['PRO ODER'];
            if (!counts[code]) counts[code] = [];
            counts[code].push(r.STT);
        });
        const dups = Object.entries(counts).filter(([k, v]) => v.length > 1);
        console.log("Found duplicates in first 2000 rows:", dups);
    } else {
        console.log("Duplicates results:", data);
    }
}

checkDuplicates();
