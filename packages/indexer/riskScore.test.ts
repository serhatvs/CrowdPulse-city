import { calculateRiskScore } from "./riskScore";

describe("calculateRiskScore", () => {
  it("sıfır oy ile risk 0 olmalı", () => {
    expect(calculateRiskScore({ severity: 3, votes: [], lastActivityTimestamp: Date.now()/1000 })).toBe(0);
  });
  it('yüksek severity + çok upvote → yüksek risk', () => {
    const now = Date.now() / 1000;
    const score = calculateRiskScore({
      severity: 5,
      votes: Array(10).fill({ value: 1, created_at: now, trust: 1 }),
      lastActivityTimestamp: now
    });
    expect(score).toBeGreaterThan(50);
  });

  it('72 saatten eski oylar düşük ağırlık almalı', () => {
    const old = Date.now() / 1000 - 72 * 3600;
    const fresh = Date.now() / 1000;
    const s1 = calculateRiskScore({ severity:3, votes:[{value:1,created_at:old,trust:1}], lastActivityTimestamp:old });
    const s2 = calculateRiskScore({ severity:3, votes:[{value:1,created_at:fresh,trust:1}], lastActivityTimestamp:fresh });
    expect(s2).toBeGreaterThan(s1);
  });
});
