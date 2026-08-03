const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function runAutoMigrate() {
  console.log('🚀 Attempting Automated Supabase Cloud Setup with Service Role Key...');

  // 1. Create Storage Bucket
  console.log('\n--- 1. Storage Bucket ---');
  try {
    const { data: bucket, error: bucketErr } = await supabase.storage.createBucket('study-pdfs', {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 52428800 // 50MB
    });
    if (bucketErr) {
      if (bucketErr.message.includes('already exists')) {
        console.log('✅ Storage bucket "study-pdfs" already exists!');
      } else {
        console.warn('⚠️ Bucket creation notice:', bucketErr.message);
      }
    } else {
      console.log('✅ Storage bucket "study-pdfs" created successfully!');
    }
  } catch (e) {
    console.warn('⚠️ Bucket check error:', e.message);
  }

  // 2. Test Tables Access
  console.log('\n--- 2. Checking Tables ---');
  const tables = ['semesters', 'subjects', 'materials'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`❌ Table "${t}" error:`, error.message);
    } else {
      console.log(`✅ Table "${t}" is accessible!`);
    }
  }
}

runAutoMigrate().catch(console.error);
