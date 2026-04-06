// server.js — FinSight Backend Entry Point
require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const cors           = require('cors');
const path           = require('path');
const db             = require('./db');

const authRoutes        = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const dashboardRoutes   = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// CORS — must come BEFORE session middleware
// origin must exactly match Live Server URL
// ─────────────────────────────────────────────
app.use(cors({
  origin     : ['http://127.0.0.1:5500','http://127.0.0.1:5503'], // 5503 
  credentials: true
}));

// ─────────────────────────────────────────────
// Body parsers
// ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Session
// sameSite:'lax' is required for cookies to work
// between 127.0.0.1:5500 (frontend) and
// 127.0.0.1:3000 (backend) on different ports
// ─────────────────────────────────────────────
app.use(session({
  secret           : process.env.SESSION_SECRET || 'fallback_secret',
  resave           : false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure  : false,
    sameSite: 'lax',
    maxAge  : 1000 * 60 * 60 * 24
  }
}));

// ─────────────────────────────────────────────
// Static frontend
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard',    dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'FinSight Node.js' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ FinSight backend running → http://127.0.0.1:${PORT}`);
  console.log(`   Flask ML service → ${process.env.FLASK_URL || 'http://127.0.0.1:5000'}`);
});