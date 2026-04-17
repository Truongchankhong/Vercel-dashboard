import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSpecific() {
    const rpro = 'RPRO-260406-1026';
    console.log(`🔍 Checking ${rpro} in both tables...`);
    
    const { data: pData } = await supabase
        .from('powerapp')
        .select('*')
        .eq('PRO ODER', rpro);
    
    console.log("In powerapp table:");
    console.table(pData);

    const { data: mData } = await supabase
        .from('Masterdata')
        .select('*')
        .eq('PRO ODER', rpro);
    
    console.log("In Masterdata table:");
    console.table(mData);

    if (pData.length > 0) {
        const stt = pData[0].STT;
        console.log(`Checking STT ${stt} in Masterdata...`);
        const { data: mDataStt } = await supabase
            .from('Masterdata')
            .select('*')
            .eq('STT', stt);
        console.log("Row in Masterdata with same STT:");
        console.table(mDataStt.map(i => ({ STT: i.STT, PRO_ODER: i['PRO ODER'], STATUS: i.STATUS })));
    }
}

checkSpecific();
