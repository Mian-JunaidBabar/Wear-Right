import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack: Postgres (docker), Django on 8000 and
 * Next.js on 3000, with the seeded demo data (`make e2e` migrates and seeds first).
 * Servers that are already running are reused; otherwise they are started here.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1400, height: 900 }, // desktop layout (the navbar menu is xl and up)
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } }],
  webServer: [
    {
      command: "../server/venv/bin/python ../server/manage.py runserver 8000 --noreload",
      url: "http://127.0.0.1:8000/api/products/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
