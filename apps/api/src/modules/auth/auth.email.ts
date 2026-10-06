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

export function resetTransport(): void {
  transporter = undefined
}
