const express = require('express');
const router = express.Router();
const { supabase, isConfigured, localDb } = require('../supabase');

// GET overall study tracker analytics summary
router.get('/stats', async (req, res) => {
  try {
    let materials = [];
    let subjects = [];

    if (isConfigured && supabase) {
      const { data: mData } = await supabase.from('materials').select('*');
      const { data: sData } = await supabase.from('subjects').select('*');
      materials = mData || [];
      subjects = sData || [];
    } else {
      materials = localDb.materials;
      subjects = localDb.subjects;
    }

    const totalPDFs = materials.length;
    const completed = materials.filter(m => m.status === 'completed').length;
    const inProgress = materials.filter(m => m.status === 'in_progress').length;
    const unread = materials.filter(m => m.status === 'unread' || !m.status).length;

    let totalPagesRead = 0;
    let totalPagesOverall = 0;

    materials.forEach(m => {
      const total = m.total_pages || 1;
      const current = m.current_page || 1;
      totalPagesOverall += total;
      totalPagesRead += Math.min(current, total);
    });

    const overallPercentage = totalPagesOverall > 0 
      ? Math.round((totalPagesRead / totalPagesOverall) * 100) 
      : 0;

    // Breakdown per subject
    const subjectStats = subjects.map(subj => {
      const count = materials.filter(m => m.subject_id === subj.id).length;
      return {
        id: subj.id,
        name: subj.name,
        color: subj.color,
        count
      };
    });

    return res.json({
      totalPDFs,
      completed,
      inProgress,
      unread,
      totalPagesRead,
      totalPagesOverall,
      overallPercentage,
      subjectStats
    });
  } catch (err) {
    console.error('Error fetching tracker stats:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
