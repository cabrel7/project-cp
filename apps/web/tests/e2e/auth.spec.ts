import { expect, test } from '@playwright/test'
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AuthPages'
import { auth, authText, gotoHydrated, isDark, isMobile, mockAuthApi } from './pages/helpers'

// P2.1 — pages d'authentification, front seul. L'API est absente : /v1/auth/** est simulé par page.route.
// Les tests s'exécutent dans 4 projets (desktop/mobile x clair/sombre) ; les assertions propres à un
// viewport ou à un schéma de couleurs sont conditionnées au nom du projet.

// La pastille Nuxt DevTools (mode dev) affiche un temps de rendu variable : masquée dans les captures.
const HIDE_DEVTOOLS = '#nuxt-devtools-anchor { display: none !important }'

test.describe('Connexion /auth/login', () => {
  test('affiche titre, champs, case « rester connecté », onglets et boutons sociaux désactivés', async ({
    page,
  }) => {
    const login = new LoginPage(page)
    await login.goto()

    await expect(page).toHaveTitle(auth.login.title)
    await expect(login.heading).toHaveText(auth.login.title)
    await expect(login.email).toBeVisible()
    await expect(login.email).toHaveAttribute('type', 'email')
    await expect(login.password).toBeVisible()
    await expect(login.password).toHaveAttribute('type', 'password')
    await expect(login.rememberMe).toBeVisible()
    await expect(login.rememberMe).toBeChecked()

    await expect(login.tabEmail).toHaveAttribute('aria-selected', 'true')
    await expect(login.tabPhone).toBeDisabled()

    await expect(login.google).toBeDisabled()
    await expect(login.apple).toBeDisabled()
    await expect(login.passkey).toBeDisabled()
  })

  test('bouton désactivé tant que e-mail ET mot de passe ne sont pas saisis', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()

    await expect(login.submit).toBeDisabled()
    await login.email.fill('ada@example.com')
    await expect(login.submit).toBeDisabled()
    await login.password.fill('secret')
    await expect(login.submit).toBeEnabled()
    await login.email.fill('')
    await expect(login.submit).toBeDisabled()
  })

  test('bascule afficher / masquer le mot de passe', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.password.fill('secret')

    await login.showPasswordToggle.click()
    await expect(login.password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: auth.password.hide }).click()
    await expect(login.password).toHaveAttribute('type', 'password')
  })

  test("identifiants invalides : alerte d'erreur localisée, aucun message brut du serveur", async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'login', {
      status: 401,
      body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'raw server message' } },
    })
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'wrong-password')
    await login.submit.click()

    await expect(login.alert).toContainText(auth.login.invalidCredentials)
    await expect(login.alert).not.toContainText('raw server message')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({
      email: 'ada@example.com',
      password: 'wrong-password',
      remember_me: true,
    })
    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test('API injoignable (500) : message générique', async ({ page }) => {
    await mockAuthApi(page, 'login', { status: 500 })
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'secret')
    await login.submit.click()
    await expect(login.alert).toContainText(authText('genericError'))
  })

  test('trop de tentatives (429) : message de limitation', async ({ page }) => {
    await mockAuthApi(page, 'login', { status: 429, body: { error: { code: 'RATE_LIMITED' } } })
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'secret')
    await login.submit.click()
    await expect(login.alert).toContainText(authText('rateLimited'))
  })

  test('double soumission : une seule requête tant que la première est en cours', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'login', {
      status: 401,
      body: { error: { code: 'AUTH_INVALID_CREDENTIALS' } },
      delayMs: 1500,
    })
    const login = new LoginPage(page)
    await login.goto()
    await login.fill('ada@example.com', 'secret')
    await login.submit.click()
    // Le bouton passe en chargement (désactivé) : un second clic ne doit pas partir.
    await expect(login.submit).toBeDisabled()
    await login.password.press('Enter')
    await expect(login.alert).toBeVisible()
    expect(calls).toHaveLength(1)
  })

  test('« Mot de passe oublié ? » mène à /auth/forgot-password', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.forgotLink.click()
    await expect(page).toHaveURL(/\/auth\/forgot-password$/)
    await expect(new ForgotPasswordPage(page).heading).toHaveText(auth.forgot.title)
  })

  test('« Créer un compte » mène à /auth/register', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.registerLink.click()
    await expect(page).toHaveURL(/\/auth\/register$/)
    await expect(new RegisterPage(page).heading).toHaveText(auth.register.title)
  })
})

test.describe('Inscription /auth/register', () => {
  test('affiche titre, champs, conditions et boutons sociaux désactivés', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.goto()

    await expect(page).toHaveTitle(auth.register.title)
    await expect(reg.heading).toHaveText(auth.register.title)
    await expect(reg.fullName).toBeVisible()
    await expect(reg.email).toBeVisible()
    await expect(reg.password).toBeVisible()
    await expect(reg.terms).toBeVisible()
    await expect(reg.terms).not.toBeChecked()
    await expect(reg.google).toBeDisabled()
    await expect(reg.apple).toBeDisabled()
    await expect(reg.submit).toBeDisabled()
  })

  test('la jauge de robustesse suit la saisie', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.goto()

    await expect(reg.strengthLabel).toHaveCount(0)
    await expect(reg.strength).toContainText(auth.password.minChars.replace('{n}', '8'))

    const steps: Array<[string, string]> = [
      ['abcdefgh', auth.password.weak],
      ['Abcdefgh', auth.password.medium],
      ['Abcdefg1', auth.password.strong],
      ['Abcdefghij12', auth.password.veryStrong],
    ]
    for (const [value, label] of steps) {
      await reg.password.fill(value)
      await expect(reg.strengthLabel).toHaveText(label)
    }
    await reg.password.fill('')
    await expect(reg.strengthLabel).toHaveCount(0)
  })

  test('bouton actif seulement avec e-mail, mot de passe >= 8 et conditions acceptées', async ({
    page,
  }) => {
    const reg = new RegisterPage(page)
    await reg.goto()

    await reg.fullName.fill('Ada Lovelace')
    await reg.email.fill('ada@example.com')
    await reg.password.fill('short')
    await reg.terms.check()
    await expect(reg.submit).toBeDisabled() // mot de passe trop court

    await reg.password.fill('longenough1')
    await expect(reg.submit).toBeEnabled()

    await reg.terms.uncheck()
    await expect(reg.submit).toBeDisabled() // conditions non acceptées
  })

  test('inscription réussie : écran de confirmation « vérifiez votre e-mail »', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'register', { status: 200, body: { ok: true } })
    const reg = new RegisterPage(page)
    await reg.goto()
    await reg.fullName.fill('Ada Lovelace')
    await reg.email.fill('ada@example.com')
    await reg.password.fill('longenough1')
    await reg.terms.check()
    await reg.submit.click()

    await expect(page.getByRole('status')).toContainText(auth.register.sent)
    await expect(page.getByRole('status')).toContainText(auth.register.sentDetail)
    await expect(reg.submit).toHaveCount(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({
      email: 'ada@example.com',
      password: 'longenough1',
      full_name: 'Ada Lovelace',
    })
  })

  test('« Se connecter » mène à /auth/login', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.goto()
    await reg.signInLink.click()
    await expect(page).toHaveURL(/\/auth\/login$/)
    await expect(new LoginPage(page).heading).toHaveText(auth.login.title)
  })
})

test.describe('Mot de passe oublié /auth/forgot-password', () => {
  test('affiche le champ e-mail et le bouton, désactivé tant que vide', async ({ page }) => {
    const forgot = new ForgotPasswordPage(page)
    await forgot.goto()

    await expect(forgot.heading).toHaveText(auth.forgot.title)
    await expect(forgot.email).toBeVisible()
    await expect(forgot.submit).toBeDisabled()
    await forgot.email.fill('ada@example.com')
    await expect(forgot.submit).toBeEnabled()
    await expect(forgot.backLink).toHaveAttribute('href', '/auth/login')
  })

  test('après envoi : alerte de succès, « ouvrir ma messagerie » et « renvoyer »', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, 'forgot-password', { status: 200 })
    const forgot = new ForgotPasswordPage(page)
    await forgot.goto()
    await forgot.email.fill('ada@example.com')
    await forgot.submit.click()

    await expect(forgot.sent).toContainText(auth.forgot.sent)
    await expect(forgot.sent).toContainText(auth.forgot.sentDetail)
    await expect(forgot.openMail).toBeVisible()
    await expect(forgot.openMail).toHaveAttribute('href', 'mailto:')
    await expect(forgot.resend).toBeVisible()
    await expect(forgot.submit).toHaveCount(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({ email: 'ada@example.com' })

    await forgot.resend.click()
    await expect.poll(() => calls.length).toBe(2)
  })

  test('limitation de débit (429) : pas de faux succès', async ({ page }) => {
    await mockAuthApi(page, 'forgot-password', {
      status: 429,
      body: { error: { code: 'RATE_LIMITED' } },
    })
    const forgot = new ForgotPasswordPage(page)
    await forgot.goto()
    await forgot.email.fill('ada@example.com')
    await forgot.submit.click()
    await expect(forgot.alert).toContainText(authText('rateLimited'))
    await expect(forgot.sent).toHaveCount(0)
  })
})

test.describe('Nouveau mot de passe /auth/reset-password', () => {
  test('avec jeton : champs, jauge, aucune alerte, bouton désactivé', async ({ page }) => {
    const reset = new ResetPasswordPage(page)
    await reset.goto('abc123')

    await expect(reset.heading).toHaveText(auth.reset.title)
    await expect(reset.alert).toHaveCount(0)
    await expect(reset.password).toBeVisible()
    await expect(reset.confirm).toBeVisible()
    await expect(reset.strength).toBeVisible()
    await expect(reset.submit).toBeDisabled()

    await reset.password.fill('Abcdefghij12')
    await expect(reset.strength).toContainText(auth.password.veryStrong)
  })

  test("sans jeton : alerte d'erreur avec lien « demander un nouveau lien », envoi impossible", async ({
    page,
  }) => {
    const reset = new ResetPasswordPage(page)
    await reset.goto()

    await expect(reset.alert).toContainText(auth.reset.invalidToken)
    await expect(reset.requestNewLink).toHaveAttribute('href', '/auth/forgot-password')
    await reset.password.fill('longenough1')
    await reset.confirm.fill('longenough1')
    await expect(reset.submit).toBeDisabled()
  })

  test('confirmation différente : erreur sur le champ, bouton désactivé puis actif quand identique', async ({
    page,
  }) => {
    const reset = new ResetPasswordPage(page)
    await reset.goto('abc123')

    await reset.password.fill('longenough1')
    await reset.confirm.fill('longenough')
    await expect(reset.mismatch).toBeVisible()
    await expect(reset.submit).toBeDisabled()

    await reset.confirm.fill('longenough1')
    await expect(reset.mismatch).toHaveCount(0)
    await expect(reset.submit).toBeEnabled()
  })

  test('jeton expiré (400) : alerte localisée', async ({ page }) => {
    const calls = await mockAuthApi(page, 'reset-password', {
      status: 400,
      body: { error: { code: 'AUTH_TOKEN_EXPIRED' } },
    })
    const reset = new ResetPasswordPage(page)
    await reset.goto('expired')
    await reset.password.fill('longenough1')
    await reset.confirm.fill('longenough1')
    await reset.submit.click()
    await expect(reset.alert).toContainText(auth.reset.invalidToken)
    expect(calls[0]?.body).toEqual({
      token: 'expired',
      password: 'longenough1',
    })
  })

  test('succès : confirmation et lien vers la connexion', async ({ page }) => {
    await mockAuthApi(page, 'reset-password', { status: 200 })
    const reset = new ResetPasswordPage(page)
    await reset.goto('ok-token')
    await reset.password.fill('longenough1')
    await reset.confirm.fill('longenough1')
    await reset.submit.click()
    await expect(page.getByRole('status')).toContainText(auth.reset.success)
    await expect(page.getByRole('link', { name: auth.verify.goToLogin })).toHaveAttribute(
      'href',
      '/auth/login',
    )
  })
})

test.describe('Vérification e-mail /auth/verify-email', () => {
  test('jeton en cours de vérification : état de chargement puis erreur (jeton invalide)', async ({
    page,
  }) => {
    await mockAuthApi(page, 'verify-email', {
      status: 400,
      body: { error: { code: 'AUTH_VERIFICATION_TOKEN_INVALID' } },
      delayMs: 2500,
    })
    const verify = new VerifyEmailPage(page)
    await verify.goto('?token=bad')

    await expect(verify.heading).toHaveText(auth.verify.title)
    await expect(verify.loading).toBeVisible()
    await expect(verify.goToLogin).toHaveCount(0)
    await expect(verify.error).toBeVisible()
    await expect(verify.alert).toBeVisible()
    await expect(verify.loading).toHaveCount(0)
    await expect(verify.goToLogin).toHaveAttribute('href', '/auth/login')
  })

  test('sans jeton : erreur directe, aucun appel API', async ({ page }) => {
    const calls = await mockAuthApi(page, 'verify-email', { status: 200 })
    const verify = new VerifyEmailPage(page)
    await verify.goto()
    await expect(verify.error).toBeVisible()
    await expect(verify.goToLogin).toBeVisible()
    expect(calls).toHaveLength(0)
  })

  test('jeton valide : message de succès', async ({ page }) => {
    await mockAuthApi(page, 'verify-email', { status: 200 })
    const verify = new VerifyEmailPage(page)
    await verify.goto('?token=good')
    await expect(verify.success).toBeVisible()
    await expect(verify.goToLogin).toBeVisible()
  })
})

test.describe('Responsive', () => {
  test('panneau gauche masqué en mobile (visible en desktop) ; le formulaire occupe la largeur', async ({
    page,
  }, info) => {
    const login = new LoginPage(page)
    await login.goto()
    const viewport = page.viewportSize()
    expect(viewport).not.toBeNull()

    if (isMobile(info.project.name)) {
      expect(viewport?.width).toBe(375)
      await expect(login.leftPanel).toBeHidden()
      const box = await page.locator('main').boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(375 - 1)
      const field = await login.email.boundingBox()
      // Marge de page p-4 (16 px) de chaque côté : le champ prend le reste de la largeur.
      expect(field?.width).toBeGreaterThanOrEqual(375 - 2 * 24 - 2)
    } else {
      await expect(login.leftPanel).toBeVisible()
    }
    // Jamais de défilement horizontal, quel que soit le viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  for (const path of [
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password?token=t',
    '/auth/verify-email',
  ]) {
    test(`${path} : pas de débordement horizontal`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' })
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test.describe('Mode clair / sombre', () => {
  const pages = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password?token=t',
    '/auth/verify-email',
  ]

  for (const path of pages) {
    test(`${path} : schéma de couleurs appliqué, texte lisible sur le fond`, async ({
      page,
    }, info) => {
      await mockAuthApi(page, 'verify-email', { status: 400 })
      await gotoHydrated(page, path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const html = page.locator('html')
      if (isDark(info.project.name)) await expect(html).toHaveClass(/(^|\s)dark(\s|$)/)
      else await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/)

      const colors = await page.evaluate(() => {
        const h1 = document.querySelector('h1') as HTMLElement
        const root = (h1.closest('[data-cp-layout-login]') ??
          h1.closest('div.min-h-dvh')) as HTMLElement
        const luminance = (css: string) => {
          const m = css.match(/[\d.]+/g)?.map(Number) ?? []
          const [r = 0, g = 0, b = 0] = m
          const lin = (v: number) => {
            const s = v / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        }
        return {
          bg: getComputedStyle(root).backgroundColor,
          fg: getComputedStyle(h1).color,
          bgL: luminance(getComputedStyle(root).backgroundColor),
          fgL: luminance(getComputedStyle(h1).color),
        }
      })
      // Un token non résolu donnerait un fond transparent : on exige un fond opaque et un contraste >= 4.5.
      expect(colors.bg).not.toBe('rgba(0, 0, 0, 0)')
      const [hi, lo] = colors.bgL > colors.fgL ? [colors.bgL, colors.fgL] : [colors.fgL, colors.bgL]
      expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5)
      if (isDark(info.project.name)) expect(colors.bgL).toBeLessThan(colors.fgL)
      else expect(colors.bgL).toBeGreaterThan(colors.fgL)
    })
  }

  test('régression visuelle : connexion et inscription', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await expect(page).toHaveScreenshot('login.png', { fullPage: true, style: HIDE_DEVTOOLS })

    const reg = new RegisterPage(page)
    await reg.goto()
    await expect(page).toHaveScreenshot('register.png', { fullPage: true, style: HIDE_DEVTOOLS })
  })
})

test.describe('Réduction des animations', () => {
  test('verify-email : le chargement reste lisible avec prefers-reduced-motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockAuthApi(page, 'verify-email', { status: 400, delayMs: 1000 })
    const verify = new VerifyEmailPage(page)
    await verify.goto('?token=bad')
    await expect(verify.loading).toBeVisible()
    await expect(page.locator('.animate-spin')).toHaveCSS('animation-name', 'none')
    await expect(verify.error).toBeVisible()
  })
})
