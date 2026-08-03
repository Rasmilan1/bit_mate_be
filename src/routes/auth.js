const express = require('express');
const router = express.Router();
const { supabase, isConfigured } = require('../supabase');

// Admin default credentials (can be overridden in server/.env)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    // 1. If Supabase Cloud is configured, attempt Supabase Auth
    if (isConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (!error && data && data.user) {
        return res.json({
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || cleanEmail.split('@')[0]
          }
        });
      }
    }

    // 2. Fallback / Admin credentials check
    if (cleanEmail === ADMIN_EMAIL && cleanPassword === ADMIN_PASSWORD) {
      return res.json({
        success: true,
        user: {
          id: 'admin-1',
          email: ADMIN_EMAIL,
          name: 'Admin'
        }
      });
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      error: 'Invalid admin credentials. Please enter a valid admin email and password.'
    });
  } catch (err) {
    console.error('Auth login error:', err);
    return res.status(500).json({ success: false, error: 'Server authentication error.' });
  }
});

module.exports = router;
