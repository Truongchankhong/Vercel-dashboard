import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSpaces() {
    const rpro = 'RPRO-260406-1026';
    
    const { data: p } = await supabase.from('powerapp').select('"PRO ODER"').eq('PRO ODER', rpro);
    const { data: m } = await supabase.from('Masterdata').select('"PRO ODER"').eq('PRO ODER', rpro);

    if (p && p.length > 0) {
        console.log(`PowerApp RPRO: "${p[0]['PRO ODER']}" (length: ${p[0]['PRO ODER'].length})`);
    }
    if (m && m.length > 0) {
        console.log(`Masterdata RPRO: "${m[0]['PRO ODER']}" (length: ${m[0]['PRO ODER'].length})`);
    }

    // Check for ANY '9.STORED' in powerapp with different case or spaces
    const { data: allP } = await supabase.from('powerapp').select('STATUS').ilike('STATUS', '9%');
    const stats = allP.map(i => i.STATUS);
    console.log("All Status variations in powerapp starting with 9:");
    console.log([...new Set(stats.map(s => `[${s}]`))]);
}

checkSpaces();
