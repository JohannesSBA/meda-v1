import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(port),
      NEXT_PUBLIC_BASE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      E2E_AUTH_BYPASS: "1",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/meda_e2e",
      NEON_AUTH_BASE_URL:
        process.env.NEON_AUTH_BASE_URL ?? "https://example.com",
      NEON_AUTH_COOKIE_SECRET:
        process.env.NEON_AUTH_COOKIE_SECRET ??
        "dev-cookie-secret-dev-cookie-secret",
    },
  },
});
