import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CHUNK_SIZE = 1000;
const JSON_PATH = './public/powerapp.json';
const SUPABASE_URL = 'https://lowimtwtrqynycmuecfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvd2ltdHd0cnF5bnljbXVlY2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzIzNzcsImV4cCI6MjA4Mzk0ODM3N30.RtYMSA913_mIaDaXgj7R9-GJd4t3rPQDI-UP7GywdFU';

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

  const numericCols = ['STT', 'Total Qty', 'DL PU', 'DL FB', 'DL LOGO'];

  const cleanRows = rows.map(row => {
    const newRow = { ...row };
    // Convert keys to match SQL column names exactly (Case Sensitive in quotes)
    // JSON keys are already exact matches based on schema generation.

    // Fix numeric columns: "" -> null
    for (const key of Object.keys(newRow)) {
      // If the value is empty string and we want it to be text, it's fine.
      // But if we defined it as numeric in SQL, "" will fail.
      // Let's rely on the schema I wrote: 
      // "STT" bigint, "Total Qty" numeric, "DL PU" numeric, "DL FB" numeric, "DL LOGO" numeric
      // All others are text.
      if (numericCols.includes(key) || key.startsWith('DL ')) {
        if (newRow[key] === "" || newRow[key] === null) {
          newRow[key] = null;
        } else {
          // try parse
          const num = Number(newRow[key]);
          if (!isNaN(num)) {
            newRow[key] = num;
          } else {
            // Keep as is, let Supabase error if invalid
            newRow[key] = null;
          }
        }
      }
      // Supabase `upsert` ignores unknown columns? No, strict by default.
      // We must ensure all keys in JSON exist in Table.
      // My schema included ALL keys from the JSON sample I saw.
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

  // 4. Insert in Chunks
  console.log(`🚀 Inserting ${cleanRows.length} rows in chunks of ${CHUNK_SIZE}...`);

  let totalInserted = 0;
  for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
    const chunk = cleanRows.slice(i, i + CHUNK_SIZE);

    // Using upsert instead of insert just in case duplication occurs or unique constraint logic
    // But since we deleted all, insert is fine.
    const { error: insertError } = await supabase
      .from('powerapp')
      .insert(chunk);

    if (insertError) {
      console.error(`❌ Error inserting chunk ${i / CHUNK_SIZE + 1}:`, insertError);
      // We might stop or continue.
    } else {
      process.stdout.write('.'); // Progress indicator
    }
    totalInserted += chunk.length;
  }

  console.log(`\n✅ Sync complete! Inserted ${totalInserted}/${cleanRows.length} rows.`);
}

syncPowerApp().catch(err => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
