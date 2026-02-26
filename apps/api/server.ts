import express from "express";
import { aggregateHeatmap } from "../../packages/indexer/heatmapAggregate";
import { createHazard, getHazardsInBbox, voteHazard } from "./db";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "crowdpulse-api" });
});

app.post("/api/hazards", (req, res) => {
  const { lat, lon, severity, description } = req.body ?? {};

  if (typeof lat !== "number" || typeof lon !== "number") {
    return res.status(400).json({ error: "lat and lon must be numbers" });
  }

  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    return res.status(400).json({ error: "severity must be an integer between 1 and 5" });
  }

  if (description !== undefined && description !== null && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }

  const hazard = createHazard({ lat, lon, severity, description });
  return res.status(201).json(hazard);
});

app.post("/api/hazards/:id/vote", (req, res) => {
  const { id } = req.params;
  const { vote } = req.body ?? {};

  if (vote !== "up" && vote !== "down") {
    return res.status(400).json({ error: "vote must be 'up' or 'down'" });
  }

  const updated = voteHazard(id, vote);
  if (!updated) {
    return res.status(404).json({ error: "hazard not found" });
  }

  return res.json({
    id: updated.id,
    upvotes: updated.upvotes,
    downvotes: updated.downvotes,
    lastActivityTimestamp: updated.lastActivityTimestamp
  });
});

app.get("/api/heatmap", (req, res) => {
  const raw = String(req.query.bbox ?? "");
  const bbox = raw.split(",").map(Number);

  if (bbox.length !== 4 || bbox.some(Number.isNaN)) {
    return res.status(400).json({ error: "Invalid bbox. Expected minLat,minLon,maxLat,maxLon" });
  }

  const [minLat, minLon, maxLat, maxLon] = bbox;

  const hazards = getHazardsInBbox({ minLat, minLon, maxLat, maxLon });
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
});

app.listen(port, () => {
  console.log(`CrowdPulse API listening on :${port}`);
});
