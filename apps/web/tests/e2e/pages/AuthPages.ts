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
    return this.page.getByTestId('auth-google')
  }
  get apple(): Locator {
    return this.page.getByTestId('auth-apple')
  }
  get showPasswordToggle(): Locator {
    return this.page.getByRole('button', { name: auth.password.show }).first()
  }
}

/** Formulaire « Recevoir un code » (AuthPhoneForm), partagé entre connexion et inscription. */
export class PhoneForm {
  constructor(readonly page: Page) {}
  get root(): Locator {
    return this.page.getByTestId('auth-phone-form')
  }
  get fullName(): Locator {
    return this.root.getByLabel(labelRe(auth.register.fullName))
  }
  /**
   * Champ du numéro. Repli sur le type `tel` : le champ n'a PAS de nom accessible (défaut D-a11y-1,
   * voir `phoneByLabel` et le test rouge « le champ numéro a un nom accessible »).
   */
  get phone(): Locator {
    return this.root.locator('input[type="tel"]')
  }
  /** Locator sémantique cible : devient utilisable quand le défaut d'identifiant dupliqué est corrigé. */
  get phoneByLabel(): Locator {
    return this.root.getByRole('textbox', { name: auth.phone.label })
  }
  get country(): Locator {
    return this.root.getByRole('combobox', { name: auth.phone.country })
  }
  get terms(): Locator {
    return this.root.getByRole('checkbox')
  }
  get submit(): Locator {
    return this.page.getByTestId('auth-phone-submit')
  }
  get alert(): Locator {
    return this.page.getByTestId('auth-phone-alert')
  }
  get offline(): Locator {
    return this.page.getByTestId('auth-offline')
  }
  get useEmail(): Locator {
    return this.alert.getByRole('link', { name: auth.code.useEmail })
  }
  /** Saisit le numéro national (le champ est actif une fois la bibliothèque de numéros chargée). */
  async fillPhone(national: string): Promise<void> {
    await this.phone.fill(national)
  }
}

export class LoginPage extends AuthPage {
  readonly phoneForm = new PhoneForm(this.page)
  gotoPhone = () => gotoHydrated(this.page, '/auth/login?tab=phone')
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
    return this.page.getByTestId('auth-passkey')
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
  readonly phoneForm = new PhoneForm(this.page)
  get tabEmail() {
    return this.page.getByRole('tab', { name: auth.register.tabEmail })
  }
  get tabPhone() {
    return this.page.getByRole('tab', { name: auth.register.tabPhone })
  }
  gotoPhone = () => gotoHydrated(this.page, '/auth/register?tab=phone')
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

/** Écran du code SMS /auth/phone/code (maquette 06). */
export class PhoneCodePage extends AuthPage {
  get digits(): Locator {
    return this.page.getByRole('textbox', {
      name: new RegExp(`^${auth.code.digit.replace('{n}', '\\d')}$`),
    })
  }
  digit(n: number): Locator {
    return this.page.getByRole('textbox', {
      name: auth.code.digit.replace('{n}', String(n)),
      exact: true,
    })
  }
  get back(): Locator {
    return this.page.getByTestId('auth-code-back')
  }
  get sentTo(): Locator {
    return this.page.getByTestId('auth-code-sent-to')
  }
  get change(): Locator {
    return this.sentTo.getByRole('link', { name: auth.code.change })
  }
  get invalid(): Locator {
    return this.page.getByTestId('auth-code-invalid')
  }
  get resendIn(): Locator {
    return this.page.getByTestId('auth-code-resend-in')
  }
  get resend(): Locator {
    return this.page.getByTestId('auth-code-resend')
  }
  get resent(): Locator {
    return this.page.getByTestId('auth-code-resent')
  }
  get submit(): Locator {
    return this.page.getByTestId('auth-code-submit')
  }
  get requestNew(): Locator {
    return this.page.getByTestId('auth-code-request-new')
  }
  get codeAlert(): Locator {
    return this.page.getByTestId('auth-code-alert')
  }
  get offline(): Locator {
    return this.page.getByTestId('auth-offline')
  }
  get useEmail(): Locator {
    return this.codeAlert.getByRole('link', { name: auth.code.useEmail })
  }
  goto = () => gotoHydrated(this.page, '/auth/phone/code')

  /** Colle un code dans la première case (événement paste réel, comme un collage du SMS). */
  async paste(code: string): Promise<void> {
    await this.digits.first().evaluate((el, value) => {
      const data = new DataTransfer()
      data.setData('text/plain', value)
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    }, code)
  }
}
