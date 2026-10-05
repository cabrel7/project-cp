import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = 3217
const CHROMIUM = process.env.CP_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const launchOptions = { executablePath: CHROMIUM }
const MOBILE = { width: 375, height: 667 }
const DESKTOP = { width: 1280, height: 800 }

// E2E de packages/ui : fixture Nuxt minimale (tests/e2e/fixture) qui étend le layer @cp/ui.
// Chromium préinstallé — jamais `playwright install`.
export default defineConfig({
  testDir: './specs',
  snapshotPathTemplate: '{testDir}/../__screens__/{testFileName}/{projectName}/{arg}{ext}',
  fullyParallel: true,
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
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
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
    command: `../../node_modules/.bin/nuxt dev ./fixture --port ${PORT}`,
    cwd: __dirname,
    url: `http://localhost:${PORT}/app`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
