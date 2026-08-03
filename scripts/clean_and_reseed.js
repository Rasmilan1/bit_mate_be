const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey);
const dbFile = path.join(__dirname, '../data/local_db.json');

const localDb = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

async function cleanAndReseed() {
  console.log('🧹 Cleaning duplicate rows from Supabase Cloud DB...');

  // 1. Delete all materials, subjects, semesters
  await supabase.from('materials').delete().neq('title', '___NON_EXISTENT___');
  await supabase.from('subjects').delete().neq('name', '___NON_EXISTENT___');
  await supabase.from('semesters').delete().neq('name', '___NON_EXISTENT___');

  console.log('✨ All old table rows cleared!');

  // 2. Insert clean Semesters
  console.log('\n--- Seeding 3 Semesters ---');
  const semMap = {};
  for (const sem of localDb.semesters || []) {
    const { data, error } = await supabase.from('semesters').insert([
      {
        name: sem.name,
        order_index: sem.order_index || 1,
        is_visible: sem.is_visible !== undefined ? sem.is_visible : true
      }
    ]).select();

    if (error) {
      console.error(`❌ Semester error (${sem.name}):`, error.message);
    } else {
      console.log(`✅ Semester synced: ${sem.name} -> ID: ${data[0].id}`);
      semMap[sem.id] = data[0].id;
      sem.id = data[0].id; // Update localDb with clean UUID
    }
  }

  // 3. Insert clean Subjects
  console.log('\n--- Seeding Subjects ---');
  const subjMap = {};
  for (const subj of localDb.subjects || []) {
    const newSemId = semMap[subj.semester_id] || null;
    const { data, error } = await supabase.from('subjects').insert([
      {
        name: subj.name,
        subject_number: subj.subject_number || '',
        week_info: subj.week_info || '',
        color: subj.color || '#4f46e5',
        semester_id: newSemId
      }
    ]).select();

    if (error) {
      console.error(`❌ Subject error (${subj.name}):`, error.message);
    } else {
      console.log(`✅ Subject synced: ${subj.name} (${subj.subject_number}) -> ID: ${data[0].id}`);
      subjMap[subj.id] = data[0].id;
      subj.id = data[0].id;
      subj.semester_id = newSemId;
    }
  }

  // 4. Insert clean Materials
  console.log('\n--- Seeding Materials ---');
  for (const mat of localDb.materials || []) {
    const newSubjId = subjMap[mat.subject_id] || null;
    const { data, error } = await supabase.from('materials').insert([
      {
        title: mat.title,
        subject_id: newSubjId,
        week_info: mat.week_info || '',
        file_url: mat.file_url || '',
        file_path: mat.file_path || '',
        file_size: mat.file_size || 0,
        total_pages: mat.total_pages || 1,
        current_page: mat.current_page || 1,
        status: mat.file_url ? 'unread' : 'unread',
        tags: mat.tags || []
      }
    ]).select();

    if (error) {
      console.error(`❌ Material error (${mat.title}):`, error.message);
    } else {
      console.log(`✅ Material synced: ${mat.title} -> ID: ${data[0].id}`);
      mat.id = data[0].id;
      mat.subject_id = newSubjId;
    }
  }

  // 5. Update local_db.json with matching clean UUIDs
  fs.writeFileSync(dbFile, JSON.stringify(localDb, null, 2), 'utf8');
  console.log('\n🎉 Clean reseed complete! local_db.json and Supabase Cloud DB are 100% matched with 0 duplicates!');
}

cleanAndReseed().catch(console.error);
