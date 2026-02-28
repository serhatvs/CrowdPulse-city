import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envExamplePath = path.join(rootDir, ".env.example");
const envPath = path.join(rootDir, ".env");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const MONAD_CHAIN_ID = "10143";
const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
const MONAD_CHAIN_NAME = "Monad Testnet";
const MONAD_EXPLORER_URL = "https://testnet.monadvision.com";
const MONAD_CURRENCY_NAME = "Monad";
const MONAD_CURRENCY_SYMBOL = "MON";

function log(message: string): void {
  console.log(`[deploy-monad] ${message}`);
}

function ensureEnvFile(): string {
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
    log(".env.example copied to .env");
  }
  return fs.readFileSync(envPath, "utf8");
}

function getEnvValue(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function setEnvValue(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trim()}\n${line}\n`;
}

function extractContractAddress(output: string): string {
  const match = output.match(/CityPulse deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!match) {
    throw new Error(`Deploy output did not include contract address:\n${output}`);
  }
  return match[1];
}

function runDeploy(privateKey: string, rpcUrl: string): string {
  return execSync(`${npmCmd} --workspace @crowdpulse/contracts run deploy:monad`, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      PRIVATE_KEY: privateKey,
      MONAD_RPC_URL: rpcUrl,
    },
  });
}

function main(): void {
  const content = ensureEnvFile();
  const privateKey = getEnvValue(content, "PRIVATE_KEY") ?? process.env.PRIVATE_KEY ?? "";
  const rpcUrl = getEnvValue(content, "MONAD_RPC_URL") ?? process.env.MONAD_RPC_URL ?? MONAD_RPC_URL;

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY eksik veya gecersiz. .env dosyasina fonlanmis Monad testnet private key ekleyin.");
  }

  log(`Deploying CityPulse to ${MONAD_CHAIN_NAME} via ${rpcUrl}`);

  let deployOutput = "";
  try {
    deployOutput = runDeploy(privateKey, rpcUrl);
  } catch (error) {
    const stdout = error instanceof Error && "stdout" in error ? String((error as { stdout?: unknown }).stdout ?? "") : "";
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "";
    const details = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    throw new Error(details || (error instanceof Error ? error.message : String(error)));
  }

  const contractAddress = extractContractAddress(deployOutput);
  let nextContent = content;
  nextContent = setEnvValue(nextContent, "MONAD_RPC_URL", rpcUrl);
  nextContent = setEnvValue(nextContent, "DOCKER_RPC_URL", rpcUrl);
  nextContent = setEnvValue(nextContent, "RPC_URL", rpcUrl);
  nextContent = setEnvValue(nextContent, "CONTRACT_ADDRESS", contractAddress);
  nextContent = setEnvValue(nextContent, "ENABLE_ONCHAIN_MUTATIONS", "true");
  nextContent = setEnvValue(nextContent, "VITE_DEMO_MODE", "false");
  nextContent = setEnvValue(nextContent, "VITE_MONAD_REQUIRED", "true");
  nextContent = setEnvValue(nextContent, "VITE_MONAD_CHAIN_ID", MONAD_CHAIN_ID);
  nextContent = setEnvValue(nextContent, "VITE_MONAD_CHAIN_NAME", MONAD_CHAIN_NAME);
  nextContent = setEnvValue(nextContent, "VITE_MONAD_RPC_URL", rpcUrl);
  nextContent = setEnvValue(nextContent, "VITE_MONAD_EXPLORER_URL", MONAD_EXPLORER_URL);
  nextContent = setEnvValue(nextContent, "VITE_MONAD_CURRENCY_NAME", MONAD_CURRENCY_NAME);
  nextContent = setEnvValue(nextContent, "VITE_MONAD_CURRENCY_SYMBOL", MONAD_CURRENCY_SYMBOL);
  nextContent = setEnvValue(nextContent, "VITE_CONTRACT_ADDRESS", contractAddress);
  fs.writeFileSync(envPath, nextContent);

  log(`Contract deployed: ${contractAddress}`);
  log(`Explorer: ${MONAD_EXPLORER_URL}/address/${contractAddress}`);
  log("Environment updated for Monad testnet.");
}

try {
  main();
} catch (error) {
  console.error("[deploy-monad] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
