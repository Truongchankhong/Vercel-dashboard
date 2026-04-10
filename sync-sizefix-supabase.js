import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const JSON_PATH = './public/sizefix.json';
const SUPABASE_URL = 'https://ixdtdrbytwdmnlqgunzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg';

// --- INITIALIZATION ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSizeFix() {
  console.log('🚀 Starting sync-sizefix-supabase...');

  // 1. Read JSON file
  const fullPath = path.resolve(JSON_PATH);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`📦 Reading SizeFix JSON from: ${fullPath}`);
  const rawData = fs.readFileSync(fullPath, 'utf-8');
  const sizeFixJson = JSON.parse(rawData);

  // 2. Transform to Table format
  const rows = Object.entries(sizeFixJson).map(([rpro, fix_data]) => ({
    rpro,
    fix_data,
    updated_at: new Date().toISOString()
  }));

  if (rows.length === 0) {
    console.log('⚠️ No sizefix data found to sync.');
    return;
  }

  console.log(`📊 Found ${rows.length} sizefix records to sync.`);

  // 3. Upsert to Supabase in chunks
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('ovn_sizefix')
      .upsert(chunk, { onConflict: 'rpro' });

    if (error) {
      console.error(`❌ Error inserting chunk ${i / CHUNK_SIZE + 1}:`, error);
    } else {
      process.stdout.write('.');
    }
  }

  console.log(`\n✅ SizeFix sync complete! Synced ${rows.length} records.`);
}

syncSizeFix().catch(err => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
