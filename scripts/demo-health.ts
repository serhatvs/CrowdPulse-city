import { execSync } from "node:child_process";
import { Pool } from "pg";

type ComposeItem = {
  Service: string;
  State: string;
  Health?: string;
};

type ServiceSummary = {
  state: string;
  health: string | null;
};

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001";
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/crowdpulse";

function parseComposeJson(raw: string): ComposeItem[] {
  const trimmed = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (!trimmed) {
    return [];
  }

  try {
    const data = JSON.parse(trimmed);
    return Array.isArray(data) ? (data as ComposeItem[]) : [data as ComposeItem];
  } catch {
    const rows: ComposeItem[] = [];
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") || line.startsWith("["));

    for (const line of lines) {
      const parsed = JSON.parse(line) as ComposeItem | ComposeItem[];
      if (Array.isArray(parsed)) {
        rows.push(...parsed);
      } else {
        rows.push(parsed);
      }
    }
    return rows;
  }
}

async function checkApi(): Promise<boolean> {
  const response = await fetch(`${apiUrl}/health`);
  return response.ok;
}

async function checkRpc(): Promise<boolean> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
      id: 1,
    }),
  });
  return response.ok;
}

async function readDbCounts() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const hazards = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM hazards");
    const votes = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM votes");
    return {
      hazardCount: Number(hazards.rows[0]?.count ?? 0),
      voteCount: Number(votes.rows[0]?.count ?? 0),
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  const composeOutput = execSync("docker compose ps --format json", { encoding: "utf8" });
  const services = parseComposeJson(composeOutput);
  const statusByService = new Map(services.map((service) => [service.Service, service]));

  const summarize = (name: string): ServiceSummary | null => {
    const service = statusByService.get(name);
    if (!service) {
      return null;
    }
    return {
      state: service.State,
      health: service.Health ?? null,
    };
  };

  const apiOk = await checkApi();
  const rpcOk = await checkRpc();
  const counts = await readDbCounts();

  const report = {
    apiOk,
    rpcOk,
    db: counts,
    services: {
      postgres: summarize("postgres"),
      hardhat: summarize("hardhat"),
      api: summarize("api"),
      indexer: summarize("indexer"),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const servicesHealthy =
    report.services.postgres?.health === "healthy" &&
    report.services.hardhat?.health === "healthy" &&
    report.services.api?.health === "healthy" &&
    report.services.indexer?.state === "running";

  if (!apiOk || !rpcOk || !servicesHealthy) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Demo health check failed:", error);
  process.exit(1);
});
