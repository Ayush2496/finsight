// db.js — MySQL connection pool
// Every route file imports this to query the database.
// We use a pool (not a single connection) so multiple
// requests can be handled simultaneously without waiting.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host    : process.env.DB_HOST     || 'localhost',
  port    : process.env.DB_PORT     || 3306,
  user    : process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'finsight',
  waitForConnections: true,
  connectionLimit   : 10,   // max 10 simultaneous DB connections
  queueLimit        : 0
});

// Test the connection once at startup
// If credentials are wrong, you'll know immediately
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your .env DB_HOST / DB_USER / DB_PASSWORD / DB_NAME');
    process.exit(1);   // stop the server — no point running without a DB
  });

module.exports = pool;
