// server.js — Express Application Entry Point
// Architecture: MVC pattern
//   Models:      MySQL tables (accessed via mysql2)
//   Views:       Frontend (static HTML served separately)
//   Controllers: controllers/*.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());                          // Allow frontend cross-origin requests
app.use(express.json());                  // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API routes — all under /api prefix
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve frontend for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n🚀 FraudAware Wallet Backend running on http://localhost:${PORT}`);
    console.log(`📡 API base: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
});
