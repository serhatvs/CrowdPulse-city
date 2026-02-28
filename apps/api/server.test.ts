import { Wallet } from "ethers";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  closeHazard: vi.fn(),
  createHazard: vi.fn(),
  findRecentDuplicate: vi.fn(),
  getHazardById: vi.fn(),
  getHazardVoteTotals: vi.fn(),
  getHazardsInBbox: vi.fn(),
  voteHazard: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  listRecentEvents: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("./db", () => ({
  closeHazard: dbMocks.closeHazard,
  createHazard: dbMocks.createHazard,
  findRecentDuplicate: dbMocks.findRecentDuplicate,
  getHazardById: dbMocks.getHazardById,
  getHazardVoteTotals: dbMocks.getHazardVoteTotals,
  getHazardsInBbox: dbMocks.getHazardsInBbox,
  voteHazard: dbMocks.voteHazard,
}));

vi.mock("./auditLog", () => ({
  listRecentEvents: auditMocks.listRecentEvents,
  logEvent: auditMocks.logEvent,
}));

vi.mock("./blockchain", () => ({
  closeHazardOnChain: vi.fn(),
  reportHazardOnChain: vi.fn(),
  voteHazardOnChain: vi.fn(),
}));

process.env.NODE_ENV = "test";
process.env.REQUIRE_SIGNATURE_AUTH = "true";
process.env.ENABLE_ONCHAIN_MUTATIONS = "false";

const { app } = await import("./server");

const demoWallet = new Wallet(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const demoAddress = demoWallet.address.toLowerCase();

async function authToken() {
  const nonceResponse = await request(app).get("/api/auth/nonce").query({ address: demoAddress });
  const signature = await demoWallet.signMessage(nonceResponse.body.message as string);
  const verifyResponse = await request(app)
    .post("/api/auth/verify")
    .send({ address: demoAddress, signature });
  return verifyResponse.body.token as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.createHazard.mockResolvedValue({
    id: 1,
    latE6: 38500000,
    lonE6: 35500000,
    type: "category_2",
    description: "test",
    created_at: new Date().toISOString(),
    created_by: demoAddress,
    severity: 4,
    category: 2,
    chain_hazard_id: null,
    closed: false,
  });
  dbMocks.findRecentDuplicate.mockResolvedValue(false);
  dbMocks.closeHazard.mockResolvedValue(true);
  dbMocks.getHazardVoteTotals.mockResolvedValue({
    upVotes: 10,
    downVotes: 1,
    totalVotes: 11,
    netVotes: 9,
  });
  dbMocks.getHazardById.mockResolvedValue({
    id: 1,
    latE6: 38500000,
    lonE6: 35500000,
    type: "category_2",
    description: "test",
    created_at: new Date().toISOString(),
    created_by: demoAddress,
    severity: 4,
    category: 2,
    chain_hazard_id: null,
    closed: false,
  });
  dbMocks.voteHazard.mockResolvedValue("ok");
  auditMocks.listRecentEvents.mockResolvedValue([
    { id: 1, event_type: "hazard_created", payload: { hazardId: 1 }, created_at: new Date().toISOString() },
  ]);
  auditMocks.logEvent.mockResolvedValue(undefined);
});

describe("API", () => {
  it("returns health response", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("rejects hazard creation without bearer token", async () => {
    const response = await request(app)
      .post("/api/hazards")
      .set("x-wallet-address", demoAddress)
      .send({ lat: 38.5, lon: 35.5, type: "pothole" });

    expect(response.status).toBe(401);
  });

  it("creates hazard after nonce+signature auth flow", async () => {
    const token = await authToken();
    const response = await request(app)
      .post("/api/hazards")
      .set("x-wallet-address", demoAddress)
      .set("Authorization", `Bearer ${token}`)
      .send({
        lat: 38.5,
        lon: 35.5,
        type: "category_2",
        category: 2,
        severity: 4,
        noteURI: "ipfs://test",
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(1);
    expect(dbMocks.createHazard).toHaveBeenCalledTimes(1);
  });

  it("applies category/time/risk filters in heatmap endpoint", async () => {
    const now = Math.floor(Date.now() / 1000);
    dbMocks.getHazardsInBbox.mockResolvedValue([
      {
        id: 1,
        latE6: 38500000,
        lonE6: 35500000,
        type: "category_2",
        description: "new",
        created_at: new Date(now * 1000).toISOString(),
        created_by: demoAddress,
        severity: 5,
        category: 2,
        chain_hazard_id: null,
        closed: false,
        votes: [{ value: 1, created_at: now, voter: demoAddress, trust: 1 }],
        lastActivityTimestamp: now,
      },
      {
        id: 2,
        latE6: 38500500,
        lonE6: 35500500,
        type: "category_2",
        description: "old",
        created_at: new Date((now - 10 * 3600) * 1000).toISOString(),
        created_by: demoAddress,
        severity: 5,
        category: 2,
        chain_hazard_id: null,
        closed: false,
        votes: [{ value: 1, created_at: now - 10 * 3600, voter: demoAddress, trust: 1 }],
        lastActivityTimestamp: now - 10 * 3600,
      },
    ]);

    const response = await request(app).get(
      "/api/heatmap?bbox=38.49,35.49,38.52,35.52&category=2&timeWindow=1&minRisk=0&maxRisk=100",
    );

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(dbMocks.getHazardsInBbox).toHaveBeenCalledWith(
      { minLat: 38.49, minLon: 35.49, maxLat: 38.52, maxLon: 35.52 },
      { category: 2, includeClosed: true },
    );
  });

  it("lists hazards with computed vote totals", async () => {
    const now = Math.floor(Date.now() / 1000);
    dbMocks.getHazardsInBbox.mockResolvedValue([
      {
        id: 9,
        latE6: 38500123,
        lonE6: 35500456,
        type: "category_3",
        description: "list row",
        created_at: new Date(now * 1000).toISOString(),
        created_by: demoAddress,
        severity: 4,
        category: 3,
        chain_hazard_id: null,
        closed: false,
        votes: [{ value: 1, created_at: now, voter: demoAddress, trust: 1 }],
        lastActivityTimestamp: now,
      },
    ]);

    const response = await request(app).get("/api/hazards?bbox=38.49,35.49,38.52,35.52&sort=votes&limit=10");
    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(9);
    expect(response.body[0].upVotes).toBe(1);
    expect(response.body[0].totalVotes).toBe(1);
  });

  it("closes hazard when reporter and vote threshold met", async () => {
    const token = await authToken();
    const response = await request(app)
      .post("/api/hazards/1/close")
      .set("x-wallet-address", demoAddress)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(dbMocks.getHazardVoteTotals).toHaveBeenCalledWith(1);
    expect(dbMocks.closeHazard).toHaveBeenCalledWith(1);
  });

  it("returns recent activity entries", async () => {
    const response = await request(app).get("/api/activity?limit=5");
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].event_type).toBe("hazard_created");
  });
});
