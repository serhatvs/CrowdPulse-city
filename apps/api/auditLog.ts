import { pool } from "./db";

export async function logEvent(eventType: string, payload: unknown): Promise<void> {
  await pool.query(
    "INSERT INTO audit_log (event_type, payload, created_at) VALUES ($1, $2, NOW())",
    [eventType, JSON.stringify(payload ?? null)],
  );
}

export type AuditEventRecord = {
  id: number;
  event_type: string;
  payload: unknown;
  created_at: string;
};

export async function listRecentEvents(limit = 25): Promise<AuditEventRecord[]> {
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 25;
  const { rows } = await pool.query<AuditEventRecord>(
    `SELECT id, event_type, payload, created_at
       FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1`,
    [safeLimit],
  );
  return rows.map((row) => ({
    ...row,
    created_at: new Date(row.created_at).toISOString(),
  }));
}
