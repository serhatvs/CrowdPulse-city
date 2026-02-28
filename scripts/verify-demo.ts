import { Pool } from "pg";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";
const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/crowdpulse";
const minHazards = Number(process.env.DEMO_EXPECT_HAZARDS ?? 12);
const minVotes = Number(process.env.DEMO_EXPECT_VOTES ?? 12);

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const hazardsResult = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM hazards");
    const votesResult = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM votes");
    const hazardCount = Number(hazardsResult.rows[0]?.count ?? 0);
    const voteCount = Number(votesResult.rows[0]?.count ?? 0);

    const heatmapResponse = await fetch(`${apiUrl}/api/heatmap?bbox=38.49,35.49,38.52,35.52`);
    if (!heatmapResponse.ok) {
      throw new Error(`Heatmap check failed: ${heatmapResponse.status}`);
    }
    const heatmap = (await heatmapResponse.json()) as unknown[];
    const heatmapCells = heatmap.length;

    const report = { hazardCount, voteCount, heatmapCells, minHazards, minVotes };
    console.log(JSON.stringify(report, null, 2));

    if (hazardCount < minHazards) {
      throw new Error(`Expected at least ${minHazards} hazards, got ${hazardCount}`);
    }
    if (voteCount < minVotes) {
      throw new Error(`Expected at least ${minVotes} votes, got ${voteCount}`);
    }
    if (heatmapCells <= 0) {
      throw new Error("Expected heatmap to contain at least one cell.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Demo verification failed:", error);
  process.exit(1);
});
