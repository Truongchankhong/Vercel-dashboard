import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CHUNK_SIZE = 1000;
const JSON_PATH = './public/powerapp.json';
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

// --- INITIALIZATION ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncPowerApp() {
  console.log('🚀 Starting sync-powerapp-supabase...');

  // 1. Read JSON file
  const fullPath = path.resolve(JSON_PATH);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`📦 Reading JSON from: ${fullPath}`);
  let rawData;
  try {
    rawData = fs.readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error('❌ Error reading file:', err);
    process.exit(1);
  }

  let jsonData;
  try {
    jsonData = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ Error parsing JSON:', err);
    process.exit(1);
  }

  const rows = jsonData.data;
  if (!Array.isArray(rows)) {
    console.error('❌ Invalid JSON format: "data" property should be an array.');
    process.exit(1);
  }

  console.log(`📊 Found ${rows.length} rows to sync.`);

  // 2. Prepare Data (Clean/Transform if needed)
  // Ensure numeric fields are numbers or null
  // Note: Your JSON seems to have strings for some numbers, Supabase might handle it if column is text,
  // but better to be consistent with Schema.
  // Since we defined most cols as text in SQL (safety), we can just pass them. 
  // Exception: 'STT', 'Total Qty', 'DL ...' are numeric in SQL.
  // Supabase/Postgres is picky about empty string "" for numeric columns. We should convert "" to null.

  const numericCols = ['STT', 'Total Qty', 'DL PU', 'DL FB', 'DL LOGO',
    'DL PU2', 'DL PU3', 'DL LOGO2', 'DL LOGO3', 'DL LOGO4'];

  // Pattern to match size columns: '3', '3.5', '3.5Y', '10K', etc.
  const isSizeCol = (key) => /^\d+(\.\d+)?(Y|K)?$/.test(key);

  const cleanRows = rows.map(row => {
    const newRow = { ...row };

    for (const key of Object.keys(newRow)) {
      if (numericCols.includes(key) || key.startsWith('DL ') || isSizeCol(key)) {
        if (newRow[key] === "" || newRow[key] === null || newRow[key] === "NONE") {
          newRow[key] = null;
        } else {
          const num = Number(newRow[key]);
          if (!isNaN(num)) {
            newRow[key] = num;
          } else {
            newRow[key] = null;
          }
        }
      }
    }
    return newRow;
  });

  // 3. Delete existing data (Full Refresh Strategy)
  // To avoid downtime, we could Upsert. But to handle deletions, 'Delete All' is safer if volume permits.
  // 33MB text is roughly 20k rows? 
  // Let's try Delete All.
  console.log('🗑️  Clearing existing data (Truncate/Delete)...');
  const { error: deleteError } = await supabase
    .from('powerapp')
    .delete()
    .neq('STT', -1); // Delete where STT != -1 (basically all positive STTs)

  if (deleteError) {
    console.error('❌ Error clearing table:', deleteError);
    // Continue? Maybe upsert will work.
  } else {
    console.log('✅ Table cleared.');
  }

  // 4. Insert in Chunks to powerapp
  console.log(`🚀 Inserting ${cleanRows.length} rows in chunks of ${CHUNK_SIZE}...`);
  let totalInserted = 0;
  for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
    const chunk = cleanRows.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase.from('powerapp').insert(chunk);
    if (insertError) {
      console.error(`❌ Error inserting chunk ${i / CHUNK_SIZE + 1}:`, insertError);
    } else {
      process.stdout.write('.');
    }
    totalInserted += chunk.length;
  }
  console.log(`\n✅ PowerApp sync complete! Inserted ${totalInserted}/${cleanRows.length} rows.`);

  // 5. Backup 9.STORED to Masterdata
  const storedRows = cleanRows.filter(row => row.STATUS === '9.STORED');
  if (storedRows.length > 0) {
    console.log(`📦 Backing up ${storedRows.length} STORED orders to Masterdata...`);
    const { error: masterError } = await supabase
      .from('Masterdata')
      .upsert(storedRows, { onConflict: 'STT' });

    if (masterError) {
      console.error('❌ Error backing up to Masterdata:', masterError);
    } else {
      console.log('✅ Masterdata backup complete.');
    }
  }

  console.log(`\n✅ Sync complete! Inserted ${totalInserted}/${cleanRows.length} rows.`);
}

syncPowerApp().catch(err => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
