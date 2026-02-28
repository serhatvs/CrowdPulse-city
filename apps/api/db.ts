import "../../scripts/load-env";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/crowdpulse",
  max: 10,
});

export type HazardVote = {
  value: number;
  created_at: number;
  voter: string;
  trust: number;
};

export type HazardRecord = {
  id: number;
  latE6: number;
  lonE6: number;
  type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  severity: number;
  category: number;
  chain_hazard_id: number | null;
  closed: boolean;
  votes?: HazardVote[];
  lastActivityTimestamp?: number;
};

export type VoteHazardStatus = "ok" | "duplicate" | "not_found";

type CreateHazardInput = {
  lat: number;
  lon: number;
  type: string;
  description?: string | null;
  created_by?: string | null;
  category?: number;
  severity?: number;
  chain_hazard_id?: number | null;
};

type Bounds = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

type HazardBboxFilter = {
  category?: number;
  includeClosed?: boolean;
};

export type HazardVoteTotals = {
  upVotes: number;
  downVotes: number;
  totalVotes: number;
  netVotes: number;
};

function mapHazardRow(row: Record<string, unknown>): HazardRecord {
  const latE6 = Number(row.latE6 ?? row.late6);
  const lonE6 = Number(row.lonE6 ?? row.lone6);
  return {
    id: Number(row.id),
    latE6,
    lonE6,
    type: String(row.type ?? ""),
    description: (row.description as string | null) ?? null,
    created_at: new Date(String(row.created_at)).toISOString(),
    created_by: (row.created_by as string | null) ?? null,
    severity: Number(row.severity ?? 3),
    category: Number(row.category ?? 1),
    chain_hazard_id: row.chain_hazard_id == null ? null : Number(row.chain_hazard_id),
    closed: Boolean(row.closed),
  };
}

export async function findRecentDuplicate(lat: number, lon: number, type: string): Promise<boolean> {
  // Approx 10-11m box: 1 E6 unit ~= 0.11m.
  const latE6 = Math.round(lat * 1e6);
  const lonE6 = Math.round(lon * 1e6);

  const { rows } = await pool.query(
    `SELECT 1
       FROM hazards
      WHERE ABS(latE6 - $1) <= 100
        AND ABS(lonE6 - $2) <= 100
        AND type = $3
        AND created_at > NOW() - INTERVAL '1 hour'
      LIMIT 1`,
    [latE6, lonE6, type],
  );
  return rows.length > 0;
}

export async function createHazard(input: CreateHazardInput): Promise<HazardRecord> {
  const latE6 = Math.round(input.lat * 1e6);
  const lonE6 = Math.round(input.lon * 1e6);
  const type = input.type;
  const description = input.description ?? null;
  const createdBy = input.created_by ?? null;
  const category = input.category ?? 1;
  const severity = input.severity ?? 3;
  const chainHazardId = input.chain_hazard_id ?? null;

  if (chainHazardId != null) {
    const { rows } = await pool.query(
      `INSERT INTO hazards (latE6, lonE6, type, description, created_by, category, severity, chain_hazard_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (chain_hazard_id) WHERE chain_hazard_id IS NOT NULL
       DO UPDATE SET
         latE6 = EXCLUDED.latE6,
         lonE6 = EXCLUDED.lonE6,
         type = EXCLUDED.type,
         description = EXCLUDED.description,
         created_by = EXCLUDED.created_by,
         category = EXCLUDED.category,
         severity = EXCLUDED.severity
       RETURNING id, latE6 AS "latE6", lonE6 AS "lonE6", type, description, created_at, created_by, category, severity, chain_hazard_id, closed`,
      [latE6, lonE6, type, description, createdBy, category, severity, chainHazardId],
    );
    return mapHazardRow(rows[0] as Record<string, unknown>);
  }

  const { rows } = await pool.query(
    `INSERT INTO hazards (latE6, lonE6, type, description, created_by, category, severity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, latE6 AS "latE6", lonE6 AS "lonE6", type, description, created_at, created_by, category, severity, chain_hazard_id, closed`,
    [latE6, lonE6, type, description, createdBy, category, severity],
  );
  return mapHazardRow(rows[0] as Record<string, unknown>);
}

export async function getHazardById(hazardId: number): Promise<HazardRecord | null> {
  const { rows } = await pool.query(
    `SELECT id, latE6 AS "latE6", lonE6 AS "lonE6", type, description, created_at, created_by, category, severity, chain_hazard_id, closed
       FROM hazards
      WHERE id = $1
      LIMIT 1`,
    [hazardId],
  );
  if (rows.length === 0) {
    return null;
  }
  return mapHazardRow(rows[0] as Record<string, unknown>);
}

export async function voteHazard(hazardId: number, voter: string, value: number): Promise<VoteHazardStatus> {
  const hazard = await getHazardById(hazardId);
  if (!hazard) {
    return "not_found";
  }

  const { rowCount } = await pool.query(
    `INSERT INTO votes (hazard_id, voter, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (hazard_id, voter) DO NOTHING`,
    [hazardId, voter.toLowerCase(), value],
  );
  return rowCount && rowCount > 0 ? "ok" : "duplicate";
}

export async function getHazardsInBbox(bounds: Bounds, filter: HazardBboxFilter = {}): Promise<HazardRecord[]> {
  const minLatE6 = Math.floor(bounds.minLat * 1e6);
  const minLonE6 = Math.floor(bounds.minLon * 1e6);
  const maxLatE6 = Math.ceil(bounds.maxLat * 1e6);
  const maxLonE6 = Math.ceil(bounds.maxLon * 1e6);
  const values: number[] = [minLatE6, maxLatE6, minLonE6, maxLonE6];
  const where = ["latE6 >= $1", "latE6 <= $2", "lonE6 >= $3", "lonE6 <= $4"];

  if (filter.category != null && Number.isInteger(filter.category) && filter.category > 0) {
    values.push(filter.category);
    where.push(`category = $${values.length}`);
  }
  if (filter.includeClosed === false) {
    where.push("closed = false");
  }

  const { rows } = await pool.query(
    `SELECT id, latE6 AS "latE6", lonE6 AS "lonE6", type, description, created_at, created_by, category, severity, chain_hazard_id, closed
       FROM hazards
      WHERE ${where.join(" AND ")}`,
    values,
  );
  const hazards = rows.map((row) => mapHazardRow(row as Record<string, unknown>));
  if (hazards.length === 0) {
    return hazards;
  }

  const ids = hazards.map((hazard) => hazard.id);
  const { rows: voteRows } = await pool.query(
    `SELECT id, hazard_id, voter, value, created_at
       FROM votes
      WHERE hazard_id = ANY($1::int[])`,
    [ids],
  );

  const votesByHazard = voteRows.reduce<Record<number, HazardVote[]>>((acc, vote) => {
    const hazardId = Number(vote.hazard_id);
    if (!acc[hazardId]) {
      acc[hazardId] = [];
    }
    acc[hazardId].push({
      value: Number(vote.value),
      created_at: Math.floor(new Date(String(vote.created_at)).getTime() / 1000),
      voter: String(vote.voter),
      trust: 1,
    });
    return acc;
  }, {});

  return hazards.map((hazard) => {
    const hazardVotes = votesByHazard[hazard.id] ?? [];
    const latestVoteTs = hazardVotes.reduce((max, vote) => Math.max(max, vote.created_at), 0);
    const createdAtTs = Math.floor(new Date(hazard.created_at).getTime() / 1000);
    return {
      ...hazard,
      votes: hazardVotes,
      lastActivityTimestamp: Math.max(createdAtTs, latestVoteTs),
    };
  });
}

export async function getHazardVoteTotals(hazardId: number): Promise<HazardVoteTotals> {
  const { rows } = await pool.query<{ upvotes: string; downvotes: string; totalvotes: string; netvotes: string }>(
    `SELECT
      COUNT(*) FILTER (WHERE value > 0)::text AS upvotes,
      COUNT(*) FILTER (WHERE value < 0)::text AS downvotes,
      COUNT(*)::text AS totalvotes,
      COALESCE(SUM(value), 0)::text AS netvotes
     FROM votes
     WHERE hazard_id = $1`,
    [hazardId],
  );
  const row = rows[0];
  return {
    upVotes: Number(row?.upvotes ?? 0),
    downVotes: Number(row?.downvotes ?? 0),
    totalVotes: Number(row?.totalvotes ?? 0),
    netVotes: Number(row?.netvotes ?? 0),
  };
}

export async function closeHazard(hazardId: number): Promise<boolean> {
  const { rowCount } = await pool.query("UPDATE hazards SET closed = true WHERE id = $1 AND closed = false", [hazardId]);
  return Boolean(rowCount && rowCount > 0);
}

export default pool;
