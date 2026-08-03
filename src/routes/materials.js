const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase, isConfigured, localDb, saveLocalDb, UPLOADS_DIR } = require('../supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max PDF
});

function sortMaterials(materialsList) {
  return [...materialsList].sort((a, b) => {
    const weekA = parseInt((a.week_info || '').replace(/\D/g, '')) || 9999;
    const weekB = parseInt((b.week_info || '').replace(/\D/g, '')) || 9999;
    if (weekA !== weekB) return weekA - weekB;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

// GET all study materials
router.get('/', async (req, res) => {
  try {
    if (isConfigured && supabase) {
      const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return res.json(sortMaterials(data));
      }
      console.warn('Supabase materials fetch notice, using localDb materials:', error ? error.message : 'Empty Supabase table');
    }
    return res.json(sortMaterials(localDb.materials || []));
  } catch (err) {
    console.error('Error fetching materials:', err);
    return res.json(sortMaterials(localDb.materials || []));
  }
});

// POST upload new PDF material (or create text/placeholder study entry)
router.post('/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const { title, subject_id, tags, total_pages, week_info, file_url: bodyFileUrl, file_path: bodyFilePath, file_size: bodyFileSize } = req.body || {};
    const file = req.file;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let fileUrl = bodyFileUrl || null;
    let fileName = bodyFilePath || '';
    let fileSize = bodyFileSize || 0;

    if (file) {
      const fileExt = path.extname(file.originalname) || '.pdf';
      fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExt}`;
      fileSize = file.size;

      try {
        const localFilePath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(localFilePath, file.buffer);
        fileUrl = `/uploads/${fileName}`;
      } catch (err) {
        console.warn('Local disk write skipped on serverless:', err.message);
      }
    }

    const tagList = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : (tags || []);
    
    // Smart Subject ID Resolver: map string/legacy IDs to valid Supabase subject UUIDs
    let resolvedSubjectId = subject_id || null;
    if (resolvedSubjectId) {
      const isSubjUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSubjectId);
      if (!isSubjUuid) {
        const found = (localDb.subjects || []).find(s => String(s.id) === String(resolvedSubjectId) || s.name === resolvedSubjectId);
        if (found) resolvedSubjectId = found.id;
      }
    }
    const finalSubjectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSubjectId || '') ? resolvedSubjectId : null;

    let createdMat = {
      id: 'mat-' + Date.now(),
      title: title.trim(),
      subject_id: resolvedSubjectId || null,
      week_info: week_info || '',
      file_url: fileUrl || '',
      file_path: fileName || '',
      file_size: fileSize || 0,
      total_pages: parseInt(total_pages) || 1,
      current_page: 1,
      status: 'unread',
      tags: tagList,
      created_at: new Date().toISOString()
    };

    // 2. If Supabase Cloud is configured, insert record into Supabase Database & Storage Bucket
    if (isConfigured && supabase) {
      try {
        if (file) {
          const { error: storageErr } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs')
            .upload(fileName, file.buffer, { contentType: 'application/pdf', upsert: true });

          if (!storageErr) {
            const { data: publicUrlData } = supabase.storage
              .from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs')
              .getPublicUrl(fileName);
            if (publicUrlData && publicUrlData.publicUrl) {
              fileUrl = publicUrlData.publicUrl;
              createdMat.file_url = fileUrl;
            }
          }
        }

        // Insert database row into Supabase 'materials' table
        const insertData = {
          title: title.trim(),
          subject_id: finalSubjectUuid,
          week_info: week_info || '',
          file_url: fileUrl || '',
          file_path: fileName || '',
          file_size: fileSize || 0,
          total_pages: parseInt(total_pages) || 1,
          current_page: 1,
          status: 'unread',
          tags: tagList
        };

        const { data: dbData, error: dbErr } = await supabase.from('materials').insert([insertData]).select();
        if (!dbErr && dbData && dbData.length > 0) {
          console.log('✅ PDF Study Material inserted into Supabase DB:', dbData[0].id);
          createdMat = { ...dbData[0], subject_id: resolvedSubjectId || dbData[0].subject_id || null };
        } else if (dbErr) {
          console.warn('Supabase material DB insert notice:', dbErr.message);
        }
      } catch (e) {
        console.warn('Supabase upload notice:', e.message);
      }
    }

    localDb.materials.unshift(createdMat);
    saveLocalDb();
    return res.status(201).json(createdMat);
  } catch (err) {
    console.error('Upload material error, using resilient fallback:', err.message);
    const fileName = `${Date.now()}_file.pdf`;
    const tagList = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const fallbackMat = {
      id: 'mat-' + Date.now(),
      title: req.body?.title || 'Study Material',
      subject_id: req.body?.subject_id || null,
      file_url: `/uploads/${fileName}`,
      file_path: fileName,
      file_size: req.file ? req.file.size : 1024,
      total_pages: 1,
      current_page: 1,
      status: 'unread',
      tags: tagList,
      created_at: new Date().toISOString()
    };

    if (req.file) {
      const localFilePath = path.join(UPLOADS_DIR, fileName);
      try { fs.writeFileSync(localFilePath, req.file.buffer); } catch (e) {}
    }

    localDb.materials.unshift(fallbackMat);
    saveLocalDb();
    return res.status(201).json(fallbackMat);
  }
});

// PUT edit material metadata & optionally attach/update PDF file
router.put('/:id', upload.single('pdfFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject_id, week_info, tags } = req.body;
    const file = req.file;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (subject_id !== undefined) updates.subject_id = subject_id || null;
    if (week_info !== undefined) updates.week_info = week_info;
    if (tags !== undefined) {
      updates.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : (tags || []);
    }

    if (file) {
      const fileExt = path.extname(file.originalname) || '.pdf';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExt}`;
      
      try {
        const localFilePath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(localFilePath, file.buffer);
        updates.file_url = `/uploads/${fileName}`;
        updates.file_path = fileName;
      } catch (err) {
        console.warn('Local disk write skipped on serverless:', err.message);
      }

      updates.file_size = file.size;
      updates.status = 'unread';

      if (isConfigured && supabase) {
        try {
          const { error: storageErr } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs')
            .upload(fileName, file.buffer, { contentType: 'application/pdf', upsert: true });

          if (!storageErr) {
            const { data: publicUrlData } = supabase.storage
              .from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs')
              .getPublicUrl(fileName);
            if (publicUrlData && publicUrlData.publicUrl) {
              updates.file_url = publicUrlData.publicUrl;
            }
          }
        } catch (e) {
          console.warn('Supabase storage update notice:', e.message);
        }
      }
    }

    // 1. Always update localDb first to guarantee instant, 100% reliable persistence
    let item = (localDb.materials || []).find(m => String(m.id) === String(id));
    if (!item && localDb.materials && localDb.materials.length > 0) {
      item = localDb.materials.find(m => m.title === title);
    }

    if (item) {
      Object.assign(item, updates);
    } else {
      item = { id, title: title || 'Study Material', ...updates, created_at: new Date().toISOString() };
      localDb.materials.unshift(item);
    }
    saveLocalDb();

    // 2. Safely attempt Supabase Cloud DB update if configured
    if (isConfigured && supabase) {
      try {
        const isValidIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const isValidSubjUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.subject_id || '');
        
        if (isValidIdUuid) {
          const supaUpdates = { ...updates };
          if (!isValidSubjUuid) delete supaUpdates.subject_id;

          const { data, error } = await supabase.from('materials').update(supaUpdates).eq('id', id).select();
          if (!error && data && data.length > 0) {
            return res.json({ ...item, ...data[0], subject_id: updates.subject_id });
          }
        }
      } catch (e) {
        console.warn('Supabase material update notice:', e.message);
      }
    }

    return res.json(item);
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH update material reading progress
router.patch('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { current_page, total_pages, status } = req.body;

    const updates = {};
    if (current_page !== undefined) updates.current_page = parseInt(current_page);
    if (total_pages !== undefined) updates.total_pages = parseInt(total_pages);
    if (status !== undefined) updates.status = status;

    if (updates.current_page && updates.total_pages) {
      if (updates.current_page >= updates.total_pages) {
        updates.status = 'completed';
      } else if (updates.current_page > 1) {
        updates.status = 'in_progress';
      }
    }

    if (isConfigured && supabase) {
      const { data, error } = await supabase.from('materials').update(updates).eq('id', id).select();
      if (error) throw error;
      return res.json(data[0]);
    } else {
      const item = localDb.materials.find(m => m.id === id);
      if (!item) return res.status(404).json({ error: 'Material not found' });
      Object.assign(item, updates);
      saveLocalDb();
      return res.json(item);
    }
  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE material
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isConfigured && supabase) {
      // Get file_path to delete from storage
      const { data: item } = await supabase.from('materials').select('file_path').eq('id', id).single();
      if (item && item.file_path) {
        await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'study-pdfs').remove([item.file_path]);
      }
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    } else {
      const itemIndex = localDb.materials.findIndex(m => m.id === id);
      if (itemIndex !== -1) {
        const item = localDb.materials[itemIndex];
        if (item.file_path) {
          const filePath = path.join(UPLOADS_DIR, item.file_path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        localDb.materials.splice(itemIndex, 1);
        saveLocalDb();
      }
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
