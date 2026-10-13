import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

// Libellés FR lus depuis le fichier de langue du layer @cp/ui : aucune chaîne dupliquée dans les specs.
const frPath = fileURLToPath(
  new URL('../../../../../packages/ui/i18n/locales/fr.json', import.meta.url),
)
const fr = JSON.parse(readFileSync(frPath, 'utf8')) as {
  cp: { auth: Record<string, Record<string, string>> } & Record<string, unknown>
}

/** Arbre `cp.*` complet (FR) pour les écrans hors `cp.auth`. */
export const cp = fr.cp as Record<string, Record<string, unknown>>
export const enPath = frPath.replace('fr.json', 'en.json')

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
  response: {
    status: number
    body?: unknown
    delayMs?: number
    headers?: Record<string, string>
  },
): Promise<ApiCall[]> {
  const calls: ApiCall[] = []
  await page.route(`**/v1/auth/${path}`, async (route) => {
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() })
    if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs))
    await route.fulfill({
      status: response.status,
      headers: response.headers ?? {},
      contentType: 'application/json',
      body: JSON.stringify(response.body ?? {}),
    })
  })
  return calls
}

/** Corps d'erreur du catalogue (`{ error: { code, details } }`), tel que renvoyé par l'API. */
export const apiError = (code: string, details: Record<string, unknown> = {}) => ({
  error: { code, message: 'masqué', request_id: 'req-e2e', details },
})

/** Utilisateur renvoyé par verify-code (valeurs fictives). */
export const phoneUser = {
  id: '01900000-0000-7000-8000-000000000001',
  email: null,
  email_verified: false,
  full_name: 'Test E2E',
  locale: 'fr',
  timezone: 'Africa/Douala',
  created_at: '2026-10-12T10:00:00.000Z',
  phone: '+237670000101',
  phone_verified: true,
  free_tier_eligible: true,
}

export const verifyOk = (isNew = false) => ({
  user: phoneUser,
  session: {
    id: 's',
    ip: '127.0.0.1',
    user_agent: 'e2e',
    device_label: null,
    created_at: phoneUser.created_at,
    last_seen_at: phoneUser.created_at,
    is_current: true,
  },
  is_new_user: isNew,
})

export const requestOk = { ok: true, expires_in_seconds: 300, resend_after_seconds: 60 }

/** Numéro mobile camerounais fictif (9 chiffres nationaux). */
export const CM_NATIONAL = '670000101'

/** Réponse de `GET /v1/auth/methods` simulée (P2.3 : clé d'accès et Apple valent `false`). */
export interface MethodsBody {
  password: true
  phone: boolean
  google: boolean
  passkey: boolean
  apple: boolean
}

export const METHODS_GOOGLE: MethodsBody = {
  password: true,
  phone: true,
  google: true,
  passkey: false,
  apple: false,
}

/** Simule `GET /v1/auth/methods` (statut 200 par défaut). */
export async function mockMethods(
  page: Page,
  body: MethodsBody | null = METHODS_GOOGLE,
  status = 200,
): Promise<void> {
  await page.route('**/v1/auth/methods', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body ?? {}),
    }),
  )
}

/** Utilisateur de `GET /v1/auth/me` (additifs P2.3 : has_password, identities). */
export const meUser = {
  id: '01900000-0000-7000-8000-000000000002',
  email: 'awa@boutique-exemple.cm',
  email_verified: true,
  full_name: 'Awa Nkeng',
  locale: 'fr',
  timezone: 'Africa/Douala',
  created_at: '2026-10-12T10:00:00.000Z',
  phone: null,
  phone_verified: false,
  free_tier_eligible: true,
  has_password: true,
  identities: [] as { provider: 'google'; email: string | null; linked_at: string }[],
}

export const googleIdentity = {
  provider: 'google' as const,
  email: 'awa@gmail.com',
  linked_at: '2026-10-13T08:00:00.000Z',
}
