import { pool } from './db';

/**
 * Audit log'a event ekler
 */
export async function logEvent(eventType: string, payload: any) {
  await pool.query(
    'INSERT INTO audit_log (event_type, payload, created_at) VALUES ($1, $2, NOW())',
    [eventType, JSON.stringify(payload)]
  );
}
