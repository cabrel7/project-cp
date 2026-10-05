import { fileURLToPath } from 'node:url'

// Application de fixture E2E : monte AppShell / AdminShell du layer @cp/ui, sans backend.
export default defineNuxtConfig({
  extends: [fileURLToPath(new URL('../../..', import.meta.url))],
  compatibilityDate: '2026-09-29',
  devtools: { enabled: false },
  telemetry: false,
  colorMode: { preference: 'system', fallback: 'light' },
})
