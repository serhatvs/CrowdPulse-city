import { calculateRiskScore } from "./riskScore";

describe("calculateRiskScore", () => {
  it("sıfır oy ile risk 0 olmalı", () => {
    expect(calculateRiskScore({ severity: 3, votes: [], lastActivityTimestamp: Date.now()/1000 })).toBe(0);
  });
});
