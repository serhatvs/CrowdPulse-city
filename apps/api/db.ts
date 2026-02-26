export async function findRecentDuplicate(
  lat: number, lon: number, type: string
): Promise<boolean> {
  const minLatE6 = Math.floor((lat - 0.0001) * 1e6);
  const maxLatE6 = Math.ceil((lat + 0.0001) * 1e6);
  const minLonE6 = Math.floor((lon - 0.0001) * 1e6);
  const maxLonE6 = Math.ceil((lon + 0.0001) * 1e6);
  const { rows } = await pool.query(
    `SELECT 1 FROM hazards
     WHERE latE6 BETWEEN $1 AND $2
     AND lonE6 BETWEEN $3 AND $4
     AND type = $5
     AND created_at > NOW() - INTERVAL '1 hour'
     LIMIT 1`,
    [minLatE6, maxLatE6, minLonE6, maxLonE6, type]
  );
  return rows.length > 0;
}

import { Pool } from 'pg';

export type HazardRecord = {
  id: number;
  latE6: number;
  lonE6: number;
  type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  severity?: number;
  category?: number;
};

export type VoteRecord = {
  id: number;
  hazard_id: number;
  voter: string;
  value: number;
  created_at: string;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/postgres',
  max: 10,
});

export async function createHazard(input: { lat: number; lon: number; type: string; description?: string | null; created_by?: string | null; category?: number; severity?: number }): Promise<HazardRecord> {
  const latE6 = Math.round(input.lat * 1e6);
  const lonE6 = Math.round(input.lon * 1e6);
  const { type, description, created_by, category, severity } = input;
  const { rows } = await pool.query(
    'INSERT INTO hazards (latE6, lonE6, type, description, created_by, category, severity) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [latE6, lonE6, type, description, created_by, category, severity]
  );
  return rows[0];
}

export async function voteHazard(hazardId: number, voter: string, value: number): Promise<VoteRecord | null> {
  // value: 1 (up), -1 (down)
  const { rows } = await pool.query(
    'INSERT INTO votes (hazard_id, voter, value) VALUES ($1, $2, $3) ON CONFLICT (hazard_id, voter) DO NOTHING RETURNING *',
    [hazardId, voter, value]
  );
  return rows[0] || null;
}


export async function getHazardsInBbox(
  bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number }
): Promise<any[]> {
  const minLatE6 = Math.floor(bounds.minLat * 1e6);
  const minLonE6 = Math.floor(bounds.minLon * 1e6);
  const maxLatE6 = Math.ceil(bounds.maxLat * 1e6);
  const maxLonE6 = Math.ceil(bounds.maxLon * 1e6);
  const { rows: hazards } = await pool.query(
    `SELECT * FROM hazards WHERE latE6 >= $1 AND latE6 <= $2 AND lonE6 >= $3 AND lonE6 <= $4`,
    [minLatE6, maxLatE6, minLonE6, maxLonE6]
  );
  const ids = hazards.map(h => h.id);
  if (ids.length === 0) return hazards;
  const { rows: allVotes } = await pool.query(
    'SELECT * FROM votes WHERE hazard_id = ANY($1)',
    [ids]
  );
  const votesByHazard = allVotes.reduce((acc, v) => {
    (acc[v.hazard_id] ??= []).push(v);
    return acc;
  }, {} as Record<number, any[]>);
  for (const h of hazards) {
    h.votes = (votesByHazard[h.id] ?? []).map(v => ({
      value: v.value,
      created_at: Math.floor(new Date(v.created_at).getTime() / 1000),
      voter: v.voter,
      trust: 1
    }));
    h.lastActivityTimestamp = Math.floor(new Date(h.created_at).getTime() / 1000);
  }
  return hazards;
}

export { pool };
export default pool;
