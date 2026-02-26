import express from "express";
import { aggregateHeatmap } from "../../packages/indexer/heatmapAggregate";

const app = express();
const port = Number(process.env.PORT ?? 3001);

const hazards = [
  { latE6: 38500000, lonE6: 35500000, severity: 4, upvotes: 8, downvotes: 1, lastActivityTimestamp: Math.floor(Date.now() / 1000) - 3600 },
  { latE6: 38500200, lonE6: 35500400, severity: 2, upvotes: 4, downvotes: 0, lastActivityTimestamp: Math.floor(Date.now() / 1000) - 7200 }
];

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "crowdpulse-api" });
});

app.get("/api/heatmap", (req, res) => {
  const raw = String(req.query.bbox ?? "");
  const bbox = raw.split(",").map(Number);

  if (bbox.length !== 4 || bbox.some(Number.isNaN)) {
    return res.status(400).json({ error: "Invalid bbox. Expected minLat,minLon,maxLat,maxLon" });
  }

  const [minLat, minLon, maxLat, maxLon] = bbox;
  const minLatE6 = Math.floor(minLat * 1e6);
  const minLonE6 = Math.floor(minLon * 1e6);
  const maxLatE6 = Math.ceil(maxLat * 1e6);
  const maxLonE6 = Math.ceil(maxLon * 1e6);

  const filtered = hazards.filter(
    (h) => h.latE6 >= minLatE6 && h.latE6 <= maxLatE6 && h.lonE6 >= minLonE6 && h.lonE6 <= maxLonE6
  );

  const heatmap = aggregateHeatmap(filtered);
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
