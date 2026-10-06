import { defineConfig, devices } from '@playwright/test'

// E2E front seul de apps/web (API absente : /v1/** est simulé par page.route dans les specs).
// Chromium préinstallé — jamais `playwright install`.
const PORT = 3000
const CHROMIUM = process.env.CP_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const launchOptions = { executablePath: CHROMIUM }
const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 375, height: 667 }

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/__screens__/{testFileName}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions,
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, colorScheme: 'light', launchOptions },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, colorScheme: 'dark', launchOptions },
    },
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 5'], viewport: MOBILE, colorScheme: 'light', launchOptions },
    },
    {
      name: 'mobile-dark',
      use: { ...devices['Pixel 5'], viewport: MOBILE, colorScheme: 'dark', launchOptions },
    },
  ],
  webServer: {
    command: `pnpm exec nuxt dev --port ${PORT}`,
    url: `http://localhost:${PORT}/auth/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
