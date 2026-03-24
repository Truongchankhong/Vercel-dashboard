const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ixdtdrbytwdmnlqgunzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg');

async function test() {
    console.log("Testing with quotes...");
    const { data: d1, error: e1 } = await supabase.from('powerapp').select('*').eq('"LAMINATION MACHINE (REALTIME)"', 'Hotmelt').limit(1);
    if(e1) console.log("Quotes Failed:", e1.message); else console.log("Quotes Success:", d1.length);

    console.log("Testing without quotes...");
    const { data: d2, error: e2 } = await supabase.from('powerapp').select('*').eq('LAMINATION MACHINE (REALTIME)', 'Hotmelt').limit(1);
    if(e2) console.log("No Quotes Failed:", e2.message); else console.log("No Quotes Success:", d2.length);
    
    process.exit(0);
}
test();
