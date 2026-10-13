import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { LoginPage } from './pages/AuthPages'
import {
  type ApiCall,
  apiError,
  auth,
  enPath,
  googleIdentity,
  gotoHydrated,
  METHODS_GOOGLE,
  meUser,
  mockAuthApi,
  mockMethods,
} from './pages/helpers'

// P2.3 (CA-25 à CA-28) — connexion Google, front seul : /v1/auth/** simulé par page.route. Aucun aller-retour vers
// Google (impossible sans compte réel, voir la spec §7). Quatre projets : desktop/mobile x clair/sombre.

const HIDE_DEVTOOLS =
  '#nuxt-devtools-anchor, #nuxt-devtools-container, nuxt-devtools-inspect-panel, #vue-tracer-overlay { display: none !important }'

const en = JSON.parse(readFileSync(enPath, 'utf8')) as {
  cp: {
    errors: Record<string, string | Record<string, string>>
    auth: { social: Record<string, string> }
  }
}
const fr = JSON.parse(readFileSync(enPath.replace('en.json', 'fr.json'), 'utf8')) as typeof en

const GOOGLE_LABEL = fr.cp.auth.social.continueWithGoogle as string

const ERROR_CODES = [
  'AUTH_SOCIAL_FLOW_INVALID',
  'AUTH_SOCIAL_EMAIL_UNVERIFIED',
  'AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
  'AUTH_ACCOUNT_NOT_VERIFIED',
  'AUTH_LAST_SIGN_IN_METHOD',
  'AUTH_REAUTH_REQUIRED',
] as const

test.describe('CA-25 — boutons sociaux pilotés par /methods', () => {
  for (const path of ['/auth/login', '/auth/register']) {
    test(`${path} : un seul bouton Google avec logo, ni clé d'accès ni Apple`, async ({ page }) => {
      await mockMethods(page)
      await gotoHydrated(page, path)
      const google = page.getByTestId('auth-google')
      await expect(google).toBeVisible()
      await expect(google).toContainText(GOOGLE_LABEL)
      await expect(google.locator('img[alt=""]')).toHaveCount(1)
      await expect(page.getByTestId('auth-apple')).toHaveCount(0)
      await expect(page.getByTestId('auth-passkey')).toHaveCount(0)
      await expect(page.getByText('Apple')).toHaveCount(0)
      await expect(page.getByTestId('auth-social')).toHaveCount(1)
    })

    test(`${path} : google=false → aucun bouton social ni séparateur`, async ({ page }) => {
      await mockMethods(page, { ...METHODS_GOOGLE, google: false })
      await gotoHydrated(page, path)
      await expect(page.getByTestId('auth-social')).toHaveCount(0)
      await expect(page.getByRole('separator')).toHaveCount(0)
    })

    test(`${path} : /methods en 500 → formulaires intacts, aucune section sociale`, async ({
      page,
    }) => {
      await mockMethods(page, null, 500)
      await gotoHydrated(page, path)
      await expect(page.getByTestId('auth-social')).toHaveCount(0)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test(`${path} : /methods annonce passkey et apple → les deux boutons apparaissent`, async ({
      page,
    }) => {
      await mockMethods(page, { ...METHODS_GOOGLE, passkey: true, apple: true })
      await gotoHydrated(page, path)
      await expect(page.getByTestId('auth-passkey')).toBeVisible()
      await expect(page.getByTestId('auth-apple')).toBeVisible()
      await expect(page.getByTestId('auth-google')).toBeVisible()
    })
  }
})

test.describe('CA-26 — bouton Google et erreurs de retour', () => {
  test('le bouton est un lien vers /v1/auth/oauth/google/start avec next, remember_me et locale', async ({
    page,
  }) => {
    await mockMethods(page)
    const login = new LoginPage(page)
    await login.goto()
    const href = await login.google.getAttribute('href')
    expect(href).toBeTruthy()
    const url = new URL(href ?? '', 'http://localhost')
    expect(url.pathname).toBe('/v1/auth/oauth/google/start')
    expect(url.searchParams.get('next')).toBe('/')
    expect(url.searchParams.get('remember_me')).toBe('true')
    expect(url.searchParams.get('locale')).toBe('fr')
    // « Rester connecté » décoché → remember_me=false
    await login.rememberMe.uncheck()
    const href2 = new URL((await login.google.getAttribute('href')) ?? '', 'http://localhost')
    expect(href2.searchParams.get('remember_me')).toBe('false')
  })

  test('le clic navigue vers /v1/auth/oauth/google/start (intercepté)', async ({ page }) => {
    await mockMethods(page)
    let startUrl = ''
    await page.route('**/v1/auth/oauth/google/start**', async (route) => {
      startUrl = route.request().url()
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>google</p>' })
    })
    const login = new LoginPage(page)
    await login.goto()
    await login.google.click()
    await expect.poll(() => startUrl).toContain('/v1/auth/oauth/google/start?')
  })

  test('hors ligne : bouton désactivé avec explication', async ({ page, context }) => {
    await mockMethods(page)
    const login = new LoginPage(page)
    await login.goto()
    await context.setOffline(true)
    await expect(login.google).toBeDisabled()
    await expect(page.getByText(fr.cp.auth.social.offline as string)).toBeVisible()
    await context.setOffline(false)
    await expect(login.google).toBeEnabled()
  })

  for (const code of [
    ...ERROR_CODES,
    'AUTH_ACCOUNT_SUSPENDED',
    'AUTH_SIGNUP_CLOSED',
    'PLATFORM_RATE_LIMIT',
    'AUTH_IDENTITY_ALREADY_LINKED',
  ]) {
    test(`?error=${code} : message i18n FR, jamais le code brut`, async ({ page }) => {
      await gotoHydrated(page, `/auth/login?error=${code}`)
      const alert = page.getByTestId('auth-query-error')
      await expect(alert).toBeVisible()
      await expect(alert).not.toContainText(code)
      await expect(alert).not.toHaveText('')
    })
  }

  test('?error=<CODE> en anglais', async ({ page }) => {
    await gotoHydrated(page, '/auth/login?error=AUTH_SOCIAL_EMAIL_UNVERIFIED')
    await page.locator('[data-cp-lang="en"]').click()
    await expect(page.getByTestId('auth-query-error')).toContainText(
      en.cp.errors.AUTH_SOCIAL_EMAIL_UNVERIFIED as string,
    )
  })

  test('code inconnu ou <script> : message générique, paramètre brut jamais affiché', async ({
    page,
  }) => {
    for (const bad of ['NOPE_CODE', encodeURIComponent('<script>alert(1)</script>')]) {
      await gotoHydrated(page, `/auth/login?error=${bad}`)
      const alert = page.getByTestId('auth-query-error')
      await expect(alert).toContainText(auth.genericError as unknown as string)
      await expect(page.locator('body')).not.toContainText('NOPE_CODE')
      await expect(page.locator('body')).not.toContainText('<script>')
    }
  })

  test('&reason=cancelled : message neutre', async ({ page }) => {
    await gotoHydrated(page, '/auth/login?error=AUTH_SOCIAL_FLOW_INVALID&reason=cancelled')
    await expect(page.getByTestId('auth-query-error')).toContainText(
      fr.cp.auth.social.cancelled as string,
    )
  })

  test('?link=google : alerte info, puis connexion par mot de passe → /auth/link-account', async ({
    page,
  }) => {
    await mockAuthApi(page, 'login', { status: 200, body: { user: meUser, session: {} } })
    await page.route('**/v1/auth/link/pending', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ provider: 'google', email_masked: 'a***@gmail.com' }),
      }),
    )
    await mockAuthApi(page, 'me', { status: 200, body: meUser })
    const login = new LoginPage(page)
    await gotoHydrated(page, '/auth/login?link=google')
    await expect(page.getByTestId('auth-link-info')).toContainText(
      fr.cp.auth.social.accountExists as string,
    )
    await login.fill('awa@boutique-exemple.cm', 'secret-password')
    await login.submit.click()
    await expect(page).toHaveURL(/\/auth\/link-account$/)
  })

  test('?next= hostile ignoré après connexion', async ({ page }) => {
    await mockAuthApi(page, 'login', { status: 200, body: { user: meUser, session: {} } })
    const login = new LoginPage(page)
    await gotoHydrated(page, '/auth/login?next=//evil.example/x')
    await login.fill('awa@boutique-exemple.cm', 'secret-password')
    await login.submit.click()
    await expect(page).toHaveURL(/localhost:3000\/$/)
  })
})

async function mockLinkPending(
  page: import('@playwright/test').Page,
  response: { status: number; body?: unknown; delayMs?: number },
): Promise<ApiCall[]> {
  const calls: ApiCall[] = []
  await page.route('**/v1/auth/link/pending', async (route) => {
    calls.push({ url: route.request().url(), body: null })
    if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs))
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body ?? {}),
    })
  })
  return calls
}

const linkText = (key: string) =>
  (fr.cp as unknown as { auth: { link: Record<string, string> } }).auth.link[key] ?? ''

test.describe('CA-27 — G8 /auth/link-account', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page, 'me', { status: 200, body: meUser })
  })

  test('affiche l’e-mail masqué, « Lier le compte » (seul principal) et « Annuler »', async ({
    page,
  }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
    })
    await gotoHydrated(page, '/auth/link-account')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(linkText('title'))
    await expect(page.getByText('a***@gmail.com')).toBeVisible()
    await expect(page.getByRole('button', { name: linkText('confirm') })).toBeVisible()
    await expect(page.getByRole('button', { name: linkText('cancel') })).toBeVisible()
    await expect(page).toHaveScreenshot('link-account.png', {
      fullPage: true,
      style: HIDE_DEVTOOLS,
    })
  })

  test('chargement : squelette si l’attente dépasse 300 ms, bouton en attente', async ({
    page,
  }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
      delayMs: 1500,
    })
    await gotoHydrated(page, '/auth/link-account')
    await expect(page.getByRole('status', { name: /./ }).first()).toBeVisible()
    await expect(page.getByText('a***@gmail.com')).toBeVisible()
  })

  test('succès : POST /link/confirm puis accueil', async ({ page }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
    })
    const calls = await mockAuthApi(page, 'link/confirm', { status: 204 })
    await gotoHydrated(page, '/auth/link-account')
    await page.getByRole('button', { name: linkText('confirm') }).click()
    await expect(page).toHaveURL(/localhost:3000\/$/)
    expect(calls).toHaveLength(1)
  })

  test('« Annuler » : aucun appel API, message « Google n’a pas été lié », puis Continuer', async ({
    page,
  }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
    })
    let confirmCalled = false
    await page.route('**/v1/auth/link/confirm', async (route) => {
      confirmCalled = true
      await route.fulfill({ status: 204 })
    })
    await gotoHydrated(page, '/auth/link-account')
    await page.getByRole('button', { name: linkText('cancel') }).click()
    await expect(page.getByText(linkText('cancelled'))).toBeVisible()
    await page.getByRole('button', { name: linkText('continue') }).click()
    await expect(page).toHaveURL(/localhost:3000\/$/)
    expect(confirmCalled).toBe(false)
  })

  test('404 → « Cette demande a expiré » + Continuer', async ({ page }) => {
    await mockLinkPending(page, { status: 404, body: apiError('PLATFORM_RESOURCE_NOT_FOUND') })
    await gotoHydrated(page, '/auth/link-account')
    await expect(page.getByText(linkText('expired'))).toBeVisible()
    await expect(page.getByRole('button', { name: linkText('backToLogin') })).toBeVisible()
    await expect(page.getByRole('button', { name: linkText('cancel') })).toHaveCount(0)
  })

  test('AUTH_REAUTH_REQUIRED à la confirmation → « Se reconnecter »', async ({ page }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
    })
    await mockAuthApi(page, 'link/confirm', {
      status: 403,
      body: apiError('AUTH_REAUTH_REQUIRED', { reason: 'login_before_link' }),
    })
    const logout = await mockAuthApi(page, 'logout', { status: 200, body: { ok: true } })
    await gotoHydrated(page, '/auth/link-account')
    await page.getByRole('button', { name: linkText('confirm') }).click()
    await page.getByRole('button', { name: linkText('reconnect') }).click()
    await expect(page).toHaveURL(/\/auth\/login\?link=google/)
    expect(logout).toHaveLength(1)
  })

  test('AUTH_ACCOUNT_NOT_VERIFIED → « Renvoyer l’e-mail de vérification »', async ({ page }) => {
    await mockLinkPending(page, { status: 403, body: apiError('AUTH_ACCOUNT_NOT_VERIFIED') })
    const resend = await mockAuthApi(page, 'resend-verification', {
      status: 200,
      body: { ok: true },
    })
    await gotoHydrated(page, '/auth/link-account')
    await page.getByRole('button', { name: linkText('resendVerification') }).click()
    await expect(page.getByText(linkText('verificationSent'))).toBeVisible()
    expect(resend).toHaveLength(1)
  })

  test('AUTH_IDENTITY_ALREADY_LINKED à la confirmation → message + Continuer', async ({ page }) => {
    await mockLinkPending(page, {
      status: 200,
      body: { provider: 'google', email_masked: 'a***@gmail.com' },
    })
    await mockAuthApi(page, 'link/confirm', {
      status: 409,
      body: apiError('AUTH_IDENTITY_ALREADY_LINKED', { reason: 'sub_linked_elsewhere' }),
    })
    await gotoHydrated(page, '/auth/link-account')
    await page.getByRole('button', { name: linkText('confirm') }).click()
    await expect(
      page.getByText(
        (fr.cp.errors.AUTH_IDENTITY_ALREADY_LINKED as unknown as Record<string, string>)
          .sub_linked_elsewhere ?? '',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: linkText('backToLogin') })).toBeVisible()
  })

  test('401 sur /link/pending → /auth/login?link=google', async ({ page }) => {
    await mockLinkPending(page, { status: 401, body: apiError('AUTH_TOKEN_INVALID') })
    await gotoHydrated(page, '/auth/link-account')
    await expect(page).toHaveURL(/\/auth\/login\?link=google/)
  })

  test('sans session → /auth/login?next=/auth/link-account&link=google', async ({ page }) => {
    await page.unroute('**/v1/auth/me')
    await mockAuthApi(page, 'me', { status: 401, body: apiError('AUTH_TOKEN_INVALID') })
    await page.goto('/auth/link-account')
    await expect(page).toHaveURL(/\/auth\/login\?next=(%2F|\/)auth(%2F|\/)link-account&link=google/)
  })
})

const sec = (key: string) =>
  (fr.cp as unknown as { account: { security: { methods: Record<string, string> } } }).account
    .security.methods[key] ?? ''

test.describe('CA-28 — /account/security', () => {
  test('succès : mot de passe défini, téléphone non ajouté, Google non lié', async ({ page }) => {
    await mockAuthApi(page, 'me', { status: 200, body: meUser })
    await gotoHydrated(page, '/account/security')
    await expect(page.getByTestId('method-password')).toContainText(sec('passwordSet'))
    await expect(page.getByTestId('method-phone')).toContainText(sec('phoneNone'))
    await expect(page.getByTestId('method-google')).toContainText(sec('notLinked'))
    await expect(page.getByTestId('link-google')).toBeVisible()
    await expect(page).toHaveScreenshot('security-not-linked.png', {
      fullPage: true,
      style: HIDE_DEVTOOLS,
    })
  })

  test('erreur 500 : alerte avec « Réessayer », puis succès', async ({ page }) => {
    let broken = true
    await page.route('**/v1/auth/me', async (route) => {
      if (broken) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meUser),
      })
    })
    await gotoHydrated(page, '/account/security')
    await expect(page.getByTestId('security-load-error')).toBeVisible()
    broken = false
    await page
      .getByTestId('security-load-error')
      .getByRole('button', {
        name: (fr.cp as unknown as { account: { security: { retry: string } } }).account.security
          .retry,
      })
      .click()
    await expect(page.getByTestId('method-google')).toBeVisible()
  })

  test('« Lier Google » : POST /oauth/google/link puis navigation vers l’URL renvoyée', async ({
    page,
  }) => {
    await mockAuthApi(page, 'me', { status: 200, body: meUser })
    await page.route('https://accounts.google.test/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>google</p>' }),
    )
    const calls = await mockAuthApi(page, 'oauth/google/link', {
      status: 200,
      body: { authorization_url: 'https://accounts.google.test/auth?x=1' },
    })
    await gotoHydrated(page, '/account/security')
    await page.getByTestId('link-google').click()
    await expect(page).toHaveURL(/accounts\.google\.test\/auth/)
    expect(calls[0]?.body).toEqual({ next: '/account/security' })
  })

  test('?linked=google → alerte de succès', async ({ page }) => {
    await mockAuthApi(page, 'me', {
      status: 200,
      body: { ...meUser, identities: [googleIdentity] },
    })
    await gotoHydrated(page, '/account/security?linked=google')
    await expect(page.getByTestId('security-notice')).toContainText(sec('linkedSuccess'))
    await expect(page.getByTestId('method-google')).toContainText('awa@gmail.com')
    await expect(page).toHaveScreenshot('security-linked.png', {
      fullPage: true,
      style: HIDE_DEVTOOLS,
    })
  })

  test('« Délier » → confirmation → 204 → « Non lié »', async ({ page }) => {
    let linked = true
    await page.route('**/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...meUser, identities: linked ? [googleIdentity] : [] }),
      }),
    )
    await page.route('**/v1/auth/identities/google', async (route) => {
      linked = false
      await route.fulfill({ status: 204 })
    })
    await gotoHydrated(page, '/account/security')
    await page.getByTestId('unlink-google').click()
    await expect(page.getByRole('dialog')).toContainText(sec('unlinkConfirm'))
    await page
      .getByRole('dialog')
      .getByRole('button', { name: sec('unlink') })
      .click()
    await expect(page.getByTestId('method-google')).toContainText(sec('notLinked'))
    await expect(page.getByTestId('security-unlinked')).toBeVisible()
  })

  test('409 AUTH_LAST_SIGN_IN_METHOD → message + « Définir un mot de passe »', async ({ page }) => {
    await mockAuthApi(page, 'me', {
      status: 200,
      body: { ...meUser, has_password: false, identities: [googleIdentity] },
    })
    await mockAuthApi(page, 'identities/google', {
      status: 409,
      body: apiError('AUTH_LAST_SIGN_IN_METHOD'),
    })
    await gotoHydrated(page, '/account/security')
    await page.getByTestId('unlink-google').click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: sec('unlink') })
      .click()
    const failure = page.getByTestId('security-failure')
    await expect(failure).toBeVisible()
    await expect(failure.getByRole('button', { name: sec('setPassword') })).toBeVisible()
  })

  test('403 AUTH_REAUTH_REQUIRED → « Se reconnecter »', async ({ page }) => {
    await mockAuthApi(page, 'me', {
      status: 200,
      body: { ...meUser, identities: [googleIdentity] },
    })
    await mockAuthApi(page, 'identities/google', {
      status: 403,
      body: apiError('AUTH_REAUTH_REQUIRED', { reason: 'recent_login_required' }),
    })
    await mockAuthApi(page, 'logout', { status: 200, body: { ok: true } })
    await gotoHydrated(page, '/account/security')
    await page.getByTestId('unlink-google').click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: sec('unlink') })
      .click()
    await page
      .getByTestId('security-failure')
      .getByRole('button', {
        name: (fr.cp as unknown as { auth: { link: { reconnect: string } } }).auth.link.reconnect,
      })
      .click()
    await expect(page).toHaveURL(/\/auth\/login\?next=(%2F|\/)account(%2F|\/)security/)
  })

  test('e-mail non vérifié → « Lier Google » masqué avec explication', async ({ page }) => {
    await mockAuthApi(page, 'me', {
      status: 200,
      body: { ...meUser, email_verified: false },
    })
    await gotoHydrated(page, '/account/security')
    await expect(page.getByTestId('link-google')).toHaveCount(0)
    await expect(page.getByTestId('verify-email-first')).toContainText(sec('verifyEmailFirst'))
  })

  test('sans session → /auth/login?next=/account/security', async ({ page }) => {
    await mockAuthApi(page, 'me', { status: 401, body: apiError('AUTH_TOKEN_INVALID') })
    await page.goto('/account/security')
    await expect(page).toHaveURL(/\/auth\/login\?next=(%2F|\/)account(%2F|\/)security/)
  })
})
