
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDataBySTT() {
    const rpro = 'RPRO-260106-0250';
    console.log(`Checking data by filter...`);

    // Masterdata search
    console.log('\n--- Masterdata Search ---');
    const { data: md2 } = await supabase.from('Masterdata')
        .select('STT, "PRO ODER", "PU DESCRIPTION"')
        .ilike('PRO ODER', `%${rpro}%`)
        .limit(10);
    console.log('MD Data by ILIKE:', md2);

    // Surplusgoods check
    console.log('\n--- surplusgoods Search ---');
    const { data: sg } = await supabase.from('surplusgoods')
        .select('*')
        .eq('rpro', rpro)
        .limit(5);
    console.log('SG Data:', sg);
}

checkDataBySTT();
