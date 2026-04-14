// config/db.js — MySQL Connection Pool
// DBMS Concept: Connection pooling reuses connections instead of
// creating a new one per request. Reduces overhead and prevents
// connection exhaustion under load.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fraud_wallet',
    waitForConnections: true,
    connectionLimit: 10,        // max concurrent connections
    queueLimit: 0,              // unlimited queue
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL connected — database:', process.env.DB_NAME);
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL connection failed:', err.message);
    });

module.exports = pool;
