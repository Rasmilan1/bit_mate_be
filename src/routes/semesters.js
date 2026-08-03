const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { supabase, isConfigured, localDb, saveLocalDb, UPLOADS_DIR } = require('../supabase');

// GET all semesters
router.get('/', async (req, res) => {
  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase.from('semesters').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json(data);
      }
      console.warn('Supabase semesters fetch notice, using localDb semesters:', error ? error.message : 'No rows');
    }
    return res.json(localDb.semesters || []);
  } catch (err) {
    console.error('Error fetching semesters:', err);
    return res.json(localDb.semesters || []);
  }
});

// POST new semester
router.post('/', async (req, res) => {
  try {
    const { name, order_index } = req.body;
    if (!name) return res.status(400).json({ error: 'Semester name is required' });

    const newSemester = {
      id: 'sem-' + Date.now(),
      name,
      order_index: parseInt(order_index) || (localDb.semesters ? localDb.semesters.length + 1 : 1),
      created_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('semesters').insert([
          { name, order_index: parseInt(order_index) || 1 }
        ]).select();
        if (!error && data && data.length > 0) {
          return res.status(201).json(data[0]);
        }
        console.warn('Supabase semester insert warning, falling back to localDb:', error?.message);
      } catch (e) {
        console.warn('Supabase semester insert error, falling back to localDb:', e.message);
      }
    }

    if (!localDb.semesters) localDb.semesters = [];
    localDb.semesters.push(newSemester);
    saveLocalDb();
    return res.status(201).json(newSemester);
  } catch (err) {
    console.error('Error creating semester:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle semester visibility (is_visible: true / false)
router.patch('/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_visible } = req.body;

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('semesters').update({ is_visible }).eq('id', id).select();
        if (!error && data && data.length > 0) {
          return res.json(data[0]);
        }
      } catch (e) {}
    }

    const sem = (localDb.semesters || []).find(s => s.id === id);
    if (!sem) return res.status(404).json({ error: 'Semester not found' });
    sem.is_visible = is_visible;
    saveLocalDb();
    return res.json(sem);
  } catch (err) {
    console.error('Error toggling semester visibility:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE semester AND cascade delete subjects + materials inside it
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isConfigured && supabase) {
      // 1. Fetch subjects in this semester to delete their materials and storage files
      const { data: subjects } = await supabase.from('subjects').select('id').eq('semester_id', id);
      if (subjects && subjects.length > 0) {
        const subjectIds = subjects.map(s => s.id);
        const { data: materials } = await supabase.from('materials').select('id, file_path').in('subject_id', subjectIds);
        if (materials && materials.length > 0) {
          const filePaths = materials.map(m => m.file_path).filter(Boolean);
          if (filePaths.length > 0) {
            await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs').remove(filePaths);
          }
          await supabase.from('materials').delete().in('subject_id', subjectIds);
        }
        await supabase.from('subjects').delete().eq('semester_id', id);
      }

      // 2. Delete the semester itself
      const { error } = await supabase.from('semesters').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    } else {
      // Local storage cascade delete
      const subjectsToDelete = localDb.subjects.filter(s => s.semester_id === id);
      const subjectIdsToDelete = new Set(subjectsToDelete.map(s => s.id));

      const materialsToDelete = localDb.materials.filter(m => subjectIdsToDelete.has(m.subject_id));
      materialsToDelete.forEach(m => {
        if (m.file_path) {
          const filePath = path.join(UPLOADS_DIR, m.file_path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        delete localDb.notes[m.id];
      });

      localDb.materials = localDb.materials.filter(m => !subjectIdsToDelete.has(m.subject_id));
      localDb.subjects = localDb.subjects.filter(s => s.semester_id !== id);
      localDb.semesters = localDb.semesters.filter(sem => sem.id !== id);
      saveLocalDb();
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('Error deleting semester:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
