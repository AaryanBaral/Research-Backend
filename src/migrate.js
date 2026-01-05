import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "..", "migrations");

async function ensureMigrationsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function getAppliedMigrations() {
  const result = await pool.query("SELECT filename FROM migrations ORDER BY filename");
  return new Set(result.rows.map((row) => row.filename));
}

async function runMigration(filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [filename]);
    await pool.query("COMMIT");
    console.log(`Applied ${filename}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  try {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      if (!applied.has(filename)) {
        await runMigration(filename);
      }
    }

    console.log("Migrations complete.");
  } catch (error) {
    console.error("Migration failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
