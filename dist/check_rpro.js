
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
    const rpro = "RPRO-251216-0029";
    console.log(`Checking Supabase for ${rpro}...`);

    const { data, error } = await supabase
        .from('powerapp')
        .select('*')
        .eq('PRO ODER', rpro);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Result length:", data.length);
        if (data.length > 0) {
            console.log("Data found:", JSON.stringify(data[0], null, 2));
        } else {
            console.log("No data found for this RPRO.");

            // Try searching without the dash or partial
            const { data: searchData } = await supabase
                .from('powerapp')
                .select('PRO ODER')
                .ilike('PRO ODER', '%251216%')
                .limit(10);

            console.log("Recent records containing 251216:", searchData);
        }
    }
}

checkData();
