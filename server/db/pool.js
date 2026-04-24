const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'kwh_split',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
});

// Create table if not exists
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY,
        description TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        timestamp BIGINT NOT NULL
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.warn('PostgreSQL not available. Using in-memory fallback for demonstration.');
  }
};

initDb();

const inMemoryStore = {
  expenses: []
};

module.exports = { pool, inMemoryStore };
