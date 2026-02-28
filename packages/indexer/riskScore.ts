export type RiskVote = {
  value: number;
  created_at: number;
  voter?: string;
  trust?: number;
};

type RiskScoreInput = {
  severity: number;
  votes: RiskVote[];
  lastActivityTimestamp?: number | null;
};

export function calculateRiskScore(input: RiskScoreInput): number {
  const severity = Number(input.severity);
  if (!Number.isFinite(severity) || severity <= 0) {
    return 0;
  }

  const sev = Math.min(5, Math.max(1, severity));
  const votes = Array.isArray(input.votes) ? input.votes : [];
  if (votes.length === 0) {
    return 0;
  }

  const now = Date.now() / 1000;
  const voteHalfLifeSeconds = 72 * 3600;

  let weightedNet = 0;
  for (const vote of votes) {
    const createdAt = Number(vote.created_at);
    if (!Number.isFinite(createdAt)) {
      continue;
    }

    const dt = Math.max(0, now - createdAt);
    const ageWeight = Math.exp((-dt * Math.LN2) / voteHalfLifeSeconds);
    const trust = typeof vote.trust === "number" ? Math.max(0, vote.trust) : 1;
    weightedNet += Number(vote.value) * ageWeight * trust;
  }

  if (weightedNet === 0) {
    return 0;
  }

  const evidence = Math.log2(Math.abs(weightedNet) + 1) * Math.sign(weightedNet);
  const evidenceNorm = Math.max(-5, Math.min(5, evidence));

  let risk = sev * evidenceNorm;
  if (input.lastActivityTimestamp != null) {
    const lastActivity = Number(input.lastActivityTimestamp);
    if (Number.isFinite(lastActivity)) {
      const inactivityDays = Math.max(0, (now - lastActivity) / 86400);
      const freshness = Math.exp((-inactivityDays * Math.LN2) / 7);
      risk *= freshness;
    }
  }

  return Math.max(0, Math.min(100, Math.round(Math.abs(risk) * 4)));
}
