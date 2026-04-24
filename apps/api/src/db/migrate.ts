import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function listPendingMigrations(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.name));

  return files.filter((file) => !applied.has(file));
}

async function applyMigration(fileName: string): Promise<void> {
  const sql = await readFile(join(MIGRATIONS_DIR, fileName), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
      fileName,
    ]);
    await client.query("COMMIT");
    console.log(`✓ applied ${fileName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`✗ failed ${fileName}`);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await ensureMigrationsTable();
  const pending = await listPendingMigrations();

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const file of pending) {
    await applyMigration(file);
  }
  console.log(`Applied ${pending.length} migration(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
