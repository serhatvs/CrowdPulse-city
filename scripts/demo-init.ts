import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envExamplePath = path.join(rootDir, ".env.example");
const envPath = path.join(rootDir, ".env");

const hardhatDemoPrivateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function run(command: string, capture = false): string {
  if (capture) {
    return execSync(command, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
    });
  }
  execSync(command, { cwd: rootDir, stdio: "inherit" });
  return "";
}

function setEnvValue(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trim()}\n${line}\n`;
}

function ensureEnvFile(): string {
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }
  let content = fs.readFileSync(envPath, "utf8");
  content = setEnvValue(content, "RPC_URL", "http://127.0.0.1:8545");
  content = setEnvValue(content, "PRIVATE_KEY", hardhatDemoPrivateKey);
  content = setEnvValue(content, "PORT", "3001");
  content = setEnvValue(content, "HEATMAP_GRID_SIZE_E6", "900");
  content = setEnvValue(content, "REQUIRE_SIGNATURE_AUTH", "true");
  content = setEnvValue(content, "ENABLE_ONCHAIN_MUTATIONS", "false");
  content = setEnvValue(content, "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173");
  content = setEnvValue(content, "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/crowdpulse");
  fs.writeFileSync(envPath, content);
  return content;
}

async function waitFor(label: string, fn: () => Promise<boolean>, timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await fn()) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timeout while waiting for ${label}`);
}

async function waitForApi(): Promise<void> {
  await waitFor("api health", async () => {
    const response = await fetch("http://127.0.0.1:3001/health");
    return response.ok;
  });
}

async function waitForRpc(): Promise<void> {
  await waitFor("hardhat rpc", async () => {
    const response = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
    });
    return response.ok;
  });
}

function updateContractAddress(address: string): void {
  let content = fs.readFileSync(envPath, "utf8");
  content = setEnvValue(content, "CONTRACT_ADDRESS", address);
  fs.writeFileSync(envPath, content);
}

function extractContractAddress(output: string): string {
  const match = output.match(/CityPulse deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!match) {
    throw new Error(`Deploy output did not include contract address:\n${output}`);
  }
  return match[1];
}

async function main(): Promise<void> {
  ensureEnvFile();

  run("docker compose up -d postgres hardhat");
  await waitForRpc();

  const deployOutput = run(
    "docker compose exec hardhat sh -lc \"npm --workspace @crowdpulse/contracts run deploy\"",
    true,
  );
  const contractAddress = extractContractAddress(deployOutput);
  updateContractAddress(contractAddress);
  console.log(`Contract deployed: ${contractAddress}`);

  run("docker compose up -d --force-recreate api indexer");
  await waitForApi();

  run("npm run migrate");
  run("npm run reset:demo");
  run("npm run seed:demo");
  run("npm run verify:demo");
  run("npm run health:demo");

  console.log("Demo init complete.");
}

main().catch((error) => {
  console.error("demo:init failed:", error);
  process.exit(1);
});
