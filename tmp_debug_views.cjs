const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log("🔍 Checking Lamination Plan data...");

    const { data, error } = await supabase
        .from('powerapp')
        .select('"LAMINATION MACHINE (PLAN)", "STATUS", "Total Qty", "Delay-Urgent"')
        .eq('STATUS', '2.MATERIAL CHƯA DÁN')
        .limit(20);
    
    if (error) console.error(error);
    console.log("Sample records for '2.MATERIAL CHƯA DÁN':", data);

    const { data: delayUrgent, error: error2 } = await supabase
        .from('powerapp')
        .select('"LAMINATION MACHINE (PLAN)", "STATUS", "Total Qty", "Delay-Urgent"')
        .or('"Delay-Urgent".ilike.PRODUCTION DELAY,"Delay-Urgent".ilike.URGENT')
        .limit(20);
    
    if (error2) console.error(error2);
    console.log("Sample records for Delay/Urgent:", delayUrgent);
}

check();
