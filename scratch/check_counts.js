import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCounts() {
    const { count: pCount } = await supabase.from('powerapp').select('*', { count: 'exact', head: true });
    const { count: mCount } = await supabase.from('Masterdata').select('*', { count: 'exact', head: true });
    
    console.log(`PowerApp row count: ${pCount}`);
    console.log(`Masterdata row count: ${mCount}`);

    // Check if any status exists in powerapp that starts with 9
    const { data: p9 } = await supabase.from('powerapp').select('STATUS').ilike('STATUS', '9%');
    console.log(`Rows in powerapp starting with 9: ${p9?.length || 0}`);
    if (p9 && p9.length > 0) {
        console.log("Variations:", [...new Set(p9.map(i => i.STATUS))]);
    }
}

checkCounts();
