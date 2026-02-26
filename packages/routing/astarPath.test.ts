import { astarPath } from "./astarPath";

describe("astarPath", () => {
  it("boş gridde path dönmez", () => {
    expect(astarPath([], { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([]);
  });

  it("start veya end out-of-bounds ise path dönmez", () => {
    const grid = [[{ risk: 0 }]];
    expect(astarPath(grid, { x: -1, y: 0 }, { x: 0, y: 0 })).toEqual([]);
    expect(astarPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it("engel varsa yol bulamaz", () => {
    const grid = [
      [{ risk: 0 }, { risk: 100 }],
      [{ risk: 0 }, { risk: 100 }],
    ];
    // riskThreshold düşükse sağa geçemez
    const path = astarPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, { riskThreshold: 10 });
    expect(path).toEqual([]);
  });

  it("risk threshold ile yol değişir", () => {
    const grid = [
      [{ risk: 0 }, { risk: 100 }],
      [{ risk: 0 }, { risk: 0 }],
    ];
    // riskThreshold yüksekse riskli yoldan geçer
    const path1 = astarPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, { riskThreshold: 200 });
    // riskThreshold düşükse alttan dolaşır
    const path2 = astarPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, { riskThreshold: 10 });
    expect(path1.length).toBe(2);
    expect(path2).toEqual([]);
  });
  it("engel olmayan düz gridde en kısa yol", () => {
    const grid = [
      [{ risk: 0 }, { risk: 0 }, { risk: 0 }],
      [{ risk: 0 }, { risk: 0 }, { risk: 0 }],
    ];
    const path = astarPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path.length).toBe(3);
  });
});
