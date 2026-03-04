
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRecentMD() {
    const { data, error } = await supabase.from('Masterdata')
        .select('STT, "PRO ODER", "PU DESCRIPTION"')
        .order('STT', { ascending: false })
        .limit(10);

    if (error) {
        console.error(JSON.stringify(error));
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkRecentMD();
