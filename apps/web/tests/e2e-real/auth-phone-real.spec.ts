import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { LoginPage, PhoneCodePage, RegisterPage } from '../e2e/pages/AuthPages'
import { auth } from '../e2e/pages/helpers'

// Parcours RÉEL (P2.2) : navigateur -> proxy Nitro /v1/** (3000) -> API Hono (4000) -> PostgreSQL + Redis.
// Le code SMS est relu dans le journal pino de l'API (fournisseur simulé, NODE_ENV=development) : jamais écrit
// dans une capture, un titre de test ou un rapport. Numéros fictifs aléatoires (jamais joignables).
// Tests en série : chacun dépend du compte créé par le premier.

const API_LOG = process.env.CP_E2E_API_LOG ?? 'test-results/real-api.log'
const DB_URL =
  process.env.DBMATE_DATABASE_URL ??
  'postgres://cp_owner:cp_owner_dev@localhost:5432/cp_dev?sslmode=disable'

const national = `67${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`
const e164 = `+237${national}`

const psql = (sql: string) =>
  execFileSync('psql', [DB_URL, '-At', '-c', sql], { encoding: 'utf8' }).trim()

/** Efface les compteurs de limitation OTP (délai de renvoi 60 s, 5/h) : sinon un seul numéro ne passe pas 2 demandes. */
function flushOtpRateLimits() {
  const keys = execFileSync('redis-cli', ['--scan', '--pattern', 'rl:auth:otp:*'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  if (keys.length) execFileSync('redis-cli', ['del', ...keys])
}

// Séquences ANSI de pino-pretty (ESC construit sans littéral de contrôle).
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const logSize = () => readFileSync(API_LOG).length
/** Dernier code journalisé après `offset` (le journal est colorisé : on ignore les séquences ANSI). */
async function codeSince(offset: number): Promise<string> {
  let found = ''
  await expect
    .poll(
      () => {
        const text = readFileSync(API_LOG).subarray(offset).toString('utf8').replace(ANSI, '')
        const m = [...text.matchAll(/code: "(\d{6})"/g)].pop()
        found = m?.[1] ?? ''
        return found
      },
      { timeout: 10_000 },
    )
    .toMatch(/^\d{6}$/)
  return found
}

const wrongCode = (real: string) => (real === '111111' ? '222222' : '111111')

interface Verified {
  status: number
  body: {
    user?: { id: string; full_name: string | null; phone: string }
    is_new_user?: boolean
    error?: { code: string }
  }
}

/** Demande un code par l'interface (connexion ou inscription) et renvoie le code lu dans le journal. */
async function requestCodeViaUi(
  page: Page,
  intent: 'login' | 'register',
  name?: string,
): Promise<string> {
  flushOtpRateLimits()
  const offset = logSize()
  if (intent === 'register') {
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    if (name) await reg.phoneForm.fullName.fill(name)
    await reg.phoneForm.fillPhone(national)
    await reg.phoneForm.terms.check()
    await reg.phoneForm.submit.click()
  } else {
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(national)
    await login.phoneForm.submit.click()
  }
  await expect(page).toHaveURL(/\/auth\/phone\/code$/)
  return codeSince(offset)
}

async function enterCode(page: Page, code: string): Promise<Verified> {
  const code$ = new PhoneCodePage(page)
  await expect(code$.digit(1)).toBeFocused()
  const resp = page.waitForResponse((r) => r.url().includes('/v1/auth/phone/verify-code'))
  await code$.paste(code)
  const r = await resp
  return { status: r.status(), body: await r.json() }
}

const me = (page: Page) => page.request.get('/v1/auth/me')

/** Logout tel que l'émet useAuth().logout() : POST sans corps (donc sans Content-Type), cookie inclus. */
const logoutLikeApp = (page: Page) =>
  page.evaluate(async () => {
    const r = await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' })
    return { status: r.status, body: await r.text(), origin: location.origin }
  })
/** Contournement : même appel avec Content-Type JSON (n'est plus soumis au contrôle d'origine de csrf()). */
const logoutWithJson = (page: Page) =>
  page.evaluate(async () => {
    const r = await fetch('/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    return r.status
  })

let userId = ''

test.describe('Téléphone — parcours réel (API + PG + Redis + proxy Nitro)', () => {
  test.describe.configure({ mode: 'serial' })
  test('inscription par téléphone : code lu dans le journal de l’API, compte créé, session ouverte', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'register', 'Ada Réel')
    const v = await enterCode(page, code)
    expect(v.status).toBe(200)
    expect(v.body.is_new_user).toBe(true)
    expect(v.body.user?.phone).toBe(e164)
    userId = v.body.user?.id ?? ''
    await expect(page).toHaveURL(/\/$/)
    expect((await me(page)).status()).toBe(200)
    expect(psql(`select count(*) from iam.users where phone_e164 = '${e164}'`)).toBe('1')
  })

  test('déconnexion via le vrai proxy Nitro : POST /v1/auth/logout doit répondre 204', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    expect((await enterCode(page, code)).status).toBe(200)
    expect((await me(page)).status()).toBe(200)

    const requests: { url: string; headers: Record<string, string> }[] = []
    page.on('request', (r) => {
      if (r.url().endsWith('/v1/auth/logout')) requests.push({ url: r.url(), headers: r.headers() })
    })
    const res = await logoutLikeApp(page)
    test.info().annotations.push({
      type: 'logout-proxy',
      description: `status=${res.status} origin-navigateur=${res.origin} en-têtes=origin:${requests[0]?.headers.origin ?? '-'} content-type:${requests[0]?.headers['content-type'] ?? '(absent)'} corps=${res.body.slice(0, 120)}`,
    })
    // DÉFAUT D-csrf-1 : attendu 204 ; observé 422 PLATFORM_VALIDATION_ERROR (csrf() de Hono rejette Origin 3000
    // != origine de l'API 4000 quand le POST n'a pas de Content-Type JSON ; l'erreur 403 est mappée en 422).
    expect(res.status, `logout via proxy : ${res.body}`).toBe(204)
    expect((await me(page)).status()).toBe(401)
  })

  test('déconnexion avec Content-Type JSON (contournement) : 204 et session révoquée', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    await enterCode(page, code)
    expect(await logoutWithJson(page)).toBe(204)
    expect((await me(page)).status()).toBe(401)
  })

  test('reconnexion par code sur le même numéro : même compte, is_new_user false', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    const v = await enterCode(page, code)
    expect(v.status).toBe(200)
    expect(v.body.is_new_user).toBe(false)
    expect(v.body.user?.id).toBe(userId)
    await expect(page).toHaveURL(/\/$/)
  })

  test('code expiré (expires_at modifié en base) : alerte et « Recevoir un nouveau code »', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    psql(
      `update iam.verification_tokens set expires_at = now() - interval '1 minute' where target = '${e164}' and purpose = 'otp_login' and consumed_at is null`,
    )
    const v = await enterCode(page, code)
    expect(v.body.error?.code).toBe('AUTH_OTP_EXPIRED')
    const c = new PhoneCodePage(page)
    await expect(c.codeAlert).toContainText(auth.code.expired)
    await expect(c.requestNew).toBeVisible()
    expect((await me(page)).status()).toBe(401)
    // « Recevoir un nouveau code » : nouveau code valide, connexion possible.
    flushOtpRateLimits()
    const offset = logSize()
    await c.requestNew.click()
    const fresh = await codeSince(offset)
    expect((await enterCode(page, fresh)).status).toBe(200)
  })

  test('5 essais faux puis le bon code est refusé (ATTEMPTS_EXCEEDED) : pas de session', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    const bad = wrongCode(code)
    const remaining: (number | undefined)[] = []
    for (let i = 0; i < 4; i++) {
      const v = await enterCode(page, bad)
      expect(v.status).toBe(422)
      expect(v.body.error?.code).toBe('AUTH_OTP_INVALID')
      remaining.push(
        (v.body.error as { details?: { remaining_attempts?: number } }).details?.remaining_attempts,
      )
      await expect(new PhoneCodePage(page).invalid).toContainText('Il vous reste')
    }
    expect(remaining).toEqual([4, 3, 2, 1])
    // 5e essai faux : épuise le code.
    const fifth = await enterCode(page, bad)
    expect(['AUTH_OTP_INVALID', 'AUTH_OTP_ATTEMPTS_EXCEEDED']).toContain(fifth.body.error?.code)
    // 6e essai, avec le BON code : refusé.
    const c = new PhoneCodePage(page)
    if (fifth.body.error?.code === 'AUTH_OTP_INVALID')
      await enterCode(page, code).then((v) =>
        expect(v.body.error?.code).toBe('AUTH_OTP_ATTEMPTS_EXCEEDED'),
      )
    await expect(c.codeAlert).toContainText(auth.code.tooManyAttempts)
    await expect(c.requestNew).toBeVisible()
    expect((await me(page)).status()).toBe(401)
  })

  test('rejeu d’un code déjà utilisé : refusé', async ({ page }) => {
    const code = await requestCodeViaUi(page, 'login')
    expect((await enterCode(page, code)).status).toBe(200)
    // Même code, nouvelle session : le code est consommé.
    const replay = await page.request.post('/v1/auth/phone/verify-code', {
      data: { phone: e164, country: 'CM', code, remember_me: true, locale: 'fr' },
    })
    expect(replay.status()).toBe(422)
    expect(['AUTH_OTP_INVALID', 'AUTH_OTP_EXPIRED', 'AUTH_OTP_ATTEMPTS_EXCEEDED']).toContain(
      (await replay.json()).error.code,
    )
  })

  test('deuxième inscription sur le même numéro : connexion au compte existant, nom inchangé', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'register', 'Autre Nom')
    const v = await enterCode(page, code)
    expect(v.status).toBe(200)
    expect(v.body.is_new_user).toBe(false)
    expect(v.body.user?.id).toBe(userId)
    expect(v.body.user?.full_name).toBe('Ada Réel')
    expect(psql(`select count(*) from iam.users where phone_e164 = '${e164}'`)).toBe('1')
  })
})

// Hors de la série : un test rouge (défaut connu) ne doit pas faire sauter les parcours suivants.
test.describe('Défaut latent csrf', () => {
  // DÉFAUT D-csrf-1 (latent, test rouge attendu) : un navigateur récent passe (en-tête Sec-Fetch-Site: same-origin
  // transmis par le proxy). Sans cet en-tête (client non navigateur, ancien navigateur, front et API sur deux
  // origines `same-site` quand NUXT_PUBLIC_API_BASE est renseigné), csrf() compare Origin à l'origine de l'API :
  // 3000 != 4000, POST sans Content-Type JSON rejeté. Observé : 422 PLATFORM_VALIDATION_ERROR (le 403 de Hono est
  // converti par error-handler.ts). Attendu : 204.
  test('déconnexion sans Sec-Fetch-Site (Origin du front seul) : doit répondre 204, pas 422', async ({
    page,
  }) => {
    const code = await requestCodeViaUi(page, 'login')
    await enterCode(page, code)
    const res = await page.request.post('/v1/auth/logout', {
      headers: { origin: 'http://localhost:3000' },
    })
    expect(res.status(), await res.text()).toBe(204)
  })
})
