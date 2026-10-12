const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://127.0.0.1:3210", channel: "chrome", headless: true, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: process.env.E2E_PRODUCTION ? "npm run start -- -p 3210" : "npm run dev -- -p 3210", url: "http://127.0.0.1:3210", reuseExistingServer: !process.env.E2E_PRODUCTION, timeout: 120_000 },
});
