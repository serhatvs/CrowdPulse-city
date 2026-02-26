// Risk scoring module for CityPulse
// Severity: 1-5
// Evidence: log weighted votes
// Freshness: exponential decay (72h half-life)


// Trust score: 0-1 arası, kullanıcıya göre
// votes: [{ value: 1|-1, created_at: timestamp, voter: string, trust: 0-1 }]
export function calculateRiskScore({
  severity,
  votes,
  lastActivityTimestamp
}) {
  // Normalize severity
  const sev = Math.max(1, Math.min(5, severity));

  // Vote aging ve trust ağırlığı
  const now = Date.now() / 1000; // seconds
  const halfLife = 72 * 3600; // 72 saat
  let weightedSum = 0;
  let weightTotal = 0;
  for (const v of votes) {
    const dt = now - v.created_at;
    const ageWeight = Math.exp(-dt * Math.LN2 / halfLife); // taze oy daha değerli
    const trust = typeof v.trust === 'number' ? v.trust : 1; // default 1
    const w = ageWeight * trust;
    weightedSum += v.value * w;
    weightTotal += w;
  }
  // Kanıt: ağırlıklı oy toplamı (log ölçekli)
  const evidence = weightTotal > 0 ? Math.max(0, Math.log2(Math.abs(weightedSum) + 1)) * Math.sign(weightedSum) : 0;
  // Clamp evidence to [-5, 5]
  const evidenceNorm = Math.max(-5, Math.min(5, evidence));

  // Risk score: combine
  // Risk = severity * |evidenceNorm| * sign(evidenceNorm)
  let risk = sev * evidenceNorm;

  // Freshness: lastActivityTimestamp ile ek faktör
  if (lastActivityTimestamp) {
    const inactivityDays = (now - lastActivityTimestamp) / 86400;
    const freshnessFactor = Math.exp(-inactivityDays * Math.LN2 / 7); // 7 gün half-life
    risk = risk * freshnessFactor;
  }

  // Normalize to 0-100
  risk = Math.max(0, Math.min(100, Math.round(Math.abs(risk) * 4)));

  return risk;
}

// Örnek kullanım:
// const score = calculateRiskScore({ severity: 3, upvotes: 10, downvotes: 2, lastActivityTimestamp: 1700000000 });
