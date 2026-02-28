type Cell = { risk: number; hasRamp?: boolean; hasStairs?: boolean };
type Point = { x: number; y: number };
type Options = { riskThreshold?: number; wheelchairMode?: boolean };

type QueueNode = Point & { g: number; f: number; parent: QueueNode | null };

class MinHeap {
  private items: QueueNode[] = [];

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(node: QueueNode): void {
    this.items.push(node);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): QueueNode | null {
    if (this.items.length === 0) {
      return null;
    }
    const min = this.items[0];
    const last = this.items.pop() as QueueNode;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.items[parent].f <= this.items[current].f) {
        break;
      }
      [this.items[parent], this.items[current]] = [this.items[current], this.items[parent]];
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    const size = this.items.length;
    while (true) {
      let smallest = current;
      const left = current * 2 + 1;
      const right = current * 2 + 2;

      if (left < size && this.items[left].f < this.items[smallest].f) {
        smallest = left;
      }
      if (right < size && this.items[right].f < this.items[smallest].f) {
        smallest = right;
      }
      if (smallest === current) {
        return;
      }

      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

export function astarPath(grid: Cell[][], start: Point, end: Point, options: Options = {}): Point[] {
  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    return [];
  }

  const riskThreshold = options.riskThreshold ?? 50;
  const wheelchairMode = options.wheelchairMode ?? false;
  const rows = grid.length;
  const cols = grid[0].length;

  if (
    start.x < 0 ||
    start.x >= cols ||
    start.y < 0 ||
    start.y >= rows ||
    end.x < 0 ||
    end.x >= cols ||
    end.y < 0 ||
    end.y >= rows
  ) {
    return [];
  }

  function heuristic(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function getNeighbors(node: Point): Point[] {
    const neighbors: Point[] = [];
    const dirs = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    return neighbors;
  }

  function cellCost(cell: Cell): number {
    if (cell.risk > riskThreshold) {
      return Number.POSITIVE_INFINITY;
    }

    let cost = 1 + cell.risk / 20;
    if (wheelchairMode) {
      if (cell.hasRamp) {
        cost -= 0.5;
      }
      if (cell.hasStairs) {
        cost += 10;
      }
    }
    return Math.max(0.1, cost);
  }

  const openSet = new MinHeap();
  openSet.push({ ...start, g: 0, f: heuristic(start, end), parent: null });

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const gScore = Array.from({ length: rows }, () => Array(cols).fill(Number.POSITIVE_INFINITY));
  gScore[start.y][start.x] = 0;

  while (!openSet.isEmpty()) {
    const current = openSet.pop();
    if (!current) {
      break;
    }

    if (current.x === end.x && current.y === end.y) {
      const path: Point[] = [];
      let node: QueueNode | null = current;
      while (node) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path.reverse();
    }

    if (visited[current.y][current.x]) {
      continue;
    }
    visited[current.y][current.x] = true;

    for (const neighbor of getNeighbors(current)) {
      if (visited[neighbor.y][neighbor.x]) {
        continue;
      }

      const cost = cellCost(grid[neighbor.y][neighbor.x]);
      if (!Number.isFinite(cost)) {
        continue;
      }

      const g = current.g + cost;
      if (g >= gScore[neighbor.y][neighbor.x]) {
        continue;
      }

      gScore[neighbor.y][neighbor.x] = g;
      const f = g + heuristic(neighbor, end);
      openSet.push({ ...neighbor, g, f, parent: current });
    }
  }

  return [];
}
