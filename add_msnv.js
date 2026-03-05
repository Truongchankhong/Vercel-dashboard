import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { error: queryErr } = await supabase.rpc('execute_sql', {
        query: 'ALTER TABLE surplusgoods ADD COLUMN IF NOT EXISTS msnv TEXT;'
    });

    // Fallback: If rpc execute_sql doesn't work (requires function to be declared first),
    // we can't alter table from normal REST client directly without a proper RPC function
    // But we know note column exists.

    console.log("RPC Error:", queryErr);
}
main();
