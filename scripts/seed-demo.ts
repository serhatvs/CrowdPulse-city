import { Wallet } from "ethers";

type AuthNonce = {
  message: string;
};

type AuthVerify = {
  token: string;
};

type HazardResponse = {
  id: number;
};

const apiBase = process.env.API_URL ?? "http://127.0.0.1:3001";
const hazardCount = Number(process.env.DEMO_HAZARDS ?? 12);
const retryBackoffMs = Number(process.env.DEMO_RETRY_BACKOFF_MS ?? 65000);
const bbox = {
  minLat: 38.49,
  minLon: 35.49,
  maxLat: 38.52,
  maxLon: 35.52,
};

const demoWallets = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  },
] as const;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

async function fetchJson<T>(url: string, init?: RequestInit, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      return readJson<T>(res);
    }
    if (attempt === retries) {
      return readJson<T>(res);
    }
    await delay(retryBackoffMs);
  }
  throw new Error("Unexpected retry flow.");
}

async function authToken(address: string, privateKey: string): Promise<string> {
  const nonce = await fetchJson<AuthNonce>(`${apiBase}/api/auth/nonce?address=${address.toLowerCase()}`);
  const signature = await new Wallet(privateKey).signMessage(nonce.message);

  const verify = await fetchJson<AuthVerify>(`${apiBase}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address.toLowerCase(), signature }),
  });
  return verify.token;
}

async function createHazard(token: string, address: string, index: number): Promise<number> {
  const payload = {
    lat: randomBetween(bbox.minLat, bbox.maxLat),
    lon: randomBetween(bbox.minLon, bbox.maxLon),
    type: "demo_obstacle",
    description: `Seeded hazard #${index + 1}`,
    category: (index % 5) + 1,
    severity: (index % 5) + 1,
    noteURI: `ipfs://demo/${index + 1}`,
  };

  const created = await fetchJson<HazardResponse>(`${apiBase}/api/hazards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-wallet-address": address.toLowerCase(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return created.id;
}

async function voteHazard(token: string, address: string, hazardId: number, vote: "up" | "down"): Promise<void> {
  await fetchJson<Record<string, unknown>>(`${apiBase}/api/hazards/${hazardId}/vote`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-wallet-address": address.toLowerCase(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vote }),
  });
}

async function main(): Promise<void> {
  const health = await fetch(`${apiBase}/health`);
  if (!health.ok) {
    throw new Error(`API unavailable at ${apiBase}`);
  }

  const tokens = new Map<string, string>();
  for (const wallet of demoWallets) {
    tokens.set(wallet.address.toLowerCase(), await authToken(wallet.address, wallet.privateKey));
  }

  const created: Array<{ id: number; reporterAddress: string }> = [];
  for (let i = 0; i < hazardCount; i += 1) {
    const reporter = demoWallets[i % demoWallets.length];
    const reporterToken = tokens.get(reporter.address.toLowerCase()) as string;
    const id = await createHazard(reporterToken, reporter.address, i);
    created.push({ id, reporterAddress: reporter.address.toLowerCase() });
    await delay(140);
  }

  for (let i = 0; i < created.length; i += 1) {
    const hazard = created[i];
    for (let offset = 1; offset <= 2; offset += 1) {
      const wallet = demoWallets[(i + offset) % demoWallets.length];
      if (wallet.address.toLowerCase() === hazard.reporterAddress) {
        continue;
      }
      const token = tokens.get(wallet.address.toLowerCase()) as string;
      const vote = Math.random() > 0.25 ? "up" : "down";
      await voteHazard(token, wallet.address, hazard.id, vote);
      await delay(90);
    }
  }

  console.log(`Seed complete. Hazards created: ${created.length}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
