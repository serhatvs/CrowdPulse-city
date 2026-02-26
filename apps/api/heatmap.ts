// API route: /api/heatmap?bbox=minLat,minLon,maxLat,maxLon
import type { NextApiRequest, NextApiResponse } from "next";
import { getHeatmapData } from "../../packages/indexer/heatmapAggregate";

// Örnek veri kaynağı (DB veya indexer'dan çekilebilir)
const hazards = [
  // { latE6, lonE6, severity, upvotes, downvotes, lastActivityTimestamp }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const bbox = req.query.bbox?.split(",").map(Number);
  if (!bbox || bbox.length !== 4) {
    return res.status(400).json({ error: "Invalid bbox" });
  }
  const [minLat, minLon, maxLat, maxLon] = bbox;

  // E6 formatı için çevir
  const minLatE6 = Math.floor(minLat * 1e6);
  const minLonE6 = Math.floor(minLon * 1e6);
  const maxLatE6 = Math.ceil(maxLat * 1e6);
  const maxLonE6 = Math.ceil(maxLon * 1e6);

  // Bbox içindeki hazardları filtrele
  const filtered = hazards.filter(h =>
    h.latE6 >= minLatE6 && h.latE6 <= maxLatE6 &&
    h.lonE6 >= minLonE6 && h.lonE6 <= maxLonE6
  );

  // Heatmap aggregation
  const heatmap = getHeatmapData(filtered); // aggregateHeatmap fonksiyonunu kullan

  // Heatmap hücrelerini [{lat, lon, risk}] formatına dönüştür
  const cells = Object.entries(heatmap).map(([key, val]) => {
    const [latGrid, lonGrid] = key.split("_").map(Number);
    return {
      lat: latGrid * 0.09, // 100m grid için yaklaşık
      lon: lonGrid * 0.09,
      risk: val.avgRisk
    };
  });

  res.json(cells);
}
