// A* pathfinding for CityPulse grid with risk avoidance and wheelchair mode

/**
 * @param {Array} grid - 2D array [{ risk, hasRamp, hasStairs }]
 * @param {Object} start - { x, y }
 * @param {Object} end - { x, y }
 * @param {Object} options - { riskThreshold, wheelchairMode }
 * @returns {Array} path - [{ x, y }]
 */
import { MinPriorityQueue } from '@datastructures-js/priority-queue';


  // Guard: grid boş veya satır yoksa
  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    return [];
  }

  const riskThreshold = options.riskThreshold ?? 50;
  const wheelchairMode = options.wheelchairMode ?? false;

  const rows = grid.length;
  const cols = grid[0].length;

  // Guard: start/end out-of-bounds
  if (
    start.x < 0 || start.x >= cols || start.y < 0 || start.y >= rows ||
    end.x < 0 || end.x >= cols || end.y < 0 || end.y >= rows
  ) {
    return [];
  }

  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function getNeighbors(node) {
    const dirs = [ [0,1], [1,0], [0,-1], [-1,0] ];
    const neighbors = [];
    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    return neighbors;
  }

  function cellCost(cell) {
    let cost = 1;
    if (cell.risk > riskThreshold) cost += 100;
    if (wheelchairMode) {
      if (cell.hasRamp) cost -= 0.5;
      if (cell.hasStairs) cost += 10;
    }
    cost += cell.risk / 20;
    return Math.max(0.1, cost);
  }

  const openSet = new MinPriorityQueue(node => node.f);
  openSet.enqueue({ ...start, g: 0, f: heuristic(start, end), parent: null });
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  gScore[start.y][start.x] = 0;

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue().element;
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let node = current;
      while (node) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path.reverse();
    }
    visited[current.y][current.x] = true;
    for (const neighbor of getNeighbors(current)) {
      if (visited[neighbor.y][neighbor.x]) continue;
      const cell = grid[neighbor.y][neighbor.x];
      const cost = cellCost(cell);
      const g = current.g + cost;
      if (g >= gScore[neighbor.y][neighbor.x]) continue;
      gScore[neighbor.y][neighbor.x] = g;
      const f = g + heuristic(neighbor, end);
      openSet.enqueue({ ...neighbor, g, f, parent: current });
    }
  }
  return [];
}

// Örnek kullanım:
// const path = astarPath(grid, {x:0,y:0}, {x:10,y:10}, { riskThreshold: 60, wheelchairMode: true });
