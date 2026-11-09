import { defineConfig, devices } from '@playwright/test';

// Override with E2E_PORT when several checkouts run E2E at once.
const PORT = Number(process.env.E2E_PORT ?? 4322);
const CI = !!process.env.CI;

// E2E runs against the assembled GitHub Pages artifact (_site/), not the dev server,
// so legacy-at-root, /v2/ preview and asset paths are tested exactly as deployed.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    // WebKit browsers are installed in CI only (PLAN §9.1: Chromium + WebKit).
    ...(CI ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
  ],
  webServer: {
    command: `node scripts/serve.mjs _site ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !CI,
  },
});
