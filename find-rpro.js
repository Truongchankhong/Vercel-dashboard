
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
    const rpro = 'RPRO-260106-0250';
    const { data: md } = await supabase.from('Masterdata').select('STT, "PRO ODER", "PU DESCRIPTION", "FB DESCRIPTION"').eq('PRO ODER', rpro);

    if (md && md.length > 0) {
        md.forEach((row, i) => {
            console.log(`ROW ${i}:`);
            console.log(`STT: ${row.STT}`);
            console.log(`PRO ODER: [${row['PRO ODER']}]`);
            console.log(`PU: [${row['PU DESCRIPTION']}]`);
            console.log(`FB: [${row['FB DESCRIPTION']}]`);
        });
    } else {
        console.log('No data found');
    }
}

checkData();
