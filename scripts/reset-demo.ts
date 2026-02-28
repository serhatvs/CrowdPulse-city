import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/crowdpulse";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await pool.query("TRUNCATE votes, hazards, audit_log RESTART IDENTITY CASCADE");
    console.log("Demo reset complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Reset failed:", error);
  process.exit(1);
});
