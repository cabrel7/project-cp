import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

// Libellés FR lus depuis le fichier de langue du layer @cp/ui : aucune chaîne dupliquée dans les specs.
const frPath = fileURLToPath(
  new URL('../../../../../packages/ui/i18n/locales/fr.json', import.meta.url),
)
const fr = JSON.parse(readFileSync(frPath, 'utf8')) as {
  cp: { auth: Record<string, Record<string, string>> }
}

export const auth = fr.cp.auth as Record<string, Record<string, string>>
export const authText = (key: string): string =>
  (fr.cp.auth as unknown as Record<string, string>)[key] ?? ''

export const isMobile = (projectName: string) => projectName.startsWith('mobile')
export const isDark = (projectName: string) => projectName.endsWith('dark')

/** Nom accessible d'un champ « requis » : Nuxt UI ajoute un astérisque, d'où le préfixe. */
export const labelRe = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

/** Navigue puis attend l'hydratation Nuxt (handlers Vue attachés) : sinon les clics partent dans le vide. */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'load' })
  await page.waitForFunction(() => {
    const w = window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }
    return w.useNuxtApp?.().isHydrating === false
  })
}

export interface ApiCall {
  url: string
  body: unknown
}

/** Simule un endpoint /v1/auth/<path> (API absente) et journalise les appels. */
export async function mockAuthApi(
  page: Page,
  path: string,
  response: { status: number; body?: unknown; delayMs?: number },
): Promise<ApiCall[]> {
  const calls: ApiCall[] = []
  await page.route(`**/v1/auth/${path}`, async (route) => {
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() })
    if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs))
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body ?? {}),
    })
  })
  return calls
}
