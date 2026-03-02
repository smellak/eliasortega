import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-output",
  fullyParallel: false,
  retries: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "https://elias.centrohogarsanchez.es",
    screenshot: "on",
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/report" }],
  ],
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
      testMatch: /.*\.spec\.ts$/,
    },
  ],
});
