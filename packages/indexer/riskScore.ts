// Risk scoring module for CityPulse
// Severity: 1-5
// Evidence: log weighted votes
// Freshness: exponential decay (72h half-life)

export function calculateRiskScore({
  severity,
  upvotes,
  downvotes,
  lastActivityTimestamp
}) {
  // Normalize severity
  const sev = Math.max(1, Math.min(5, severity));

  // Evidence: log2(upvotes + 1) - log2(downvotes + 1)
  const evidence = Math.log2(upvotes + 1) - Math.log2(downvotes + 1);
  // Clamp evidence to [0, 5]
  const evidenceNorm = Math.max(0, Math.min(5, evidence));

  // Freshness: exponential decay
  const now = Date.now() / 1000; // seconds
  const dt = now - lastActivityTimestamp;
  const halfLife = 72 * 3600; // 72 saat
  const freshness = Math.exp(-dt * Math.LN2 / halfLife);

  // Risk score: combine
  // Risk = severity * evidenceNorm * freshness
  let risk = sev * evidenceNorm * freshness;

  // Normalize to 0-100
  risk = Math.max(0, Math.min(100, Math.round(risk * 4)));

  return risk;
}

// Örnek kullanım:
// const score = calculateRiskScore({ severity: 3, upvotes: 10, downvotes: 2, lastActivityTimestamp: 1700000000 });
