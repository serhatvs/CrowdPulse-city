import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:web:e2e",
    url: "http://127.0.0.1:4173",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
