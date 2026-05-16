import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('server/.env');
console.log('Loading env from:', envPath);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('Error loading .env file:', envResult.error);
}

console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const results = {};
    const queries = {
      expenses: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses'",
      expense_splits: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expense_splits'",
      expense_member_discounts: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expense_member_discounts'",
      group_members: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'group_members'"
    };

    for (const [table, query] of Object.entries(queries)) {
      const res = await pool.query(query);
      results[table] = res.rows;
    }

    console.log('---SCHEMA_START---');
    console.log(JSON.stringify(results, null, 2));
    console.log('---SCHEMA_END---');
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
