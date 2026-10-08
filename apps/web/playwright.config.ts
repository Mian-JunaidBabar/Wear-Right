import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack: Postgres (docker), Django on 8000 and
 * Next.js on 3000, with the seeded demo data (`make e2e` migrates and seeds first).
 * Servers that are already running are reused; otherwise they are started here.
 */
// Ports can be overridden (E2E_WEB_PORT, E2E_API_PORT) so a run never reuses someone's dev servers from another checkout.
const WEB_PORT = process.env.E2E_WEB_PORT ?? "3000";
const API_PORT = process.env.E2E_API_PORT ?? "8000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1400, height: 900 }, // desktop layout (the navbar menu is xl and up)
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } }],
  webServer: [
    {
      command: `../server/venv/bin/python ../server/manage.py runserver ${API_PORT} --noreload`,
      url: `http://127.0.0.1:${API_PORT}/api/products/`,
      env: { CSRF_TRUSTED_ORIGINS: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}` },
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { BACKEND_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
