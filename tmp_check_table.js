
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable() {
    const { data, error } = await supabase.from('Surplusgoods').select('id').limit(1);
    if (error) {
        console.log("TABLE_MISSING");
    } else {
        console.log("TABLE_EXISTS");
    }
}

checkTable();
