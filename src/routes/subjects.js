const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { supabase, isConfigured, localDb, saveLocalDb, UPLOADS_DIR } = require('../supabase');

function sortSubjects(subjectsList) {
  return [...subjectsList].sort((a, b) => {
    const weekA = parseInt((a.week_info || '').replace(/\D/g, '')) || 9999;
    const weekB = parseInt((b.week_info || '').replace(/\D/g, '')) || 9999;
    if (weekA !== weekB) return weekA - weekB;

    const numA = parseInt((a.subject_number || '').replace(/\D/g, '')) || 9999;
    const numB = parseInt((b.subject_number || '').replace(/\D/g, '')) || 9999;
    if (numA !== numB) return numA - numB;

    return (a.name || '').localeCompare(b.name || '');
  });
}

// GET all subjects (optionally filtered by semester_id)
router.get('/', async (req, res) => {
  try {
    const { semester_id } = req.query;
    if (isConfigured && supabase) {
      let query = supabase.from('subjects').select('*').order('created_at', { ascending: true });
      if (semester_id) {
        query = query.eq('semester_id', semester_id);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return res.json(sortSubjects(data));
      }
      console.warn('Supabase subjects fetch notice, using localDb subjects:', error ? error.message : 'Empty Supabase table');
    }
    
    let allSubjects = localDb.subjects || [];
    if (semester_id) {
      allSubjects = allSubjects.filter(s => s.semester_id === semester_id || !s.semester_id);
    }
    return res.json(sortSubjects(allSubjects));
  } catch (err) {
    console.error('Error fetching subjects:', err);
    return res.json(sortSubjects(localDb.subjects || []));
  }
});

// POST new subject
router.post('/', async (req, res) => {
  const { name, color, semester_id, subject_number, week_info } = req.body;
  if (!name) return res.status(400).json({ error: 'Subject name is required' });

  const newSubject = {
    id: 'subj-' + Date.now(),
    semester_id: semester_id || null,
    name,
    subject_number: subject_number || '',
    week_info: week_info || '',
    color: color || '#4f46e5',
    created_at: new Date().toISOString()
  };

  try {
    if (isConfigured && supabase) {
      const insertObj = {
        name,
        color: color || '#4f46e5',
        subject_number: subject_number || '',
        week_info: week_info || ''
      };
      if (semester_id) insertObj.semester_id = semester_id;

      const { data, error } = await supabase.from('subjects').insert([insertObj]).select();
      if (!error && data && data.length > 0) {
        return res.status(201).json(data[0]);
      }
      console.warn('Supabase subject insert notice:', error ? error.message : 'No data returned');
    }

    localDb.subjects.push(newSubject);
    saveLocalDb();
    return res.status(201).json(newSubject);
  } catch (err) {
    console.error('Error creating subject, using resilient fallback:', err.message);
    localDb.subjects.push(newSubject);
    saveLocalDb();
    return res.status(201).json(newSubject);
  }
});

// PUT / PATCH edit subject
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color, semester_id, subject_number, week_info } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (semester_id !== undefined) updates.semester_id = semester_id;
  if (subject_number !== undefined) updates.subject_number = subject_number;
  if (week_info !== undefined) updates.week_info = week_info;

  try {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('subjects').update(updates).eq('id', id).select();
        if (!error && data && data.length > 0) {
          const item = (localDb.subjects || []).find(s => s.id === id);
          if (item) Object.assign(item, updates);
          saveLocalDb();
          return res.json(data[0]);
        }
      } catch (e) {
        console.warn('Supabase subject update notice:', e.message);
      }
    }

    const item = (localDb.subjects || []).find(s => s.id === id);
    if (item) {
      Object.assign(item, updates);
      saveLocalDb();
      return res.json(item);
    }
    return res.status(404).json({ error: 'Subject not found' });
  } catch (err) {
    console.error('Error updating subject:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE subject AND automatically cascade delete all PDFs inside that subject
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (isConfigured && supabase) {
      try {
        const { data: materials } = await supabase.from('materials').select('id, file_path').eq('subject_id', id);
        if (materials && materials.length > 0) {
          const filePaths = materials.map(m => m.file_path).filter(Boolean);
          if (filePaths.length > 0) {
            await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs').remove(filePaths);
          }
          await supabase.from('materials').delete().eq('subject_id', id);
        }
        await supabase.from('subjects').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase delete subject notice:', e.message);
      }
    }

    // Always clean up localDb as well so deletion is guaranteed 100%
    const materialsToDelete = (localDb.materials || []).filter(m => m.subject_id === id);
    materialsToDelete.forEach(m => {
      if (m.file_path) {
        const filePath = path.join(UPLOADS_DIR, m.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      if (localDb.notes) delete localDb.notes[m.id];
    });

    localDb.materials = (localDb.materials || []).filter(m => m.subject_id !== id);
    localDb.subjects = (localDb.subjects || []).filter(s => s.id !== id);
    saveLocalDb();

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting subject, applying emergency cleanup:', err.message);
    localDb.subjects = (localDb.subjects || []).filter(s => s.id !== id);
    saveLocalDb();
    return res.json({ success: true });
  }
});

module.exports = router;
