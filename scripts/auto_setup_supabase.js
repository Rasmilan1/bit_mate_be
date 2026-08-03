const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function autoSetup() {
  console.log('⚡ Creating Storage Bucket study-pdfs...');
  const { data, error } = await supabase.storage.createBucket('study-pdfs', {
    public: true,
    fileSizeLimit: 52428800 // 50MB
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Bucket study-pdfs already exists!');
    } else {
      console.log('Notice:', error.message);
    }
  } else {
    console.log('✅ Storage Bucket study-pdfs successfully created!');
  }
}

autoSetup().catch(console.error);
