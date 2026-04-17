import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatusVariations() {
    console.log("🔍 Checking unique statuses in powerapp table...");
    const { data, error } = await supabase
        .from('powerapp')
        .select('STATUS');
    
    if (error) {
        console.error("❌ Error fetching statuses:", error);
        return;
    }

    const uniqueStatuses = [...new Set(data.map(i => i.STATUS))];
    console.log("✅ Unique statuses found in powerapp:");
    uniqueStatuses.forEach(s => console.log(`- "${s}"`));

    const storedLike = uniqueStatuses.filter(s => s && s.toString().toUpperCase().includes('STORED'));
    console.log("\n📦 Statuses containing 'STORED':", storedLike);

    const match9Stored = data.filter(i => i.STATUS === '9.STORED').length;
    console.log(`\n📊 Count of exact '9.STORED': ${match9Stored}`);

    const match9StoredFlex = data.filter(i => i.STATUS && i.STATUS.toString().trim().toUpperCase() === '9.STORED').length;
    console.log(`📊 Count of '9.STORED' (trim/case-insensitive): ${match9StoredFlex}`);
}

checkStatusVariations();
