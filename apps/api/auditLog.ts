import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/postgres',
  max: 10,
});

export async function logEvent(eventType: string, payload: any) {
  await pool.query(
    'INSERT INTO audit_log (event_type, payload, created_at) VALUES ($1, $2, NOW())',
    [eventType, JSON.stringify(payload)]
  );
}
