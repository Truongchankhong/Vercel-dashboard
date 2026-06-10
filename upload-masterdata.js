import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const CHUNK_SIZE = 500;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadToMasterdata() {
    console.log('🚀 Starting Upload to Masterdata...');

    // 1. Smart file searching
    const possibleFilenames = ['upload_masterdata.xlsx', 'upload_masterdata.csv'];
    const possibleDirs = [
        path.join(__dirname, 'data'), // Root/data/
        __dirname,                   // Root/
        process.cwd(),               // Current Working Directory
        path.join(process.cwd(), 'data') // CWD/data/
    ];

    let actualPath = null;

    for (const dir of possibleDirs) {
        for (const file of possibleFilenames) {
            const p = path.join(dir, file);
            if (fs.existsSync(p)) {
                actualPath = p;
                break;
            }
        }
        if (actualPath) break;
    }

    if (!actualPath) {
        console.error(`❌ File not found!`);
        console.log('🔍 I searched in these locations:');
        possibleDirs.forEach(d => console.log(`   - ${d}`));
        console.log('\n💡 Please ensure your file is named "upload_masterdata.xlsx" or "upload_masterdata.csv" and is placed in the "data" folder.');
        return;
    }

    console.log(`📦 Found file: ${actualPath}`);
    const workbook = XLSX.readFile(actualPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    console.log(`📊 Found ${rows.length} rows to upload.`);

    if (rows.length === 0) {
        console.warn('⚠️ No data found in the file.');
        return;
    }

    // 2. Data Cleaning
    const numericCols = ['STT', 'Total Qty', 'DL PU', 'DL FB', 'DL LOGO',
        'DL PU2', 'DL PU3', 'DL LOGO2', 'DL LOGO3', 'DL LOGO4'];

    const isSizeCol = (key) => /^\s*\d+(\.\d+)?(Y|K)?\s*$/.test(String(key).trim());

    const cleanRows = rows.map(row => {
        const newRow = {};

        // Trim keys and values, normalize empty/none to null
        for (const key of Object.keys(row)) {
            const cleanKey = String(key).trim();
            let val = row[key];

            if (typeof val === 'string') {
                val = val.trim();
            }

            // Normalize empty values
            if (val === "" || val === "NONE" || val === "null" || val === undefined) {
                val = null;
            }

            // Numeric conversion for specific columns
            if (numericCols.includes(cleanKey) || cleanKey.startsWith('DL ') || isSizeCol(cleanKey)) {
                if (val !== null) {
                    const num = Number(val);
                    val = !isNaN(num) ? num : null;
                }
            }

            newRow[cleanKey] = val;
        }

        // Remove unwanted fields
        delete newRow['__rowNum__'];
        delete newRow['created_at'];
        return newRow;
    });

    // 3. Filter existing records by PRO ODER
    console.log(`🔍 Checking for existing records in Supabase...`);
    const allProOders = [...new Set(cleanRows.map(r => r['PRO ODER']).filter(Boolean))];
    const existingProOders = new Set();

    // Fetch existing PRO ODER in chunks to avoid URL length limits
    const BATCH_SIZE = 1000;
    for (let i = 0; i < allProOders.length; i += BATCH_SIZE) {
        const chunk = allProOders.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
            .from('Masterdata')
            .select('PRO ODER')
            .in('PRO ODER', chunk);

        if (error) {
            console.error(`❌ Error fetching existing records:`, error.message);
        } else if (data) {
            data.forEach(row => existingProOders.add(row['PRO ODER']));
        }
        process.stdout.write(`\rChecking existing records: ${Math.min(i + BATCH_SIZE, allProOders.length)}/${allProOders.length}...`);
    }
    console.log(`\n✅ Found ${existingProOders.size} existing RPRO(s) in database.`);

    // We no longer filter by PRO ODER to allow updating status/details for existing records
    const filteredRows = cleanRows; 
    console.log(`🚀 Uploading ${filteredRows.length} rows...`);

    if (filteredRows.length === 0) {
        console.log('✅ All rows already exist in Supabase. Nothing to upload.');
        return;
    }

    // 4. Batch Upload to Masterdata
    console.log(`📤 Sending data to "Masterdata" table...`);
    let totalSuccess = 0;

    for (let i = 0; i < filteredRows.length; i += CHUNK_SIZE) {
        const chunk = filteredRows.slice(i, i + CHUNK_SIZE);

        // Using insert instead of upsert since we already filtered duplicates
        // but keeping STT as conflict target just in case there are internal duplicates in the batch
        const { error } = await supabase
            .from('Masterdata')
            .upsert(chunk, { onConflict: 'PRO ODER' });

        if (error) {
            console.error(`❌ Error in chunk starting at ${i}:`, error.message);
            console.error('Details:', error.details || error.hint);
        } else {
            totalSuccess += chunk.length;
            process.stdout.write(`\rProgress: ${totalSuccess}/${filteredRows.length} rows processed...`);
        }
    }

    console.log(`\n\n✅ Done! Successfully processed ${totalSuccess} new rows.`);
}

uploadToMasterdata().catch(err => {
    console.error('❌ Critical Error:', err);
});
