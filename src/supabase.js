const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isConfigured = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('your-supabase'));

let supabase = null;
if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Connected to Supabase Cloud');
  } catch (err) {
    console.warn('⚠️ Supabase init warning:', err.message);
  }
} else {
  console.log('ℹ️ Running in Local Mode with mock fallback data. (Add SUPABASE_URL in server/.env for Cloud Sync)');
}

// Local Fallback Storage for immediate execution without setup
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'local_db.json');
let localDb = {
  semesters: [
    { id: 'sem-1', name: 'Semester 1', order_index: 1, is_visible: true, created_at: new Date().toISOString() },
    { id: 'sem-2', name: 'Semester 2', order_index: 2, is_visible: true, created_at: new Date().toISOString() },
    { id: 'sem-3', name: 'Semester 3', order_index: 3, is_visible: true, created_at: new Date().toISOString() }
  ],
  subjects: [
    { id: 'subj-1', semester_id: 'sem-1', name: 'Computer Science', color: '#6366f1', created_at: new Date().toISOString() },
    { id: 'subj-2', semester_id: 'sem-1', name: 'Mathematics', color: '#ec4899', created_at: new Date().toISOString() },
    { id: 'subj-3', semester_id: 'sem-2', name: 'Physics', color: '#10b981', created_at: new Date().toISOString() }
  ],
  materials: [],
  notes: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    localDb = { ...localDb, ...loaded };
    if (!localDb.semesters || localDb.semesters.length === 0) {
      localDb.semesters = [
        { id: 'sem-1', name: 'Semester 1', order_index: 1, is_visible: true, created_at: new Date().toISOString() },
        { id: 'sem-2', name: 'Semester 2', order_index: 2, is_visible: true, created_at: new Date().toISOString() },
        { id: 'sem-3', name: 'Semester 3', order_index: 3, is_visible: true, created_at: new Date().toISOString() }
      ];
    } else {
      localDb.semesters = localDb.semesters.map(s => ({
        ...s,
        is_visible: s.is_visible !== undefined ? s.is_visible : true
      }));
    }
  } catch (e) {
    console.error('Error reading local db:', e);
  }
}

function saveLocalDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), 'utf8');
}

module.exports = {
  supabase,
  isConfigured,
  localDb,
  saveLocalDb,
  UPLOADS_DIR
};
