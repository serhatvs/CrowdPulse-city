import "./load-env";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/crowdpulse",
});

async function runMigrations() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, "../migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }
  await pool.end();
  console.log("All migrations applied.");
}

runMigrations().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
