import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = 3217
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium'

// Chemin Chromium explicite (CP_CHROMIUM_PATH) ou Chromium préinstallé de la session cloud s'il existe ;
// sinon `undefined` : Playwright utilise son Chromium géré (CI : `playwright install --with-deps chromium`).
export function resolveChromiumPath(
  env: Record<string, string | undefined> = process.env,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  if (env.CP_CHROMIUM_PATH) return env.CP_CHROMIUM_PATH
  return exists(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined
}

const CHROMIUM = resolveChromiumPath()
// exactOptionalPropertyTypes : on n'ajoute la clé que si un chemin est défini.
const launchOptions = CHROMIUM ? { executablePath: CHROMIUM } : {}
const IS_CI = !!process.env.CI

// Deux jeux de références visuelles : le rendu dépend de la version de Chromium.
// Local/session : Chromium préinstallé -> `{projectName}` ; CI : Chromium de Playwright -> `{projectName}-ci`.
// Régénération CI : workflow `update-e2e-snapshots` (voir tests/e2e/README.md).
export function snapshotEnvSuffix(env: Record<string, string | undefined> = process.env): string {
  return env.CI ? '-ci' : ''
}
const SNAPSHOT_SUFFIX = snapshotEnvSuffix()
const MOBILE = { width: 375, height: 667 }
const DESKTOP = { width: 1280, height: 800 }

// E2E de packages/ui : fixture Nuxt minimale (tests/e2e/fixture) qui étend le layer @cp/ui.
// Session cloud : Chromium préinstallé, jamais `playwright install`. CI : Chromium installé par le job.
export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  snapshotPathTemplate: `{testDir}/../__screens__/{testFileName}/{projectName}${SNAPSHOT_SUFFIX}/{arg}{ext}`,
  fullyParallel: true,
  forbidOnly: IS_CI,
  workers: IS_CI ? 1 : 2,
  // 1 reprise en CI seulement (démarrage à froid de nuxt dev) ; une capture réellement différente échoue deux fois.
  retries: IS_CI ? 1 : 0,
  reporter: IS_CI
    ? [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : [['list']],
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
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
  },
})
