
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColsDetailed() {
    const { data: md } = await supabase.from('Masterdata').select().limit(1);
    const { data: pa } = await supabase.from('powerapp').select().limit(1);

    console.log('Masterdata columns (First 20):', Object.keys(md[0] || {}).slice(0, 20));
    console.log('powerapp columns (First 20):', Object.keys(pa[0] || {}).slice(0, 20));

    // Specifically search for PRO columns
    const findPro = (keys) => keys.filter(k => k.toLowerCase().includes('pro'));
    console.log('Masterdata PRO keys:', findPro(Object.keys(md[0] || {})));
    console.log('powerapp PRO keys:', findPro(Object.keys(pa[0] || {})));
}

checkColsDetailed();
