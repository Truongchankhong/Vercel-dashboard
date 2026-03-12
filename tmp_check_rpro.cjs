const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRpro() {
    const rpro = 'RPRO-260128-1324';
    console.log(`Checking ${rpro}...`);

    const { data: tracking } = await supabase
        .from('supplement_tracking')
        .select('*')
        .eq('rpro', rpro);

    console.log('\n--- TRACKING ---');
    console.log(JSON.stringify(tracking, null, 2));

    const { data: confirm } = await supabase
        .from('supplement_confirm')
        .select('*')
        .eq('rpro', rpro);

    console.log('\n--- CONFIRM ---');
    console.log(JSON.stringify(confirm, null, 2));

    const { data: supp } = await supabase
        .from('supplement')
        .select('*')
        .eq('rpro', rpro);

    console.log('\n--- SUPPLEMENT ---');
    console.log(JSON.stringify(supp, null, 2));
}

checkRpro();
