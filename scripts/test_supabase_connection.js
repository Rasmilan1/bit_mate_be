const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Cloud Connection...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tables = ['semesters', 'subjects', 'materials', 'study_notes'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' MISSING or invalid:`, error.message);
    } else {
      console.log(`✅ Table '${table}' EXISTS! (Rows: ${data.length})`);
    }
  }

  // Check Storage Bucket
  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('study-pdfs');
  if (bucketError) {
    console.log(`❌ Storage Bucket 'study-pdfs' MISSING:`, bucketError.message);
  } else {
    console.log(`✅ Storage Bucket 'study-pdfs' EXISTS!`);
  }
}

checkTables().catch(console.error);
