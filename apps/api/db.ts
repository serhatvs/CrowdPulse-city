import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type HazardRecord = {
  id: string;
  latE6: number;
  lonE6: number;
  severity: number;
  upvotes: number;
  downvotes: number;
  description: string | null;
  createdAt: number;
  lastActivityTimestamp: number;
};

type DbShape = {
  hazards: HazardRecord[];
};

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.API_DB_PATH
  ? path.resolve(process.cwd(), process.env.API_DB_PATH)
  : path.join(dataDir, "crowdpulse-db.json");

function loadDb(): DbShape {
  if (!fs.existsSync(dbPath)) {
    return { hazards: [] };
  }

  const raw = fs.readFileSync(dbPath, "utf8");
  try {
    const parsed = JSON.parse(raw) as DbShape;
    if (!Array.isArray(parsed.hazards)) {
      return { hazards: [] };
    }
    return parsed;
  } catch {
    return { hazards: [] };
  }
}

function saveDb(data: DbShape): void {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export function createHazard(input: { lat: number; lon: number; severity: number; description?: string | null }): HazardRecord {
  const db = loadDb();
  const now = Math.floor(Date.now() / 1000);

  const hazard: HazardRecord = {
    id: crypto.randomUUID(),
    latE6: Math.round(input.lat * 1e6),
    lonE6: Math.round(input.lon * 1e6),
    severity: input.severity,
    upvotes: 0,
    downvotes: 0,
    description: input.description ?? null,
    createdAt: now,
    lastActivityTimestamp: now
  };

  db.hazards.push(hazard);
  saveDb(db);
  return hazard;
}

export function voteHazard(hazardId: string, vote: "up" | "down"): HazardRecord | null {
  const db = loadDb();
  const hazard = db.hazards.find((h) => h.id === hazardId);

  if (!hazard) {
    return null;
  }

  if (vote === "up") {
    hazard.upvotes += 1;
  } else {
    hazard.downvotes += 1;
  }

  hazard.lastActivityTimestamp = Math.floor(Date.now() / 1000);
  saveDb(db);

  return hazard;
}

export function getHazardsInBbox(bounds: {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}): HazardRecord[] {
  const db = loadDb();
  const minLatE6 = Math.floor(bounds.minLat * 1e6);
  const minLonE6 = Math.floor(bounds.minLon * 1e6);
  const maxLatE6 = Math.ceil(bounds.maxLat * 1e6);
  const maxLonE6 = Math.ceil(bounds.maxLon * 1e6);

  return db.hazards.filter(
    (h) => h.latE6 >= minLatE6 && h.latE6 <= maxLatE6 && h.lonE6 >= minLonE6 && h.lonE6 <= maxLonE6
  );
}
