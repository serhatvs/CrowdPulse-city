import { Pool } from 'pg';

export type HazardRecord = {
  id: number;
  latE6: number;
  lonE6: number;
  type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
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

export async function getHazards(): Promise<HazardRecord[]> {
  const { rows } = await pool.query('SELECT * FROM hazards');
  return rows;
}

export async function addHazard(hazard: Omit<HazardRecord, 'id' | 'created_at'>): Promise<HazardRecord> {
  const { latE6, lonE6, type, description, created_by } = hazard;
  const { rows } = await pool.query(
    'INSERT INTO hazards (latE6, lonE6, type, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [latE6, lonE6, type, description, created_by]
  );
  return rows[0];
}

export async function getVotes(hazard_id: number): Promise<VoteRecord[]> {
  const { rows } = await pool.query('SELECT * FROM votes WHERE hazard_id = $1', [hazard_id]);
  return rows;
}

export async function addVote(vote: Omit<VoteRecord, 'id' | 'created_at'>): Promise<VoteRecord> {
  const { hazard_id, voter, value } = vote;
  const { rows } = await pool.query(
    'INSERT INTO votes (hazard_id, voter, value) VALUES ($1, $2, $3) RETURNING *',
    [hazard_id, voter, value]
  );
  return rows[0];
}

export default pool;
    return { hazards: [] };
  }
}


export async function createHazard(input: { lat: number; lon: number; type: string; description?: string | null; created_by?: string | null }): Promise<HazardRecord> {
  const latE6 = Math.round(input.lat * 1e6);
  const lonE6 = Math.round(input.lon * 1e6);
  const { type, description, created_by } = input;
  const { rows } = await pool.query(
    'INSERT INTO hazards (latE6, lonE6, type, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [latE6, lonE6, type, description, created_by]
  );
  return rows[0];
}

export async function voteHazard(hazardId: number, voter: string, value: number): Promise<VoteRecord | null> {
  // value: 1 (up), -1 (down)
  const { rows } = await pool.query(
    'INSERT INTO votes (hazard_id, voter, value) VALUES ($1, $2, $3) RETURNING *',
    [hazardId, voter, value]
  );
  return rows[0] || null;
}

export async function getHazardsInBbox(bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number }): Promise<any[]> {
  const minLatE6 = Math.floor(bounds.minLat * 1e6);
  const minLonE6 = Math.floor(bounds.minLon * 1e6);
  const maxLatE6 = Math.ceil(bounds.maxLat * 1e6);
  const maxLonE6 = Math.ceil(bounds.maxLon * 1e6);
  const { rows: hazards } = await pool.query(
    'SELECT * FROM hazards WHERE latE6 >= $1 AND latE6 <= $2 AND lonE6 >= $3 AND lonE6 <= $4',
    [minLatE6, maxLatE6, minLonE6, maxLonE6]
  );
  // Her hazard için votes ve voter trust ekle
  for (const h of hazards) {
    const { rows: votes } = await pool.query('SELECT * FROM votes WHERE hazard_id = $1', [h.id]);
    // TODO: User trust hesaplama (örnek: tüm oylar için trust=1)
    h.votes = votes.map(v => ({
      value: v.value,
      created_at: Math.floor(new Date(v.created_at).getTime() / 1000),
      voter: v.voter,
      trust: 1 // ileride reputation tablosu ile güncellenebilir
    }));
    h.severity = 3; // örnek, ileride DB'den alınabilir
    h.lastActivityTimestamp = Math.floor(new Date(h.created_at).getTime() / 1000);
  }
  return hazards;
}
