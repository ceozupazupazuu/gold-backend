const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway injects DATABASE_URL automatically when you attach a Postgres plugin.
// Railway's internal Postgres does not require SSL; managed external ones often do,
// so we enable SSL only when explicitly asked to via PGSSL=true.
const useSsl = process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_init.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, runMigrations };
