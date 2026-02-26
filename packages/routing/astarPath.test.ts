import { astarPath } from "./astarPath";

describe("astarPath", () => {
  it("engel olmayan düz gridde en kısa yol", () => {
    const grid = [
      [{ risk: 0 }, { risk: 0 }, { risk: 0 }],
      [{ risk: 0 }, { risk: 0 }, { risk: 0 }],
    ];
    const path = astarPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path.length).toBe(3);
  });
});
