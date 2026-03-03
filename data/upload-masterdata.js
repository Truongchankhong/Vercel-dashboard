import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const FILE_PATH = './data/upload_masterdata.xlsx'; // Or .csv
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';
const CHUNK_SIZE = 500;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadToMasterdata() {
    console.log('🚀 Starting Upload to Masterdata...');

    // 1. Find the file
    let actualPath = path.resolve(FILE_PATH);
    if (!fs.existsSync(actualPath)) {
        // Try .csv if .xlsx not found
        const csvPath = actualPath.replace('.xlsx', '.csv');
        if (fs.existsSync(csvPath)) {
            actualPath = csvPath;
        } else {
            console.error(`❌ File not found at: ${actualPath} or ${csvPath}`);
            console.log('💡 Please place your file in the "data" folder and rename it to "upload_masterdata.xlsx" or "upload_masterdata.csv"');
            return;
        }
    }

    console.log(`📦 Reading file: ${actualPath}`);
    const workbook = XLSX.readFile(actualPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with default values as null for empty cells
    let rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    console.log(`📊 Found ${rows.length} rows to upload.`);

    // 2. Data Cleaning
    const numericCols = ['STT', 'Total Qty', 'DL PU', 'DL FB', 'DL LOGO',
        'DL PU2', 'DL PU3', 'DL LOGO2', 'DL LOGO3', 'DL LOGO4'];

    const isSizeCol = (key) => /^\d+(\.\d+)?(Y|K)?$/.test(key);

    const cleanRows = rows.map(row => {
        const newRow = { ...row };

        // Ensure all keys from Masterdata schema are respected, or let Supabase handle mapping
        // But most importantly, clean numeric fields that might have "" or "NONE"
        for (const key of Object.keys(newRow)) {
            // Map common UI names to DB names if needed (optional, assuming CSV headers match DB columns)
            // If user headers differ, they should be mapped here.

            const val = newRow[key];
            if (numericCols.includes(key) || key.startsWith('DL ') || isSizeCol(key)) {
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

        // Remove temporary or empty keys if any
        delete newRow['__rowNum__'];

        return newRow;
    });

    // 3. Upsert to Masterdata
    console.log(`📤 Upserting ${cleanRows.length} rows to "Masterdata" table...`);
    let totalSuccess = 0;

    for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
        const chunk = cleanRows.slice(i, i + CHUNK_SIZE);

        const { error } = await supabase
            .from('Masterdata')
            .upsert(chunk, { onConflict: 'STT' });

        if (error) {
            console.error(`❌ Error in chunk starting at ${i}:`, error.message);
            console.error('Details:', error.details || error.hint);
            // Optional: stop on error
            // break;
        } else {
            totalSuccess += chunk.length;
            process.stdout.write(`\rProgress: ${totalSuccess}/${cleanRows.length} rows...`);
        }
    }

    console.log(`\n\n✅ Done! Successfully processed ${totalSuccess} rows.`);
    console.log('Check the "Masterdata" table in Supabase to verify.');
}

uploadToMasterdata().catch(err => {
    console.error('❌ Critical Error:', err);
});
