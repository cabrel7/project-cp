import type { Locator, Page } from '@playwright/test'
import { auth, gotoHydrated, labelRe } from './helpers'

/** Éléments communs aux écrans d'authentification. Locators en getters : aucune dépendance à l'ordre d'init. */
abstract class AuthPage {
  constructor(readonly page: Page) {}
  get heading(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }
  get alert(): Locator {
    return this.page.getByRole('alert')
  }
  get layout(): Locator {
    return this.page.locator('[data-cp-layout-login]')
  }
  get leftPanel(): Locator {
    return this.page.locator('[data-cp-login-panel]')
  }
  get google(): Locator {
    return this.page.getByRole('button', { name: 'Google' })
  }
  get apple(): Locator {
    return this.page.getByRole('button', { name: 'Apple' })
  }
  get showPasswordToggle(): Locator {
    return this.page.getByRole('button', { name: auth.password.show }).first()
  }
}

export class LoginPage extends AuthPage {
  get email() {
    return this.page.getByLabel(labelRe(auth.login.email))
  }
  get password() {
    return this.page.locator('input[autocomplete="current-password"]')
  }
  get rememberMe() {
    return this.page.getByRole('checkbox', { name: auth.login.rememberMe })
  }
  get submit() {
    return this.page.getByRole('button', { name: auth.login.submit, exact: true })
  }
  get tabEmail() {
    return this.page.getByRole('tab', { name: auth.login.tabEmail })
  }
  get tabPhone() {
    return this.page.getByRole('tab', { name: auth.login.tabPhone })
  }
  get passkey() {
    return this.page.getByRole('button', { name: auth.login.passkey })
  }
  get registerLink() {
    return this.page.getByRole('link', { name: auth.login.createAccount })
  }
  get forgotLink() {
    return this.page.getByRole('link', { name: auth.login.forgotPassword })
  }
  goto = () => gotoHydrated(this.page, '/auth/login')
  async fill(email: string, password: string) {
    await this.email.fill(email)
    await this.password.fill(password)
  }
}

export class RegisterPage extends AuthPage {
  get fullName() {
    return this.page.getByLabel(labelRe(auth.register.fullName))
  }
  get email() {
    return this.page.getByLabel(labelRe(auth.register.email))
  }
  get password() {
    return this.page.locator('input[autocomplete="new-password"]')
  }
  get terms() {
    return this.page.getByRole('checkbox')
  }
  get submit() {
    return this.page.getByRole('button', { name: auth.register.submit })
  }
  get signInLink() {
    return this.page.getByRole('link', { name: auth.register.signIn })
  }
  get strength() {
    return this.page.locator('[data-cp-password-strength]')
  }
  get strengthLabel() {
    return this.page.locator('[data-cp-strength-label]')
  }
  goto = () => gotoHydrated(this.page, '/auth/register')
}

export class ForgotPasswordPage extends AuthPage {
  get email() {
    return this.page.getByLabel(labelRe(auth.forgot.email))
  }
  get submit() {
    // exact : « Renvoyer le lien » contient « envoyer le lien » (correspondance insensible à la casse).
    return this.page.getByRole('button', { name: auth.forgot.submit, exact: true })
  }
  get backLink() {
    return this.page.getByRole('link', { name: auth.forgot.back })
  }
  get sent() {
    return this.page.getByRole('status')
  }
  get resend() {
    return this.page.getByRole('button', { name: auth.forgot.resend })
  }
  get openMail() {
    return this.page.getByRole('link', { name: auth.forgot.openMail })
  }
  goto = () => gotoHydrated(this.page, '/auth/forgot-password')
}

export class ResetPasswordPage extends AuthPage {
  get password() {
    return this.page.getByLabel(labelRe(auth.reset.newPassword))
  }
  get confirm() {
    return this.page.getByLabel(labelRe(auth.reset.confirmPassword))
  }
  get revoke() {
    return this.page.getByRole('checkbox', { name: auth.reset.revokeSessions })
  }
  get submit() {
    return this.page.getByRole('button', { name: auth.reset.submit })
  }
  get mismatch() {
    return this.page.getByText(auth.reset.passwordMismatch)
  }
  get requestNewLink() {
    return this.page.getByRole('link', { name: auth.reset.requestNewLink })
  }
  get strength() {
    return this.page.locator('[data-cp-password-strength]')
  }
  goto = (token?: string) =>
    gotoHydrated(
      this.page,
      token === undefined ? '/auth/reset-password' : `/auth/reset-password?token=${token}`,
    )
}

export class VerifyEmailPage extends AuthPage {
  get loading() {
    return this.page.getByText(auth.verify.loading)
  }
  get success() {
    return this.page.getByText(auth.verify.success)
  }
  get error() {
    return this.page.getByText(auth.verify.error)
  }
  get goToLogin() {
    return this.page.getByRole('link', { name: auth.verify.goToLogin })
  }
  // Hydratation attendue : le jeton est soumis dans onMounted, donc seulement une fois Vue monté
  // (en dev, le premier chargement peut dépasser le timeout d'assertion par défaut).
  goto = (query = '') => gotoHydrated(this.page, `/auth/verify-email${query}`)
}
