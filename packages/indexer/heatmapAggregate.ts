import { calculateRiskScore, type RiskVote } from "./riskScore";

type HazardForHeatmap = {
  latE6: number;
  lonE6: number;
  severity: number;
  votes?: RiskVote[];
  lastActivityTimestamp?: number | null;
};

type HeatCell = {
  avgRisk: number;
  count: number;
};

export type HeatmapAggregate = Record<string, HeatCell>;

const rawGridSize = Number(process.env.HEATMAP_GRID_SIZE_E6 ?? 900);
const GRID_SIZE_E6 = Number.isFinite(rawGridSize) && rawGridSize > 0 ? rawGridSize : 900;

function gridCell(latE6: number, lonE6: number): { lat: number; lon: number } {
  return {
    lat: Math.floor(latE6 / GRID_SIZE_E6),
    lon: Math.floor(lonE6 / GRID_SIZE_E6),
  };
}

export function aggregateHeatmap(hazards: HazardForHeatmap[]): HeatmapAggregate {
  const grid: Record<string, { totalRisk: number; count: number }> = {};

  for (const hazard of hazards) {
    const cell = gridCell(hazard.latE6, hazard.lonE6);
    const key = `${cell.lat}_${cell.lon}`;
    const risk = calculateRiskScore({
      severity: hazard.severity,
      votes: hazard.votes ?? [],
      lastActivityTimestamp: hazard.lastActivityTimestamp ?? null,
    });

    if (!grid[key]) {
      grid[key] = { totalRisk: 0, count: 0 };
    }

    grid[key].totalRisk += risk;
    grid[key].count += 1;
  }

  const heatmap: HeatmapAggregate = {};
  for (const [key, value] of Object.entries(grid)) {
    heatmap[key] = {
      avgRisk: Math.round(value.totalRisk / value.count),
      count: value.count,
    };
  }

  return heatmap;
}

export { aggregateHeatmap as getHeatmapData };
