import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { platform } from "node:os";

const npmCmd = platform() === "win32" ? "npm.cmd" : "npm";

function log(message: string) {
  console.log(`[deploy-local] ${message}`);
}

function run(command: string) {
  log(command);
  execSync(command, { stdio: "inherit" });
}

function ensureEnvFile() {
  if (existsSync(".env")) {
    return;
  }
  if (!existsSync(".env.example")) {
    throw new Error("Missing .env and .env.example.");
  }
  copyFileSync(".env.example", ".env");
  log(".env.example copied to .env");
}

function main() {
  ensureEnvFile();
  run(`${npmCmd} run setup`);
  run(`${npmCmd} run build`);
  run(`${npmCmd} run test`);
  run(`${npmCmd} run demo:init`);
  log("Local deploy completed.");
  log("API: http://localhost:3001/health");
  log("Web UI: npm run dev:web then open http://localhost:5173");
}

try {
  main();
} catch (error) {
  console.error("[deploy-local] failed:", error);
  process.exit(1);
}
