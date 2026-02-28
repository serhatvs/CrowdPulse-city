import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { ethers } from "ethers";
import { LRUCache } from "lru-cache";
import { closeHazardOnChain, reportHazardOnChain, voteHazardOnChain } from "./blockchain";
import { listRecentEvents, logEvent } from "./auditLog";
import { calculateRiskScore } from "../../packages/indexer/riskScore";
import {
  closeHazard,
  createHazard,
  findRecentDuplicate,
  getHazardById,
  getHazardVoteTotals,
  getHazardsInBbox,
  voteHazard,
} from "./db";
import { aggregateHeatmap } from "../../packages/indexer/heatmapAggregate";

const MAX_BBOX_AREA = 0.5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;
const GRID_SIZE_E6 = Number(process.env.HEATMAP_GRID_SIZE_E6 ?? 900);
const AUTH_NONCE_TTL_SECONDS = 5 * 60;
const AUTH_TOKEN_TTL_SECONDS = 60 * 60;
const HAZARD_CLOSE_MIN_VOTES = (() => {
  const parsed = Number(process.env.HAZARD_CLOSE_MIN_VOTES ?? 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }
  return Math.max(1, Math.floor(parsed));
})();
const REQUIRE_SIGNATURE_AUTH = String(process.env.REQUIRE_SIGNATURE_AUTH ?? "true").toLowerCase() === "true";
const ENABLE_ONCHAIN_MUTATIONS = String(process.env.ENABLE_ONCHAIN_MUTATIONS ?? "false").toLowerCase() === "true";
const CORS_ORIGINS = String(process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173");

const allowedOrigins = CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes("*");

const rateLimitMap = new LRUCache<string, { count: number; last: number }>({
  max: 10_000,
  ttl: RATE_LIMIT_WINDOW_SECONDS * 1000,
});
const walletNonceMap = new LRUCache<string, string>({
  max: 20_000,
  ttl: AUTH_NONCE_TTL_SECONDS * 1000,
});
const walletSessionMap = new LRUCache<string, string>({
  max: 50_000,
  ttl: AUTH_TOKEN_TTL_SECONDS * 1000,
});

function buildAuthMessage(address: string, nonce: string): string {
  return `CrowdPulse authentication\nAddress: ${address}\nNonce: ${nonce}`;
}

function parseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePositiveNumber(raw: unknown): number | null {
  if (raw == null) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

type Bbox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

type HazardView = {
  id: number;
  lat: number;
  lon: number;
  type: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
  category: number;
  severity: number;
  closed: boolean;
  chainHazardId: number | null;
  upVotes: number;
  downVotes: number;
  totalVotes: number;
  netVotes: number;
  risk: number;
  lastActivityTimestamp: number;
};

type ParsedHazardFilters = {
  bbox: Bbox;
  category?: number;
  minRisk: number;
  maxRisk: number;
  timeWindowHours: number;
  includeClosed: boolean;
};

function parseBoolean(raw: unknown): boolean | null {
  if (raw == null) {
    return null;
  }
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(value)) {
    return false;
  }
  return null;
}

function parseBbox(raw: unknown): Bbox | null {
  const parts = String(raw ?? "")
    .split(",")
    .map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return null;
  }
  const [minLat, minLon, maxLat, maxLon] = parts;
  if (minLat >= maxLat || minLon >= maxLon) {
    return null;
  }
  return { minLat, minLon, maxLat, maxLon };
}

function areaOfBbox(bbox: Bbox): number {
  return Math.abs((bbox.maxLat - bbox.minLat) * (bbox.maxLon - bbox.minLon));
}

function hazardLastActivity(hazard: { created_at: string; lastActivityTimestamp?: number }): number {
  const createdAtTs = Math.floor(new Date(hazard.created_at).getTime() / 1000);
  return hazard.lastActivityTimestamp ?? createdAtTs;
}

function mapHazardForView(hazard: {
  id: number;
  latE6: number;
  lonE6: number;
  type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  category: number;
  severity: number;
  closed: boolean;
  chain_hazard_id: number | null;
  votes?: Array<{ value: number; created_at: number; voter: string; trust: number }>;
  lastActivityTimestamp?: number;
}): HazardView {
  const votes = hazard.votes ?? [];
  const upVotes = votes.filter((vote) => vote.value > 0).length;
  const downVotes = votes.filter((vote) => vote.value < 0).length;
  const totalVotes = votes.length;
  const netVotes = votes.reduce((sum, vote) => sum + vote.value, 0);
  const lastActivityTimestamp = hazardLastActivity(hazard);
  const risk = calculateRiskScore({
    severity: hazard.severity,
    votes,
    lastActivityTimestamp,
  });

  return {
    id: hazard.id,
    lat: hazard.latE6 / 1e6,
    lon: hazard.lonE6 / 1e6,
    type: hazard.type,
    description: hazard.description,
    createdAt: hazard.created_at,
    createdBy: hazard.created_by,
    category: hazard.category,
    severity: hazard.severity,
    closed: hazard.closed,
    chainHazardId: hazard.chain_hazard_id,
    upVotes,
    downVotes,
    totalVotes,
    netVotes,
    risk,
    lastActivityTimestamp,
  };
}

function parseHazardFilters(query: Record<string, unknown>): { value?: ParsedHazardFilters; error?: string } {
  const bbox = parseBbox(query.bbox);
  if (!bbox) {
    return { error: "Invalid bbox. Expected minLat,minLon,maxLat,maxLon." };
  }

  const categoryRaw = parsePositiveNumber(query.category);
  const minRiskRaw = parsePositiveNumber(query.minRisk);
  const maxRiskRaw = parsePositiveNumber(query.maxRisk);
  const timeWindowHoursRaw = parsePositiveNumber(query.timeWindow);
  const includeClosedRaw = parseBoolean(query.includeClosed);

  if (categoryRaw == null && query.category != null) {
    return { error: "Invalid category query." };
  }
  if (minRiskRaw == null && query.minRisk != null) {
    return { error: "Invalid minRisk query." };
  }
  if (maxRiskRaw == null && query.maxRisk != null) {
    return { error: "Invalid maxRisk query." };
  }
  if (timeWindowHoursRaw == null && query.timeWindow != null) {
    return { error: "Invalid timeWindow query." };
  }
  if (includeClosedRaw == null && query.includeClosed != null) {
    return { error: "Invalid includeClosed query. Use true/false." };
  }

  const category = categoryRaw && categoryRaw > 0 ? Math.floor(categoryRaw) : undefined;
  const minRisk = minRiskRaw ?? 0;
  const maxRisk = maxRiskRaw ?? 100;
  const timeWindowHours = timeWindowHoursRaw ?? 0;
  const includeClosed = includeClosedRaw ?? true;

  if (minRisk > maxRisk) {
    return { error: "minRisk cannot be greater than maxRisk." };
  }

  return {
    value: { bbox, category, minRisk, maxRisk, timeWindowHours, includeClosed },
  };
}

function extractHazardId(receipt: unknown): number | null {
  const logs = (receipt as { logs?: Array<Record<string, unknown>> } | null)?.logs ?? [];
  const reportedLog = logs.find((log) => {
    const fragment = log.fragment as { name?: string } | undefined;
    return fragment?.name === "HazardReported";
  });
  const rawId = reportedLog?.args && (reportedLog.args as Record<string, unknown>).hazardId;
  if (rawId == null) {
    return null;
  }
  const id = Number(rawId);
  return Number.isFinite(id) ? id : null;
}

async function duplicateHazardCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { lat, lon, type } = req.body ?? {};
  if (typeof lat !== "number" || typeof lon !== "number" || typeof type !== "string") {
    next();
    return;
  }
  try {
    const isDuplicate = await findRecentDuplicate(lat, lon, type);
    if (isDuplicate) {
      res.status(409).json({ error: "Duplicate hazard detected in the last hour." });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Failed duplicate check.", details: parseErrorMessage(error) });
  }
}

function bboxLimitCheck(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" || !["/api/heatmap", "/api/hazards", "/api/stats"].includes(req.path)) {
    next();
    return;
  }

  const bbox = parseBbox(req.query.bbox);
  if (bbox && areaOfBbox(bbox) > MAX_BBOX_AREA) {
    res.status(413).json({ error: "Requested bbox too large." });
    return;
  }
  next();
}

function walletAuth(req: Request, res: Response, next: NextFunction): void {
  const address = req.headers["x-wallet-address"];
  if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(401).json({ error: "Valid wallet address required in x-wallet-address header." });
    return;
  }

  const walletAddress = address.toLowerCase();
  req.walletAddress = walletAddress;

  if (REQUIRE_SIGNATURE_AUTH) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Bearer token required. Use /api/auth/nonce and /api/auth/verify first." });
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Invalid bearer token." });
      return;
    }

    const sessionAddress = walletSessionMap.get(token);
    if (!sessionAddress || sessionAddress !== walletAddress) {
      res.status(401).json({ error: "Session invalid or expired. Re-authenticate wallet signature." });
      return;
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const rateLimit = rateLimitMap.get(walletAddress);
  const nextState =
    !rateLimit || now - rateLimit.last > RATE_LIMIT_WINDOW_SECONDS
      ? { count: 1, last: now }
      : { count: rateLimit.count + 1, last: now };

  if (nextState.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  rateLimitMap.set(walletAddress, nextState);
  next();
}

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(bboxLimitCheck);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "crowdpulse-api" });
  });

  app.get("/api/auth/nonce", (req: Request, res: Response) => {
    const rawAddress = req.query.address;
    const address = typeof rawAddress === "string" ? rawAddress.toLowerCase() : "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: "Valid address query param is required." });
      return;
    }

    const nonce = randomBytes(16).toString("hex");
    walletNonceMap.set(address, nonce);
    res.json({
      address,
      nonce,
      message: buildAuthMessage(address, nonce),
      expiresInSeconds: AUTH_NONCE_TTL_SECONDS,
    });
  });

  app.post("/api/auth/verify", (req: Request, res: Response) => {
    const { address, signature } = req.body ?? {};
    const normalizedAddress = typeof address === "string" ? address.toLowerCase() : "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
      res.status(400).json({ error: "Valid address is required." });
      return;
    }
    if (typeof signature !== "string" || signature.length < 10) {
      res.status(400).json({ error: "Valid signature is required." });
      return;
    }

    const nonce = walletNonceMap.get(normalizedAddress);
    if (!nonce) {
      res.status(400).json({ error: "Nonce expired or not found. Request a new nonce." });
      return;
    }

    try {
      const message = buildAuthMessage(normalizedAddress, nonce);
      const recovered = ethers.verifyMessage(message, signature).toLowerCase();
      if (recovered !== normalizedAddress) {
        res.status(401).json({ error: "Signature does not match address." });
        return;
      }

      walletNonceMap.delete(normalizedAddress);
      const token = randomBytes(24).toString("hex");
      walletSessionMap.set(token, normalizedAddress);
      res.json({ token, tokenType: "Bearer", expiresInSeconds: AUTH_TOKEN_TTL_SECONDS });
    } catch (error) {
      res.status(401).json({ error: "Invalid signature.", details: parseErrorMessage(error) });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (token) {
        walletSessionMap.delete(token);
      }
    }
    res.json({ ok: true });
  });

  app.get("/api/activity", async (req: Request, res: Response) => {
    const limitRaw = parsePositiveNumber(req.query.limit);
    if (limitRaw == null && req.query.limit != null) {
      res.status(400).json({ error: "Invalid limit query." });
      return;
    }

    const limit = limitRaw == null ? 25 : Math.max(1, Math.min(200, Math.floor(limitRaw)));
    try {
      const items = await listRecentEvents(limit);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to load activity log.", details: parseErrorMessage(error) });
    }
  });

  app.get("/api/hazards", async (req: Request, res: Response) => {
    const filters = parseHazardFilters(req.query as Record<string, unknown>);
    if (!filters.value) {
      res.status(400).json({ error: filters.error ?? "Invalid query." });
      return;
    }

    const limitRaw = parsePositiveNumber(req.query.limit);
    if (limitRaw == null && req.query.limit != null) {
      res.status(400).json({ error: "Invalid limit query." });
      return;
    }
    const limit = limitRaw == null ? 100 : Math.max(1, Math.min(200, Math.floor(limitRaw)));

    const sort = typeof req.query.sort === "string" ? req.query.sort : "recent";
    if (!["recent", "risk", "votes"].includes(sort)) {
      res.status(400).json({ error: "Invalid sort query. Use recent|risk|votes." });
      return;
    }

    const { bbox, category, minRisk, maxRisk, timeWindowHours, includeClosed } = filters.value;
    try {
      let hazards = await getHazardsInBbox(
        { minLat: bbox.minLat, minLon: bbox.minLon, maxLat: bbox.maxLat, maxLon: bbox.maxLon },
        { category, includeClosed },
      );

      if (timeWindowHours > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - Math.floor(timeWindowHours * 3600);
        hazards = hazards.filter((hazard) => hazardLastActivity(hazard) >= cutoff);
      }

      let items = hazards
        .map((hazard) => mapHazardForView(hazard))
        .filter((hazard) => hazard.risk >= minRisk && hazard.risk <= maxRisk);

      if (sort === "risk") {
        items = items.sort((a, b) => b.risk - a.risk || b.lastActivityTimestamp - a.lastActivityTimestamp);
      } else if (sort === "votes") {
        items = items.sort((a, b) => b.totalVotes - a.totalVotes || b.lastActivityTimestamp - a.lastActivityTimestamp);
      } else {
        items = items.sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp);
      }

      res.json(items.slice(0, limit));
    } catch (error) {
      res.status(500).json({ error: "Failed to list hazards.", details: parseErrorMessage(error) });
    }
  });

  app.get("/api/stats", async (req: Request, res: Response) => {
    const filters = parseHazardFilters(req.query as Record<string, unknown>);
    if (!filters.value) {
      res.status(400).json({ error: filters.error ?? "Invalid query." });
      return;
    }

    const { bbox, category, minRisk, maxRisk, timeWindowHours, includeClosed } = filters.value;
    try {
      let hazards = await getHazardsInBbox(
        { minLat: bbox.minLat, minLon: bbox.minLon, maxLat: bbox.maxLat, maxLon: bbox.maxLon },
        { category, includeClosed },
      );

      if (timeWindowHours > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - Math.floor(timeWindowHours * 3600);
        hazards = hazards.filter((hazard) => hazardLastActivity(hazard) >= cutoff);
      }

      const items = hazards
        .map((hazard) => mapHazardForView(hazard))
        .filter((hazard) => hazard.risk >= minRisk && hazard.risk <= maxRisk);
      const hazardCount = items.length;
      const openCount = items.filter((hazard) => !hazard.closed).length;
      const closedCount = hazardCount - openCount;
      const totalVotes = items.reduce((sum, hazard) => sum + hazard.totalVotes, 0);
      const avgRisk =
        hazardCount > 0 ? Math.round(items.reduce((sum, hazard) => sum + hazard.risk, 0) / hazardCount) : 0;
      const maxRiskValue = items.reduce((max, hazard) => Math.max(max, hazard.risk), 0);
      const highRiskCount = items.filter((hazard) => hazard.risk >= 70).length;
      const lastActivity = items.reduce((max, hazard) => Math.max(max, hazard.lastActivityTimestamp), 0);

      res.json({
        hazardCount,
        openCount,
        closedCount,
        totalVotes,
        avgRisk,
        maxRisk: maxRiskValue,
        highRiskCount,
        lastActivityTimestamp: lastActivity || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load stats.", details: parseErrorMessage(error) });
    }
  });

  app.post("/api/hazards", walletAuth, duplicateHazardCheck, async (req: Request, res: Response) => {
    const wallet = req.walletAddress;
    if (!wallet) {
      res.status(401).json({ error: "Wallet authentication required." });
      return;
    }

    const { lat, lon, type, description, category, severity, noteURI } = req.body ?? {};
    if (typeof lat !== "number" || typeof lon !== "number") {
      res.status(400).json({ error: "lat and lon must be numbers." });
      return;
    }
    if (!type || typeof type !== "string") {
      res.status(400).json({ error: "type is required." });
      return;
    }
    if (description != null && typeof description !== "string") {
      res.status(400).json({ error: "description must be a string." });
      return;
    }
    if (category != null && (!Number.isInteger(category) || category < 1 || category > 255)) {
      res.status(400).json({ error: "category must be an integer between 1 and 255." });
      return;
    }
    if (severity != null && (!Number.isInteger(severity) || severity < 1 || severity > 5)) {
      res.status(400).json({ error: "severity must be an integer between 1 and 5." });
      return;
    }
    if (noteURI != null && typeof noteURI !== "string") {
      res.status(400).json({ error: "noteURI must be a string." });
      return;
    }

    try {
      let chainHazardId: number | null = null;
      if (ENABLE_ONCHAIN_MUTATIONS && category != null && severity != null && noteURI != null) {
        const receipt = await reportHazardOnChain(
          Math.round(lat * 1e6),
          Math.round(lon * 1e6),
          category,
          severity,
          noteURI,
        );
        chainHazardId = extractHazardId(receipt);
      }

      const hazard = await createHazard({
        lat,
        lon,
        type,
        description,
        created_by: wallet,
        category,
        severity,
        chain_hazard_id: chainHazardId,
      });

      await logEvent("hazard_created", { hazard, wallet });
      res.status(201).json(hazard);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hazard.", details: parseErrorMessage(error) });
    }
  });

  app.post("/api/hazards/:id/vote", walletAuth, async (req: Request, res: Response) => {
    const wallet = req.walletAddress;
    if (!wallet) {
      res.status(401).json({ error: "Wallet authentication required." });
      return;
    }

    const hazardId = Number(req.params.id);
    if (!Number.isInteger(hazardId) || hazardId <= 0) {
      res.status(400).json({ error: "Invalid hazard id." });
      return;
    }

    const { vote } = req.body ?? {};
    if (vote !== "up" && vote !== "down") {
      res.status(400).json({ error: "vote must be 'up' or 'down'." });
      return;
    }

    try {
      const hazard = await getHazardById(hazardId);
      if (!hazard) {
        res.status(404).json({ error: "hazard not found." });
        return;
      }

      const up = vote === "up";
      if (ENABLE_ONCHAIN_MUTATIONS && hazard.chain_hazard_id != null) {
        await voteHazardOnChain(hazard.chain_hazard_id, up);
      }

      const status = await voteHazard(hazardId, wallet, up ? 1 : -1);
      if (status === "not_found") {
        res.status(404).json({ error: "hazard not found." });
        return;
      }
      if (status === "duplicate") {
        res.status(409).json({ error: "duplicate vote detected for this wallet." });
        return;
      }

      await logEvent("hazard_voted", { hazardId, voter: wallet, value: up ? 1 : -1, wallet });
      res.json({ ok: true, hazardId, vote });
    } catch (error) {
      res.status(500).json({ error: "Failed to vote.", details: parseErrorMessage(error) });
    }
  });

  app.post("/api/hazards/:id/close", walletAuth, async (req: Request, res: Response) => {
    const wallet = req.walletAddress;
    if (!wallet) {
      res.status(401).json({ error: "Wallet authentication required." });
      return;
    }

    const hazardId = Number(req.params.id);
    if (!Number.isInteger(hazardId) || hazardId <= 0) {
      res.status(400).json({ error: "Invalid hazard id." });
      return;
    }

    try {
      const hazard = await getHazardById(hazardId);
      if (!hazard) {
        res.status(404).json({ error: "hazard not found." });
        return;
      }
      if (hazard.closed) {
        res.status(409).json({ error: "hazard already closed." });
        return;
      }
      if (!hazard.created_by || hazard.created_by.toLowerCase() !== wallet) {
        res.status(403).json({ error: "Only reporter can close this hazard." });
        return;
      }

      const totals = await getHazardVoteTotals(hazardId);
      if (totals.totalVotes < HAZARD_CLOSE_MIN_VOTES) {
        res.status(409).json({
          error: `Hazard needs at least ${HAZARD_CLOSE_MIN_VOTES} votes before closing.`,
          totalVotes: totals.totalVotes,
        });
        return;
      }

      if (ENABLE_ONCHAIN_MUTATIONS && hazard.chain_hazard_id != null) {
        await closeHazardOnChain(hazard.chain_hazard_id);
      }

      const updated = await closeHazard(hazardId);
      if (!updated) {
        res.status(409).json({ error: "hazard already closed." });
        return;
      }

      await logEvent("hazard_closed", { hazardId, wallet, totals });
      res.json({
        ok: true,
        hazardId,
        totalVotes: totals.totalVotes,
        upVotes: totals.upVotes,
        downVotes: totals.downVotes,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to close hazard.", details: parseErrorMessage(error) });
    }
  });

  app.get("/api/heatmap", async (req: Request, res: Response) => {
    const filters = parseHazardFilters(req.query as Record<string, unknown>);
    if (!filters.value) {
      res.status(400).json({ error: filters.error ?? "Invalid query." });
      return;
    }

    const { bbox, category, minRisk, maxRisk, timeWindowHours, includeClosed } = filters.value;
    try {
      let hazards = await getHazardsInBbox(
        { minLat: bbox.minLat, minLon: bbox.minLon, maxLat: bbox.maxLat, maxLon: bbox.maxLon },
        { category, includeClosed },
      );
      if (timeWindowHours > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - Math.floor(timeWindowHours * 3600);
        hazards = hazards.filter((hazard) => hazardLastActivity(hazard) >= cutoff);
      }

      const heatmap = aggregateHeatmap(hazards);
      const cells = Object.entries(heatmap)
        .map(([key, value]) => {
          const [latGrid, lonGrid] = key.split("_").map(Number);
          return {
            lat: (latGrid * GRID_SIZE_E6) / 1e6,
            lon: (lonGrid * GRID_SIZE_E6) / 1e6,
            risk: value.avgRisk,
            count: value.count,
          };
        })
        .filter((cell) => cell.risk >= minRisk && cell.risk <= maxRisk);

      res.json(cells);
    } catch (error) {
      res.status(500).json({ error: "Failed to get heatmap.", details: parseErrorMessage(error) });
    }
  });

  return app;
}

export const app = createApp();

export function startServer() {
  const port = Number(process.env.PORT ?? 3001);
  return app.listen(port, () => {
    console.log(`CrowdPulse API listening on :${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
