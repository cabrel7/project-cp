import { defineConfig, devices } from '@playwright/test'

// E2E RÉEL de l'authentification par téléphone (P2.2) : aucune simulation, API + PostgreSQL + Redis + proxy Nitro.
// Prérequis : `pnpm infra:up`, migrations appliquées. L'API est lancée ici en NODE_ENV=development pour que le
// fournisseur SMS simulé journalise le code (pino) dans CP_E2E_API_LOG, relu par les tests. Chromium préinstallé.
const CHROMIUM = process.env.CP_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const API_LOG = process.env.CP_E2E_API_LOG ?? 'test-results/real-api.log'

export default defineConfig({
  testDir: './tests/e2e-real',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: { executablePath: CHROMIUM },
  },
  projects: [
    {
      name: 'real-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: `mkdir -p test-results && cd ../api && set -a && . ../../.env.example && set +a && NODE_ENV=development LOG_LEVEL=info pnpm exec tsx src/index.ts > ../web/${API_LOG} 2>&1`,
      url: 'http://localhost:4000/v1/auth/me',
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec nuxt dev --port 3000',
      url: 'http://localhost:3000/auth/login',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
