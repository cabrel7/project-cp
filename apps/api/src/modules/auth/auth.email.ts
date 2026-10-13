import { createTransport, type Transporter } from 'nodemailer'
import { getEnv } from '../../env.js'

let transporter: Transporter | undefined

function getTransport(): Transporter {
  if (transporter) return transporter
  const env = getEnv()
  transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
  })
  return transporter
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const env = getEnv()
  const link = `${env.APP_URL}/auth/verify-email?token=${token}`

  const subject = locale === 'fr' ? 'Vérifiez votre adresse e-mail' : 'Verify your email address'
  const text =
    locale === 'fr'
      ? `Bienvenue sur project-cp !\n\nCliquez sur le lien suivant pour vérifier votre adresse e-mail :\n${link}\n\nCe lien expire dans 24 heures.`
      : `Welcome to project-cp!\n\nClick the following link to verify your email address:\n${link}\n\nThis link expires in 24 hours.`

  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const env = getEnv()
  const link = `${env.APP_URL}/auth/reset-password?token=${token}`

  const subject = locale === 'fr' ? 'Réinitialisation de votre mot de passe' : 'Reset your password'
  const text =
    locale === 'fr'
      ? `Vous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur le lien suivant :\n${link}\n\nCe lien expire dans 30 minutes. Si vous n'avez pas fait cette demande, ignorez cet e-mail.`
      : `You requested a password reset.\n\nClick the following link:\n${link}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`

  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
  })
}

/** Alerte de sécurité (P2.3) : liaison ou déliaison d'un compte Google. Aucun jeton ; lien vers la page Sécurité. */
async function sendIdentityAlert(
  kind: 'linked' | 'unlinked',
  to: string,
  locale: string,
): Promise<void> {
  const env = getEnv()
  const link = `${env.APP_URL}/account/security`
  const when = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
  const fr = locale === 'fr'
  const subject =
    kind === 'linked'
      ? fr
        ? 'Un compte Google a été lié à votre compte'
        : 'A Google account was linked to your account'
      : fr
        ? 'Un compte Google a été délié de votre compte'
        : 'A Google account was unlinked from your account'
  const text = fr
    ? `Fournisseur : Google\nDate : ${when}\n\n${
        kind === 'linked'
          ? 'Vous pouvez désormais vous connecter à votre compte avec Google.'
          : 'Vous ne pouvez plus vous connecter à votre compte avec Google.'
      }\n\nSi vous n'êtes pas à l'origine de cette action, vérifiez vos moyens de connexion :\n${link}`
    : `Provider: Google\nDate: ${when}\n\n${
        kind === 'linked'
          ? 'You can now sign in to your account with Google.'
          : 'You can no longer sign in to your account with Google.'
      }\n\nIf you did not do this, review your sign-in methods:\n${link}`
  await getTransport().sendMail({ from: env.SMTP_FROM, to, subject, text })
}

export const sendIdentityLinkedEmail = (to: string, locale: string) =>
  sendIdentityAlert('linked', to, locale)

export const sendIdentityUnlinkedEmail = (to: string, locale: string) =>
  sendIdentityAlert('unlinked', to, locale)

export function resetTransport(): void {
  transporter = undefined
}
