import { logEvent } from "./auditLog";
// Duplicate detection ve bbox limit middleware
const MAX_BBOX_AREA = 0.5; // derece^2, örnek limit
import { createHazard, getHazardsInBbox, voteHazard, pool, findRecentDuplicate } from "./db";

async function duplicateHazardCheck(req, res, next) {
  const { lat, lon, type } = req.body ?? {};
  if (typeof lat !== "number" || typeof lon !== "number" || !type) return next();
  const isDuplicate = await findRecentDuplicate(lat, lon, type);
  if (isDuplicate) {
    return res.status(409).json({ error: "Duplicate hazard detected (last 1 hour)" });
  }
  next();
}

function bboxLimitCheck(req, res, next) {
  if (req.path === "/api/heatmap" && req.method === "GET") {
    const raw = String(req.query.bbox ?? "");
    const bbox = raw.split(",").map(Number);
    if (bbox.length === 4) {
      const area = Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]));
      if (area > MAX_BBOX_AREA) {
        return res.status(413).json({ error: "Requested bbox too large" });
      }
    }
  }
  next();
}
// Basit wallet address auth ve rate limit middleware

import LRU from 'lru-cache';
const RATE_LIMIT_WINDOW = 60; // saniye
const RATE_LIMIT_MAX = 10; // 1 dakikada 10 istek
const rateLimitMap = new LRU<string, { count: number; last: number }>({
  max: 10000,
  ttl: RATE_LIMIT_WINDOW * 1000,
});

function walletAuth(req, res, next) {
  const address = req.headers["x-wallet-address"];
  if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(401).json({ error: "Valid wallet address required in x-wallet-address header" });
  }
  req.walletAddress = address.toLowerCase();
  // Rate limit (her adres için ayrı sayaç, window reset)
  const now = Math.floor(Date.now() / 1000);
  let rl = rateLimitMap.get(req.walletAddress);
  if (!rl || now - rl.last > RATE_LIMIT_WINDOW) {
    rl = { count: 1, last: now };
  } else {
    rl.count++;
  }
  rl.last = now;
  if (rl.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  rateLimitMap.set(req.walletAddress, rl);
  next();
}
import express from "express";
import { aggregateHeatmap } from "../../packages/indexer/heatmapAggregate";
// ...
import { reportHazardOnChain, voteHazardOnChain } from "./blockchain";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());
app.use(bboxLimitCheck);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "crowdpulse-api" });
});

app.post("/api/hazards", walletAuth, duplicateHazardCheck, async (req, res) => {
  const { lat, lon, type, description, created_by, category, severity, noteURI } = req.body ?? {};

  if (typeof lat !== "number" || typeof lon !== "number") {
    return res.status(400).json({ error: "lat and lon must be numbers" });
  }
  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "type is required" });
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }
  try {
    // Zincire yaz
    let chainId = null;
    if (category !== undefined && severity !== undefined && noteURI !== undefined) {
      const receipt = await reportHazardOnChain(Math.round(lat * 1e6), Math.round(lon * 1e6), category, severity, noteURI);
      chainId = receipt?.logs?.[0]?.args?.hazardId ?? null;
    }
    const hazard = await createHazard({ lat, lon, type, description, created_by, category, severity });
    if (chainId && hazard?.id) {
      await pool.query('UPDATE hazards SET chain_hazard_id=$1 WHERE id=$2', [chainId, hazard.id]);
    }
    await logEvent("hazard_created", { hazard, wallet: req.walletAddress });
    return res.status(201).json(hazard);
  } catch (e) {
    return res.status(500).json({ error: "Failed to create hazard", details: e.message });
  }
});

app.post("/api/hazards/:id/vote", walletAuth, async (req, res) => {
  const { id } = req.params;
  const { vote, voter, up } = req.body ?? {};
  if (vote !== "up" && vote !== "down") {
    return res.status(400).json({ error: "vote must be 'up' or 'down'" });
  }
  if (!voter || typeof voter !== "string") {
    return res.status(400).json({ error: "voter is required" });
  }
  const value = vote === "up" ? 1 : -1;
  try {
    // Zincire yaz
    if (typeof up === "boolean") {
      await voteHazardOnChain(Number(id), up);
    }
    const result = await voteHazard(Number(id), voter, value);
    if (!result) {
      return res.status(404).json({ error: "hazard not found" });
    }
    await logEvent("hazard_voted", { hazardId: id, voter, value, wallet: req.walletAddress });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: "Failed to vote", details: e.message });
  }
});

app.get("/api/heatmap", async (req, res) => {
  const raw = String(req.query.bbox ?? "");
  const bbox = raw.split(",").map(Number);
  if (bbox.length !== 4 || bbox.some(Number.isNaN)) {
    return res.status(400).json({ error: "Invalid bbox. Expected minLat,minLon,maxLat,maxLon" });
  }
  const [minLat, minLon, maxLat, maxLon] = bbox;
  try {
    const hazards = await getHazardsInBbox({ minLat, minLon, maxLat, maxLon });
    const heatmap = aggregateHeatmap(hazards);
    const cells = Object.entries(heatmap).map(([key, val]) => {
      const [latGrid, lonGrid] = key.split("_").map(Number);
      return {
        lat: latGrid * 0.09,
        lon: lonGrid * 0.09,
        risk: val.avgRisk,
        count: val.count
      };
    });
    return res.json(cells);
  } catch (e) {
    return res.status(500).json({ error: "Failed to get heatmap", details: e.message });
  }
});

app.listen(port, () => {
  console.log(`CrowdPulse API listening on :${port}`);
});
