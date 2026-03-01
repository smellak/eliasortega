import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "https://elias.centrohogarsanchez.es",
    screenshot: "on",
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } },
    },
  ],
});
