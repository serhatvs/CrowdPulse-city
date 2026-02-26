// Heatmap aggregation function for CityPulse
// Groups hazards into 100m grid cells and calculates average risk per cell

import { calculateRiskScore } from "./riskScore";

// E6 format koordinatları 100m grid hücreye dönüştürür
function gridCell(latE6, lonE6) {
  // Yaklaşık 1 derece = 111km, 100m grid için ölçek: 0.0009 derece
  // E6 formatında: 100m grid = 90,000 birim
  return {
    lat: Math.floor(latE6 / 90000),
    lon: Math.floor(lonE6 / 90000)
  };
}

/**
 * @param {Array} hazards - [{ latE6, lonE6, severity, votes, lastActivityTimestamp }]
 * @returns {Object} heatmap - { "lat_lon": { avgRisk, count } }
 */
export function aggregateHeatmap(hazards) {
  export { aggregateHeatmap as getHeatmapData };
  const grid = {};
  for (const h of hazards) {
    const cell = gridCell(h.latE6, h.lonE6);
    const key = `${cell.lat}_${cell.lon}`;
    const risk = calculateRiskScore({
      severity: h.severity,
      votes: h.votes || [],
      lastActivityTimestamp: h.lastActivityTimestamp
    });
    if (!grid[key]) {
      grid[key] = { totalRisk: 0, count: 0 };
    }
    grid[key].totalRisk += risk;
    grid[key].count++;
  }
  // Ortalama risk hesapla
  const heatmap = {};
  for (const key in grid) {
    heatmap[key] = {
      avgRisk: Math.round(grid[key].totalRisk / grid[key].count),
      count: grid[key].count
    };
  }
  return heatmap;
}

// Örnek kullanım:
// const heatmap = aggregateHeatmap(hazards);
// heatmap["428_395"] => { avgRisk: 42, count: 3 }
