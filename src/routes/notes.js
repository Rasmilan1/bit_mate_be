const express = require('express');
const router = express.Router();
const { supabase, isConfigured, localDb, saveLocalDb } = require('../supabase');

// GET notes for a specific study material
router.get('/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('study_notes')
        .select('*')
        .eq('material_id', materialId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return res.json(data || { material_id: materialId, content: '' });
    }

    const note = localDb.notes[materialId] || { material_id: materialId, content: '' };
    return res.json(note);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST / PUT save study notes for a material
router.post('/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { content } = req.body;

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('study_notes')
        .upsert([
          { material_id: materialId, content, updated_at: new Date().toISOString() }
        ], { onConflict: 'material_id' })
        .select();

      if (error) throw error;
      return res.json(data[0]);
    }

    const updatedNote = {
      material_id: materialId,
      content,
      updated_at: new Date().toISOString()
    };
    localDb.notes[materialId] = updatedNote;
    saveLocalDb();
    return res.json(updatedNote);
  } catch (err) {
    console.error('Error saving study notes:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
