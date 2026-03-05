import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
    });
} catch (e) { }

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    // Check what is in Masterdata for this RPRO
    const { data: mdData } = await supabase.from('Masterdata').select('PRO ODER, #MOLD, PU, FB, PU DESCRIPTION, FB DESCRIPTION').eq('PRO ODER', 'RPRO-251212-0041');
    console.log('Masterdata for RPRO:', JSON.stringify(mdData, null, 2));

    // Check what we have in surplusgoods
    const { data: sgData } = await supabase.from('surplusgoods')
        .select('id, rpro, brand_code, mold, bom, pu, fabric, pu_code, fb_code')
        .like('rpro', '%PVN-004247%');
    console.log('Surplusgoods matching PVN:', JSON.stringify(sgData, null, 2));
}

debug();
