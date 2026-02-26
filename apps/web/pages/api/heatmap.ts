// Next.js API Route örneği (taşınacak kod)
import type { NextApiRequest, NextApiResponse } from "next";
import { aggregateHeatmap } from "../../../packages/indexer/heatmapAggregate";
import { getHazardsInBbox } from "../../../apps/api/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const raw = String(req.query.bbox ?? "");
  const bbox = raw.split(",").map(Number);
  if (
    bbox.length !== 4 ||
    bbox.some(Number.isNaN) ||
    bbox[0] >= bbox[2] || bbox[1] >= bbox[3] ||
    Math.abs(bbox[2] - bbox[0]) > 2 || Math.abs(bbox[3] - bbox[1]) > 2
  ) {
    return res.status(400).json({ error: "Invalid bbox. Expected minLat,minLon,maxLat,maxLon and area < 2x2" });
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
}
