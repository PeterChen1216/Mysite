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
    // The phone layout's own suite (X4, tests/e2e/mobile.spec.ts) runs on the phones only.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    // WebKit browsers are installed in CI only (PLAN §9.1: Chromium + WebKit). An iPhone in
    // WebKit runs the phone suite only (PLAN-EXPERIENCE §8.8: CI covers the widths in Chromium and
    // WebKit; the rest of the matrix runs on Pixel 7 and desktop Safari).
    ...(CI
      ? [
          { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile\.spec/ },
          {
            name: 'mobile-webkit',
            use: { ...devices['iPhone 13'] },
            testMatch: /mobile\.spec/,
          },
        ]
      : []),
  ],
  webServer: {
    command: `node scripts/serve.mjs _site ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !CI,
  },
});
