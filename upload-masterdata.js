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
        const newRow = { ...row };

        for (const key of Object.keys(newRow)) {
            const val = newRow[key];
            const cleanKey = String(key).trim();

            // Normalize key (remove spaces) if it matches our schema
            if (numericCols.includes(cleanKey) || cleanKey.startsWith('DL ') || isSizeCol(cleanKey)) {
                if (val === "" || val === null || val === "NONE" || val === undefined) {
                    newRow[key] = null;
                } else {
                    const num = Number(val);
                    newRow[key] = !isNaN(num) ? num : null;
                }
            } else if (val === "") {
                newRow[key] = null;
            }
        }

        delete newRow['__rowNum__'];
        delete newRow['created_at'];
        return newRow;
    });

    // 3. Upsert to Masterdata
    console.log(`📤 Upserting to "Masterdata" table...`);
    let totalSuccess = 0;

    for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
        const chunk = cleanRows.slice(i, i + CHUNK_SIZE);

        const { error } = await supabase
            .from('Masterdata')
            .upsert(chunk, { onConflict: 'STT' });

        if (error) {
            console.error(`❌ Error in chunk starting at ${i}:`, error.message);
            console.error('Details:', error.details || error.hint);
        } else {
            totalSuccess += chunk.length;
            process.stdout.write(`\rProgress: ${totalSuccess}/${cleanRows.length} rows processed...`);
        }
    }

    console.log(`\n\n✅ Done! Successfully processed ${totalSuccess} rows.`);
}

uploadToMasterdata().catch(err => {
    console.error('❌ Critical Error:', err);
});
