const express = require('express');
const cors = require('cors');
const path = require('path');
const { UPLOADS_DIR, isConfigured } = require('./supabase');

const authRouter = require('./routes/auth');
const semestersRouter = require('./routes/semesters');
const subjectsRouter = require('./routes/subjects');
const materialsRouter = require('./routes/materials');
const notesRouter = require('./routes/notes');
const trackerRouter = require('./routes/tracker');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors());
app.use(express.json());

// Serve local upload files statically for fallback mode
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/semesters', semestersRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/tracker', trackerRouter);

// Health Check & System Status API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    supabaseConnected: isConfigured,
    mode: isConfigured ? 'Supabase Cloud Engine ($0 DB)' : 'Local Engine (Ready for Supabase .env keys)'
  });
});

// Root fallback route for Vercel health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'BitMat Backend API Server (Vercel Serverless)',
    health: '/api/health'
  });
});

// Only listen on port if not running as Vercel serverless function
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Study Hub Server running on http://localhost:${PORT}`);
    console.log(`📡 Storage Mode: ${isConfigured ? 'Supabase Cloud Storage' : 'Local File Storage'}`);
  });
}

module.exports = app;
