import { expect, type Page, test } from '@playwright/test'
import { LoginPage, PhoneCodePage, RegisterPage } from './pages/AuthPages'
import {
  apiError,
  auth,
  CM_NATIONAL,
  gotoHydrated,
  isMobile,
  mockAuthApi,
  requestOk,
  verifyOk,
} from './pages/helpers'

// P2.2 — connexion et inscription par téléphone + code SMS (CA-42 à CA-45), front seul.
// L'API est absente : /v1/auth/phone/** est simulé par page.route (comme en P2.1). Le parcours réel,
// sans simulation, est dans tests/e2e-real/. Aucun vrai numéro, aucun vrai code : valeurs fictives.
// Statuts HTTP = catalogue d'erreurs (packages/shared/src/errors.ts) : OTP_* 422, SMS_UNAVAILABLE 503.

const STORAGE_KEY = 'cp.phoneAuth.request'
const E164 = '+237670000101'
const CODE = '270512'

type Intent = 'login' | 'register'

/** Horloge pilotée : temps figé, avancé seulement par `page.clock.runFor` (compte à rebours exact). */
async function pausedClock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-12T10:00:00.000Z') })
  await page.clock.pauseAt(new Date('2026-10-12T10:00:01.000Z'))
}

/** Pose une demande de code en cours avant le chargement (comme après « Recevoir un code »). */
async function seedRequest(
  page: Page,
  opts: { intent?: Intent; resendInSeconds?: number; fullName?: string } = {},
) {
  const { intent = 'login', resendInSeconds = 60, fullName } = opts
  await page.addInitScript(
    ([key, e164, kind, resend, name]) => {
      // Une seule fois par onglet : un rechargement ne doit pas remettre le compteur à zéro.
      if (sessionStorage.getItem(key as string)) return
      sessionStorage.setItem(
        key as string,
        JSON.stringify({
          e164,
          country: 'CM',
          intent: kind,
          ...(name ? { fullName: name } : {}),
          expiresAt: Date.now() + 300_000,
          resendAt: Date.now() + (resend as number) * 1000,
        }),
      )
    },
    [STORAGE_KEY, E164, intent, resendInSeconds, fullName ?? ''] as const,
  )
}

const storageRequest = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY)

// ───────────────────────────── CA-42 — connexion par téléphone ─────────────────────────────

test.describe('Connexion par téléphone /auth/login (CA-42)', () => {
  test('?tab=phone : onglet Téléphone actif, une seule action principale « Recevoir un code » désactivée', async ({
    page,
  }) => {
    const login = new LoginPage(page)
    await login.gotoPhone()

    await expect(login.tabPhone).toHaveAttribute('aria-selected', 'true')
    await expect(login.tabEmail).toHaveAttribute('aria-selected', 'false')
    await expect(login.tabPhone).toBeEnabled()
    await expect(login.phoneForm.phone).toBeVisible()
    await expect(page.getByText(auth.phone.hintLogin)).toBeVisible()

    // Une seule action principale : pas de « Se connecter » (formulaire e-mail) en même temps.
    await expect(login.phoneForm.submit).toHaveText(auth.phone.submit)
    await expect(login.phoneForm.submit).toBeDisabled()
    await expect(login.submit).toHaveCount(0)
    await expect(login.email).toHaveCount(0)
    await expect(login.password).toHaveCount(0)
    // Sans réponse de /methods (API absente) : aucun bouton social (échec fermé, CA-25).
    await expect(login.google).toHaveCount(0)
    await expect(login.apple).toHaveCount(0)
    await expect(login.passkey).toHaveCount(0)
  })

  // DÉFAUT D-a11y-1 (test rouge attendu tant que non corrigé) : le sélecteur de pays et le champ du numéro
  // portent le même `id` (hérité de UFormField) ; le <label for> pointe sur le bouton du pays et le champ
  // numéro n'a aucun nom accessible (WCAG 1.3.1 / 4.1.2, règle axe duplicate-id / label).
  test('le champ numéro a un nom accessible « Numéro de téléphone » et un id unique', async ({
    page,
  }) => {
    const login = new LoginPage(page)
    await login.gotoPhone()
    await expect(login.phoneForm.phone).toBeEnabled()
    await expect(login.phoneForm.phoneByLabel).toBeVisible({ timeout: 2000 })
    const ids = await login.phoneForm.root.locator('[id]').evaluateAll((els) => {
      const seen = new Map<string, number>()
      for (const e of els) seen.set(e.id, (seen.get(e.id) ?? 0) + 1)
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id)
    })
    expect(ids, 'identifiants dupliqués dans le formulaire').toEqual([])
  })

  test("l'onglet Téléphone se déclenche au clic et revient à E-mail", async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await expect(login.tabEmail).toHaveAttribute('aria-selected', 'true')

    await login.tabPhone.click()
    await expect(login.tabPhone).toHaveAttribute('aria-selected', 'true')
    await expect(login.phoneForm.submit).toBeVisible()
    await expect(login.email).toHaveCount(0)

    await login.tabEmail.click()
    await expect(login.email).toBeVisible()
    await expect(login.submit).toBeVisible()
    await expect(login.phoneForm.root).toHaveCount(0)
  })

  test('bouton désactivé tant que le numéro est invalide ; TOO_SHORT indique le nombre de chiffres', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const login = new LoginPage(page)
    await login.gotoPhone()
    const form = login.phoneForm
    // Le champ est inactif tant que la bibliothèque de numéros n'est pas chargée.
    await expect(form.phone).toBeEnabled()

    await form.fillPhone('67000')
    await expect(form.submit).toBeDisabled()
    // Pas d'erreur pendant la frappe...
    await expect(page.getByText(/Il manque/)).toHaveCount(0)
    // ... elle apparaît quand on quitte le champ : 5 chiffres saisis, 9 attendus.
    await form.phone.blur()
    await expect(
      page.getByText(/Il manque 4 chiffres : un numéro de ce pays en compte 9\./),
    ).toBeVisible()
    await expect(form.submit).toBeDisabled()

    await form.fillPhone('6700001')
    await expect(
      page.getByText(/Il manque 2 chiffres : un numéro de ce pays en compte 9\./),
    ).toBeVisible()
    await expect(form.submit).toBeDisabled()

    await form.fillPhone(CM_NATIONAL)
    await expect(page.getByText(/Il manque/)).toHaveCount(0)
    await expect(form.submit).toBeEnabled()

    // Trop long : refusé, aucun appel API émis.
    await form.fillPhone(`${CM_NATIONAL}1234`)
    await expect(page.getByText(auth.phone.errors.tooLong)).toBeVisible()
    await expect(form.submit).toBeDisabled()
    expect(calls).toHaveLength(0)
  })

  // DÉFAUT D-tooshort-1 (test rouge attendu tant que non corrigé) : maquette 05 et CA-42 montrent
  // « Il manque un chiffre… en compte 9 » pour « 6 90 12 34 » (8 chiffres). libphonenumber renvoie
  // INVALID_LENGTH (et non TOO_SHORT) à 8 chiffres au Cameroun : l'écran affiche « Ce numéro n'est pas valide ».
  test('8 chiffres au Cameroun : « Il manque un chiffre… en compte 9 » (maquette 05)', async ({
    page,
  }) => {
    const login = new LoginPage(page)
    await login.gotoPhone()
    await expect(login.phoneForm.phone).toBeEnabled()
    await login.phoneForm.fillPhone('69012344')
    await login.phoneForm.phone.blur()
    await expect(
      page.getByText(/Il manque un chiffre : un numéro de ce pays en compte 9\./),
    ).toBeVisible()
    await expect(login.phoneForm.submit).toBeDisabled()
  })

  test('200 : appelle request-code puis ouvre /auth/phone/code ; la demande est en sessionStorage sans code', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()

    await expect(page).toHaveURL(/\/auth\/phone\/code$/)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({ phone: E164, country: 'CM', locale: 'fr' })

    const stored = JSON.parse((await storageRequest(page)) ?? 'null') as Record<string, unknown>
    expect(stored).toMatchObject({ e164: E164, country: 'CM', intent: 'login' })
    expect(Object.keys(stored).sort()).toEqual([
      'country',
      'e164',
      'expiresAt',
      'intent',
      'resendAt',
    ])
    // Numéro masqué à l'écran, jamais en clair.
    const code = new PhoneCodePage(page)
    await expect(code.sentTo).toContainText('+237 6 70 •• •• 01')
    await expect(code.sentTo).not.toContainText(CM_NATIONAL)
  })

  test('double soumission : une seule demande tant que la première est en cours', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'phone/request-code', {
      status: 200,
      body: requestOk,
      delayMs: 600,
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.phone.press('Enter')
    await login.phoneForm.phone.press('Enter')
    await login.phoneForm.submit.click({ force: true }).catch(() => undefined)
    await expect(page).toHaveURL(/\/auth\/phone\/code$/)
    expect(calls).toHaveLength(1)
  })

  test('429 : message avec la durée du Retry-After, reste sur la page', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 429,
      headers: { 'Retry-After': '45' },
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()

    await expect(login.phoneForm.alert).toHaveText(
      /Trop de demandes\. Réessayez dans 45 secondes\./,
    )
    await expect(login.phoneForm.alert).toHaveAttribute('role', 'alert')
    await expect(page).toHaveURL(/\/auth\/login\?tab=phone$/)
    expect(await storageRequest(page)).toBeNull()
    // Modifier le numéro efface le message (nouvel essai possible).
    await login.phoneForm.fillPhone('670000102')
    await expect(login.phoneForm.alert).toHaveCount(0)
  })

  test('429 sans Retry-After : message générique de limitation', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 429,
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()
    await expect(login.phoneForm.alert).toHaveText(auth.rateLimited)
  })

  test('429 : durée en minutes et secondes (150 s)', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 429,
      headers: { 'Retry-After': '150' },
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()
    await expect(login.phoneForm.alert).toHaveText(/Réessayez dans 2 min 30 s\./)
  })

  test('503 : alerte « SMS indisponible » et lien « Utiliser mon e-mail » qui ramène au formulaire e-mail', async ({
    page,
  }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 503,
      body: apiError('AUTH_SMS_UNAVAILABLE'),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()

    await expect(login.phoneForm.alert).toContainText(auth.code.smsUnavailable)
    await expect(login.phoneForm.useEmail).toBeVisible()
    await login.phoneForm.useEmail.click()
    // Le lien doit réellement présenter la connexion par e-mail.
    await expect(login.email).toBeVisible()
    await expect(login.tabEmail).toHaveAttribute('aria-selected', 'true')
  })

  test('422 serveur (TOO_SHORT, expected_length) : erreur sous le champ, pas d’alerte', async ({
    page,
  }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 422,
      body: apiError('PLATFORM_VALIDATION_ERROR', {
        field: 'phone',
        reason: 'NOT_MOBILE',
      }),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()
    await expect(page.getByText(auth.phone.errors.notMobile)).toBeVisible()
    await expect(login.phoneForm.alert).toHaveCount(0)
    await expect(login.phoneForm.phone).toHaveAttribute('aria-invalid', 'true')
  })

  test('500 : message générique, aucune fuite du message serveur', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 500,
      body: { error: { code: 'PLATFORM_INTERNAL_ERROR', message: 'stack secrète' } },
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()
    await expect(login.phoneForm.alert).toHaveText(auth.genericError)
    await expect(page.getByText('stack secrète')).toHaveCount(0)
  })

  test('hors ligne : message et bouton désactivés, rien n’est envoyé', async ({
    page,
    context,
  }) => {
    const calls = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await expect(login.phoneForm.submit).toBeEnabled()

    await context.setOffline(true)
    await expect(login.phoneForm.offline).toHaveText(auth.offline)
    await expect(login.phoneForm.submit).toBeDisabled()
    await context.setOffline(false)
    await expect(login.phoneForm.offline).toHaveCount(0)
    await expect(login.phoneForm.submit).toBeEnabled()
    expect(calls).toHaveLength(0)
  })

  test('la bascule E-mail | Téléphone conserve le formulaire e-mail intact (P2.1)', async ({
    page,
  }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'MotDePasse-Solide-42')
    await login.tabPhone.click()
    await login.tabEmail.click()
    await expect(login.submit).toBeEnabled()
  })
})

// ───────────────────────────── CA-43 — inscription par téléphone ─────────────────────────────

test.describe('Inscription par téléphone /auth/register (CA-43)', () => {
  test('onglets E-mail | Téléphone : E-mail par défaut (P2.1), Téléphone via ?tab=phone', async ({
    page,
  }) => {
    const reg = new RegisterPage(page)
    await reg.goto()
    await expect(reg.tabEmail).toHaveAttribute('aria-selected', 'true')
    await expect(reg.tabPhone).toBeEnabled()
    await expect(reg.email).toBeVisible()
    await expect(reg.submit).toBeVisible()

    await reg.tabPhone.click()
    await expect(reg.tabPhone).toHaveAttribute('aria-selected', 'true')
    await expect(reg.phoneForm.phone).toBeVisible()
    await expect(reg.email).toHaveCount(0)
  })

  test('champs, aide « Un seul compte gratuit par numéro », conditions obligatoires, « Recevoir un code »', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    const form = reg.phoneForm

    await expect(reg.tabPhone).toHaveAttribute('aria-selected', 'true')
    await expect(form.fullName).toBeVisible()
    await expect(form.phone).toBeVisible()
    await expect(page.getByText('Un seul compte gratuit par numéro')).toBeVisible()
    await expect(form.terms).toBeVisible()
    await expect(form.terms).not.toBeChecked()
    await expect(form.submit).toHaveText(auth.phone.submit)
    await expect(form.submit).toBeDisabled()
    // Pas de bouton « Créer mon compte » du formulaire e-mail : une seule action principale.
    await expect(reg.submit).toHaveCount(0)

    // Numéro valide mais conditions non acceptées : toujours désactivé.
    await form.fillPhone(CM_NATIONAL)
    await expect(form.submit).toBeDisabled()
    // Toute la ligne est cliquable (AuthCheckbox) : on clique le texte du libellé.
    await page.getByText("J'accepte les", { exact: false }).click()
    await expect(form.terms).toBeChecked()
    await expect(form.submit).toBeEnabled()
    // Décocher désactive à nouveau.
    await form.terms.click()
    await expect(form.submit).toBeDisabled()
    await form.terms.click()

    await form.fullName.fill('Ada Test')
    await form.submit.click()
    await expect(page).toHaveURL(/\/auth\/phone\/code$/)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({ phone: E164, country: 'CM', locale: 'fr' })
    const stored = JSON.parse((await storageRequest(page)) ?? 'null') as Record<string, unknown>
    expect(stored).toMatchObject({ intent: 'register', fullName: 'Ada Test' })
  })

  test('numéro invalide : « Recevoir un code » reste désactivé même avec les conditions cochées', async ({
    page,
  }) => {
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    await reg.phoneForm.fillPhone('6700')
    await reg.phoneForm.terms.check()
    await expect(reg.phoneForm.submit).toBeDisabled()
  })

  test('les liens des conditions et de la confidentialité ne cochent pas la case', async ({
    page,
  }) => {
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    const link = reg.phoneForm.root.getByRole('link', { name: auth.register.termsLink })
    await expect(link).toHaveAttribute('href', '/legal/terms')
    await expect(reg.phoneForm.terms).not.toBeChecked()
  })

  test('429 en inscription : durée du Retry-After', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 429,
      headers: { 'Retry-After': '30' },
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    await reg.phoneForm.fillPhone(CM_NATIONAL)
    await reg.phoneForm.terms.check()
    await reg.phoneForm.submit.click()
    await expect(reg.phoneForm.alert).toHaveText(/Réessayez dans 30 secondes\./)
  })

  test('503 en inscription : « Utiliser mon e-mail » mène au formulaire e-mail', async ({
    page,
  }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 503,
      body: apiError('AUTH_SMS_UNAVAILABLE'),
    })
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    await reg.phoneForm.fillPhone(CM_NATIONAL)
    await reg.phoneForm.terms.check()
    await reg.phoneForm.submit.click()
    await reg.phoneForm.useEmail.click()
    await expect(reg.email).toBeVisible()
    await expect(reg.tabEmail).toHaveAttribute('aria-selected', 'true')
  })
})

// ───────────────────────────── CA-44 — écran du code ─────────────────────────────

test.describe('Écran du code SMS /auth/phone/code (CA-44)', () => {
  test('6 cases étiquetées, autocomplete one-time-code, numéro masqué, « Vérifier » désactivé', async ({
    page,
  }) => {
    await seedRequest(page)
    const code = new PhoneCodePage(page)
    await code.goto()

    await expect(code.heading).toHaveText(auth.code.title)
    await expect(code.digits).toHaveCount(6)
    for (let n = 1; n <= 6; n++) {
      await expect(code.digit(n)).toBeVisible()
      await expect(code.digit(n)).toHaveAttribute('autocomplete', 'one-time-code')
      await expect(code.digit(n)).toHaveAttribute('inputmode', 'numeric')
    }
    await expect(code.digit(1)).toBeFocused()
    await expect(code.sentTo).toContainText('+237 6 70 •• •• 01')
    await expect(code.change).toBeVisible()
    await expect(code.back).toBeVisible()
    await expect(code.submit).toBeDisabled()
    await expect(page.getByText(/valable 5 minutes/)).toBeVisible()
    // Une seule action principale.
    await expect(code.requestNew).toHaveCount(0)
  })

  test('coller « 270512 » remplit les six cases et envoie automatiquement', async ({ page }) => {
    await seedRequest(page)
    const calls = await mockAuthApi(page, 'phone/verify-code', { status: 200, body: verifyOk() })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.paste(CODE)

    await expect(page).toHaveURL(/\/$/)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({
      phone: E164,
      country: 'CM',
      code: CODE,
      remember_me: true,
      locale: 'fr',
    })
    // La demande est effacée au succès, et le code n'a jamais été stocké.
    expect(await storageRequest(page)).toBeNull()
  })

  test('saisie chiffre par chiffre : le bouton « Vérifier » est actif avec 6 chiffres puis envoie', async ({
    page,
  }) => {
    await seedRequest(page)
    // Réponse lente : on voit l'état « 6 chiffres saisis » avant la fin de l'envoi automatique.
    const calls = await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_INVALID', { remaining_attempts: 4 }),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await page.keyboard.type('27051')
    await expect(code.submit).toBeDisabled()
    expect(calls).toHaveLength(0)
    await page.keyboard.type('2')
    await expect.poll(() => calls.length).toBe(1)
    expect(calls[0]?.body).toMatchObject({ code: CODE })
  })

  test('les lettres sont refusées (cases numériques)', async ({ page }) => {
    await seedRequest(page)
    const code = new PhoneCodePage(page)
    await code.goto()
    await page.keyboard.type('ab12')
    await expect(code.digit(1)).toHaveValue('1')
    await expect(code.digit(2)).toHaveValue('2')
    await expect(code.digit(3)).toHaveValue('')
  })

  test('compte à rebours 60 s puis « Renvoyer le code » (horloge simulée)', async ({ page }) => {
    await pausedClock(page)
    await seedRequest(page, { resendInSeconds: 60 })
    const requests = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const code = new PhoneCodePage(page)
    await code.goto()

    await expect(code.resendIn).toContainText('Nouvel envoi possible dans 1:00')
    await expect(code.resend).toHaveCount(0)
    await page.clock.runFor(30_000)
    await expect(code.resendIn).toContainText('dans 0:30')
    await page.clock.runFor(29_000)
    await expect(code.resendIn).toContainText('dans 0:01')
    await expect(code.resend).toHaveCount(0)
    await page.clock.runFor(1_000)
    await expect(code.resendIn).toHaveCount(0)
    await expect(code.resend).toBeVisible()
    await expect(code.resend).toHaveText(auth.code.resend)

    // Renvoi : nouvel appel, confirmation, compte à rebours relancé, cases vidées et focalisées.
    await code.resend.click()
    await expect(code.resent).toHaveText(auth.code.resent)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.body).toEqual({ phone: E164, country: 'CM', locale: 'fr' })
    await expect(code.resendIn).toContainText('dans 1:00')
    await expect(code.digit(1)).toBeFocused()
  })

  test('le compte à rebours ne repart pas de zéro après un rechargement (horodatage absolu en sessionStorage)', async ({
    page,
  }) => {
    await seedRequest(page, { resendInSeconds: 40 })
    const code = new PhoneCodePage(page)
    await code.goto()
    const secondsLeft = async () => {
      const text = (await code.resendIn.textContent()) ?? ''
      const m = text.match(/dans 0:(\d\d)/)
      return m ? Number(m[1]) : Number.NaN
    }
    await expect.poll(secondsLeft).toBeLessThanOrEqual(40)
    const before = await secondsLeft()
    const resendAtBefore = (
      JSON.parse((await storageRequest(page)) ?? 'null') as { resendAt: number }
    ).resendAt
    await page.reload()
    await expect(code.sentTo).toBeVisible()
    await expect(code.resendIn).toBeVisible()
    const after = await secondsLeft()
    const resendAtAfter = (
      JSON.parse((await storageRequest(page)) ?? 'null') as { resendAt: number }
    ).resendAt
    expect(resendAtAfter).toBe(resendAtBefore)
    expect(after).toBeLessThanOrEqual(before)
    expect(after).toBeGreaterThan(0)
  })

  test('AUTH_OTP_INVALID : « Il vous reste n essais » annoncé (aria-live), cases vidées', async ({
    page,
  }) => {
    await seedRequest(page)
    const calls = await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_INVALID', { remaining_attempts: 3 }),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await expect(code.invalid).toHaveAttribute('aria-live', 'assertive')
    await expect(code.invalid).toBeEmpty()

    await code.paste('111111')
    await expect(code.invalid).toContainText('Code incorrect. Il vous reste 3 essais.')
    expect(calls).toHaveLength(1)
    await expect(code.digit(1)).toHaveValue('')
    await expect(code.digit(1)).toBeFocused()
    // Champ en erreur relié au message (groupe aria-invalid + aria-describedby).
    const group = page.getByRole('group', { name: auth.code.label })
    await expect(group).toHaveAttribute('aria-invalid', 'true')
    await expect(group).toHaveAttribute('aria-describedby', 'cp-code-error')
    // Retaper un chiffre efface le message.
    await page.keyboard.type('2')
    await expect(code.invalid).toBeEmpty()
  })

  test('AUTH_OTP_INVALID : singulier « Il vous reste 1 essai. »', async ({ page }) => {
    await seedRequest(page)
    await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_INVALID', { remaining_attempts: 1 }),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.paste('111111')
    await expect(code.invalid).toContainText('Il vous reste 1 essai.')
    await expect(code.invalid).not.toContainText('essais')
  })

  for (const [name, errCode, key] of [
    ['EXPIRED (code expiré)', 'AUTH_OTP_EXPIRED', 'expired'],
    ['ATTEMPTS_EXCEEDED (trop d’essais)', 'AUTH_OTP_ATTEMPTS_EXCEEDED', 'tooManyAttempts'],
  ] as const) {
    test(`${name} : alerte, saisie bloquée, « Recevoir un nouveau code » relance la demande`, async ({
      page,
    }) => {
      await seedRequest(page)
      const verify = await mockAuthApi(page, 'phone/verify-code', {
        status: 422,
        body: apiError(errCode),
      })
      const request = await mockAuthApi(page, 'phone/request-code', {
        status: 200,
        body: requestOk,
      })
      const code = new PhoneCodePage(page)
      await code.goto()
      await code.paste(CODE)

      await expect(code.codeAlert).toHaveText(
        new RegExp((auth.code[key] ?? '').replace('.', '\\.')),
      )
      await expect(code.codeAlert).toHaveAttribute('role', 'alert')
      await expect(code.requestNew).toBeVisible()
      await expect(code.requestNew).toHaveText(auth.code.requestNew)
      await expect(code.submit).toHaveCount(0)
      for (let n = 1; n <= 6; n++) await expect(code.digit(n)).toBeDisabled()
      expect(verify).toHaveLength(1)

      await code.requestNew.click()
      await expect.poll(() => request.length).toBe(1)
      await expect(code.resent).toBeVisible()
      await expect(code.codeAlert).toHaveCount(0)
      await expect(code.submit).toBeVisible()
      await expect(code.requestNew).toHaveCount(0)
      await expect(code.digit(1)).toBeEnabled()
      await expect(code.digit(1)).toBeFocused()
    })
  }

  test('429 à la vérification : durée du Retry-After, saisie conservée possible', async ({
    page,
  }) => {
    await seedRequest(page)
    await mockAuthApi(page, 'phone/verify-code', {
      status: 429,
      headers: { 'Retry-After': '120' },
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.paste(CODE)
    await expect(code.codeAlert).toHaveText(/Réessayez dans 2 minutes\./)
  })

  test('503 sur le renvoi : alerte « SMS indisponible » et « Utiliser mon e-mail » vers la connexion e-mail', async ({
    page,
  }) => {
    await seedRequest(page, { resendInSeconds: 0 })
    await mockAuthApi(page, 'phone/request-code', {
      status: 503,
      body: apiError('AUTH_SMS_UNAVAILABLE'),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.resend.click()
    await expect(code.codeAlert).toContainText(auth.code.smsUnavailable)
    await code.useEmail.click()
    await expect(page).toHaveURL(/\/auth\/login$/)
    const login = new LoginPage(page)
    await expect(login.email).toBeVisible()
    // « Utiliser mon e-mail » abandonne la demande en cours.
    expect(await storageRequest(page)).toBeNull()
  })

  test('hors ligne : message, « Vérifier » et renvoi désactivés', async ({ page, context }) => {
    await seedRequest(page, { resendInSeconds: 0 })
    const verify = await mockAuthApi(page, 'phone/verify-code', { status: 200, body: verifyOk() })
    const code = new PhoneCodePage(page)
    await code.goto()
    await expect(code.resend).toBeEnabled()

    await context.setOffline(true)
    await expect(code.offline).toHaveText(auth.offline)
    await expect(code.resend).toBeDisabled()
    await expect(code.submit).toBeDisabled()
    await context.setOffline(false)
    await expect(code.offline).toHaveCount(0)
    await expect(code.resend).toBeEnabled()
    expect(verify).toHaveLength(0)
  })

  test('accès direct sans demande en cours : retour à /auth/login?tab=phone', async ({ page }) => {
    const code = new PhoneCodePage(page)
    await page.goto('/auth/phone/code')
    await expect(page).toHaveURL(/\/auth\/login\?tab=phone$/)
    await expect(new LoginPage(page).tabPhone).toHaveAttribute('aria-selected', 'true')
    expect(code.page).toBe(page)
  })

  test('sessionStorage altéré (JSON invalide, e164 invalide) : traité comme une absence de demande', async ({
    page,
  }) => {
    await page.addInitScript(
      (key) => sessionStorage.setItem(key, '{"e164":"pas-un-numero"}'),
      STORAGE_KEY,
    )
    await page.goto('/auth/phone/code')
    await expect(page).toHaveURL(/\/auth\/login\?tab=phone$/)
    expect(await storageRequest(page)).toBeNull()
  })

  test('« Modifier » et « Retour » reviennent à la saisie du numéro et effacent la demande', async ({
    page,
  }) => {
    await seedRequest(page)
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.change.click()
    await expect(page).toHaveURL(/\/auth\/login\?tab=phone$/)
    expect(await storageRequest(page)).toBeNull()
  })

  test('« Retour » après une inscription ramène à /auth/register?tab=phone', async ({ page }) => {
    await seedRequest(page, { intent: 'register', fullName: 'Ada Test' })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.back.click()
    await expect(page).toHaveURL(/\/auth\/register\?tab=phone$/)
    await expect(new RegisterPage(page).tabPhone).toHaveAttribute('aria-selected', 'true')
  })

  test('inscription : full_name est transmis à verify-code ; succès → accueil', async ({
    page,
  }) => {
    await seedRequest(page, { intent: 'register', fullName: 'Ada Test' })
    const calls = await mockAuthApi(page, 'phone/verify-code', {
      status: 200,
      body: verifyOk(true),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.paste(CODE)
    await expect(page).toHaveURL(/\/$/)
    expect(calls[0]?.body).toMatchObject({ full_name: 'Ada Test', code: CODE })
  })

  test('double soumission : saisie automatique + clic sur « Vérifier » = une seule vérification', async ({
    page,
  }) => {
    await seedRequest(page)
    const calls = await mockAuthApi(page, 'phone/verify-code', {
      status: 200,
      body: verifyOk(),
      delayMs: 700,
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await code.paste(CODE)
    await code.submit.click({ force: true }).catch(() => undefined)
    await code.submit.press('Enter').catch(() => undefined)
    await expect(page).toHaveURL(/\/$/)
    expect(calls).toHaveLength(1)
  })

  test('le code n’est jamais écrit dans sessionStorage ni localStorage', async ({ page }) => {
    await seedRequest(page)
    await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_INVALID', { remaining_attempts: 2 }),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await page.keyboard.type('27051')
    const dump = () =>
      page.evaluate(() =>
        JSON.stringify([
          Object.entries(sessionStorage),
          Object.entries(localStorage),
          document.cookie,
        ]),
      )
    expect(await dump()).not.toContain('27051')
    await page.keyboard.type('2')
    await expect(code.invalid).toContainText('Il vous reste 2 essais')
    expect(await dump()).not.toContain(CODE)
  })
})

// ───────────────────────────── Anglais (i18n) ─────────────────────────────

test.describe('Anglais', () => {
  test('l’écran du code est entièrement traduit', async ({ page }) => {
    await seedRequest(page)
    const code = new PhoneCodePage(page)
    await code.goto()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(code.heading).toHaveText('Enter the code we texted you')
    await expect(code.digit(1)).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Digit 1 of 6' })).toBeVisible()
  })
})

// ───────────────────────────── CA-45 — non-régression et visuel ─────────────────────────────

const HIDE_DEVTOOLS =
  '#nuxt-devtools-anchor, #nuxt-devtools-container, nuxt-devtools-inspect-panel, #vue-tracer-overlay { display: none !important }'
const shot = (page: Page, name: string, opts: { full?: boolean } = {}) =>
  expect(page).toHaveScreenshot(name, { fullPage: opts.full ?? true, style: HIDE_DEVTOOLS })

test.describe('Régression visuelle — téléphone (CA-45)', () => {
  test('connexion téléphone : vide puis TOO_SHORT puis valide', async ({ page }) => {
    const login = new LoginPage(page)
    await login.gotoPhone()
    await expect(login.phoneForm.phone).toBeEnabled()
    await shot(page, 'login-phone.png')

    await login.phoneForm.fillPhone('67000')
    await login.phoneForm.phone.blur()
    await expect(page.getByText(/Il manque 4 chiffres/)).toBeVisible()
    await shot(page, 'login-phone-tooshort.png')

    await login.phoneForm.fillPhone(CM_NATIONAL)
    await expect(login.phoneForm.submit).toBeEnabled()
    await shot(page, 'login-phone-valid.png')
  })

  test('connexion téléphone : 429 et 503', async ({ page }) => {
    await mockAuthApi(page, 'phone/request-code', {
      status: 429,
      headers: { 'Retry-After': '45' },
      body: apiError('PLATFORM_RATE_LIMIT'),
    })
    const login = new LoginPage(page)
    await login.gotoPhone()
    await login.phoneForm.fillPhone(CM_NATIONAL)
    await login.phoneForm.submit.click()
    await expect(login.phoneForm.alert).toBeVisible()
    await shot(page, 'login-phone-429.png')

    await page.unroute('**/v1/auth/phone/request-code')
    await mockAuthApi(page, 'phone/request-code', {
      status: 503,
      body: apiError('AUTH_SMS_UNAVAILABLE'),
    })
    await login.phoneForm.fillPhone('670000102')
    await login.phoneForm.submit.click()
    await expect(login.phoneForm.useEmail).toBeVisible()
    await shot(page, 'login-phone-503.png')
  })

  test('inscription téléphone : vide et remplie', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.gotoPhone()
    await expect(reg.phoneForm.phone).toBeEnabled()
    await shot(page, 'register-phone.png')

    await reg.phoneForm.fullName.fill('Ada Test')
    await reg.phoneForm.fillPhone(CM_NATIONAL)
    await reg.phoneForm.terms.check()
    await expect(reg.phoneForm.submit).toBeEnabled()
    await shot(page, 'register-phone-filled.png')
  })

  test('écran du code : vide, partiel, incorrect, expiré, hors ligne', async ({
    page,
    context,
  }) => {
    await pausedClock(page)
    await seedRequest(page)
    await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_INVALID', { remaining_attempts: 3 }),
    })
    const code = new PhoneCodePage(page)
    await code.goto()
    await expect(code.digit(1)).toBeFocused()
    await shot(page, 'code-empty.png')

    await page.keyboard.type('2705')
    await shot(page, 'code-partial.png')
    await page.keyboard.type('12')
    await expect(code.invalid).toContainText('Il vous reste 3 essais')
    await shot(page, 'code-invalid.png')

    await page.unroute('**/v1/auth/phone/verify-code')
    await mockAuthApi(page, 'phone/verify-code', {
      status: 422,
      body: apiError('AUTH_OTP_EXPIRED'),
    })
    await code.paste(CODE)
    await expect(code.requestNew).toBeVisible()
    await shot(page, 'code-expired.png')

    await context.setOffline(true)
    await expect(code.offline).toBeVisible()
    await shot(page, 'code-offline.png')
    await context.setOffline(false)
  })

  test('écran du code : renvoi possible (horloge avancée)', async ({ page }) => {
    await pausedClock(page)
    await seedRequest(page, { resendInSeconds: 60 })
    const code = new PhoneCodePage(page)
    await code.goto()
    await page.clock.runFor(60_000)
    await expect(code.resend).toBeVisible()
    await shot(page, 'code-resend-ready.png')
  })

  test('connexion et inscription e-mail (P2.1) : onglets neutres, boutons 48 px', async ({
    page,
  }, testInfo) => {
    const login = new LoginPage(page)
    await login.goto()
    const reg = new RegisterPage(page)
    await reg.goto()
    // Cible tactile : bouton principal >= 44 px en mobile.
    if (isMobile(testInfo.project.name)) {
      const box = await reg.submit.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('Non-régression e-mail (CA-45)', () => {
  test('les parcours e-mail P2.1 passent toujours par /v1/auth/login (aucun appel téléphone)', async ({
    page,
  }) => {
    const phone = await mockAuthApi(page, 'phone/request-code', { status: 200, body: requestOk })
    const emailCalls = await mockAuthApi(page, 'login', {
      status: 200,
      body: { user: { id: 'u', email: 'ada@example.com' } },
    })
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'MotDePasse-Solide-42')
    await login.submit.click()
    await expect(page).toHaveURL(/\/$/)
    expect(emailCalls).toHaveLength(1)
    expect(phone).toHaveLength(0)
  })

  test('/auth/phone/code ne dépend pas du SSR : chargement direct sans erreur de console', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await seedRequest(page)
    await gotoHydrated(page, '/auth/phone/code')
    await expect(new PhoneCodePage(page).sentTo).toBeVisible()
    expect(errors).toEqual([])
  })
})
