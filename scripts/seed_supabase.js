const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dbFile = path.join(__dirname, '../data/local_db.json');

if (!fs.existsSync(dbFile)) {
  console.error('❌ local_db.json file not found at:', dbFile);
  process.exit(1);
}

const localDb = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

async function syncToSupabase() {
  console.log('🚀 Starting Data Migration from local_db.json -> Supabase Cloud DB...');

  // 1. Sync Semesters
  console.log('\n--- Syncing Semesters ---');
  for (const sem of localDb.semesters || []) {
    const semPayload = {
      name: sem.name,
      order_index: sem.order_index || 1,
      is_visible: sem.is_visible !== undefined ? sem.is_visible : true
    };

    // If ID is valid UUID, use it, else let Supabase generate UUID
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sem.id);
    if (isValidUuid) semPayload.id = sem.id;

    const { data, error } = await supabase.from('semesters').upsert([semPayload]).select();
    if (error) {
      console.error(`❌ Semester error (${sem.name}):`, error.message);
    } else {
      console.log(`✅ Semester synced: ${sem.name} -> ID: ${data[0].id}`);
      sem.new_id = data[0].id;
    }
  }

  // Map old semester ID to new UUID if needed
  const semMap = {};
  (localDb.semesters || []).forEach(s => {
    semMap[s.id] = s.new_id || s.id;
  });

  // 2. Sync Subjects
  console.log('\n--- Syncing Subjects ---');
  const subjMap = {};
  for (const subj of localDb.subjects || []) {
    const semId = semMap[subj.semester_id] || null;
    const isValidSemUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(semId || '');

    const subjPayload = {
      name: subj.name,
      subject_number: subj.subject_number || '',
      week_info: subj.week_info || '',
      color: subj.color || '#4f46e5',
      semester_id: isValidSemUuid ? semId : null
    };

    const isValidSubjUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subj.id);
    if (isValidSubjUuid) subjPayload.id = subj.id;

    const { data, error } = await supabase.from('subjects').upsert([subjPayload]).select();
    if (error) {
      console.error(`❌ Subject error (${subj.name}):`, error.message);
    } else {
      console.log(`✅ Subject synced: ${subj.name} (${subj.subject_number}) -> ID: ${data[0].id}`);
      subjMap[subj.id] = data[0].id;
    }
  }

  // 3. Sync Materials
  console.log('\n--- Syncing Materials & PDFs ---');
  for (const mat of localDb.materials || []) {
    const subjId = subjMap[mat.subject_id] || mat.subject_id || null;
    const isValidSubjUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjId || '');

    const matPayload = {
      title: mat.title,
      subject_id: isValidSubjUuid ? subjId : null,
      week_info: mat.week_info || '',
      file_url: mat.file_url || '',
      file_path: mat.file_path || '',
      file_size: mat.file_size || 0,
      total_pages: mat.total_pages || 1,
      current_page: mat.current_page || 1,
      status: mat.status || 'unread',
      tags: mat.tags || []
    };

    const isValidMatUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mat.id);
    if (isValidMatUuid) matPayload.id = mat.id;

    let status = mat.status || 'unread';
    let { data, error } = await supabase.from('materials').upsert([{ ...matPayload, status }]).select();
    if (error && error.message.includes('materials_status_check')) {
      const retry = await supabase.from('materials').upsert([{ ...matPayload, status: 'unread' }]).select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error(`❌ Material error (${mat.title}):`, error.message);
    } else {
      console.log(`✅ Material synced: ${mat.title} -> ID: ${data[0].id}`);
    }
  }

  console.log('\n🎉 Sync Complete! All Semesters, Subjects, and Materials are now live in Supabase Cloud DB!');
}

syncToSupabase().catch(console.error);
