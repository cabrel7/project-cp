import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../../../env.js'

const sendMail = vi.fn()
const createTransport = vi.fn(() => ({ sendMail }))

vi.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) =>
    (createTransport as (...a: unknown[]) => unknown)(...args),
}))

import { resetTransport, sendPasswordResetEmail, sendVerificationEmail } from '../auth.email.js'

beforeEach(() => {
  vi.clearAllMocks()
  sendMail.mockResolvedValue({ messageId: 'm1' })
  vi.stubEnv('APP_URL', 'https://app.example.com')
  vi.stubEnv('SMTP_HOST', 'smtp.example.com')
  vi.stubEnv('SMTP_PORT', '2525')
  vi.stubEnv('SMTP_SECURE', 'false')
  vi.stubEnv('SMTP_USER', '')
  vi.stubEnv('SMTP_PASSWORD', '')
  vi.stubEnv('SMTP_FROM', 'noreply@example.com')
  resetEnvCache()
  resetTransport()
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
  resetTransport()
})

describe('sendVerificationEmail', () => {
  it('doit envoyer un e-mail FR avec le lien de vérification', async () => {
    await sendVerificationEmail('alice@example.com', 'tok123', 'fr')

    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = sendMail.mock.calls[0]?.[0]
    expect(mail.from).toBe('noreply@example.com')
    expect(mail.to).toBe('alice@example.com')
    expect(mail.subject).toBe('Vérifiez votre adresse e-mail')
    expect(mail.text).toContain('https://app.example.com/verify-email?token=tok123')
    expect(mail.text).toContain('Bienvenue')
    expect(mail.text).toContain('24 heures')
  })

  it('doit envoyer un e-mail EN avec le lien de vérification', async () => {
    await sendVerificationEmail('alice@example.com', 'tok123', 'en')

    const mail = sendMail.mock.calls[0]?.[0]
    expect(mail.subject).toBe('Verify your email address')
    expect(mail.text).toContain('https://app.example.com/verify-email?token=tok123')
    expect(mail.text).toContain('Welcome')
    expect(mail.text).toContain('24 hours')
  })

  it('doit retomber sur l’anglais quand la locale est inconnue', async () => {
    await sendVerificationEmail('alice@example.com', 'tok123', 'de')
    expect(sendMail.mock.calls[0]?.[0].subject).toBe('Verify your email address')
  })

  it('doit créer le transport SMTP depuis l’environnement, sans auth si SMTP_USER est vide', async () => {
    await sendVerificationEmail('alice@example.com', 't', 'fr')

    expect(createTransport).toHaveBeenCalledTimes(1)
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 2525,
      secure: false,
    })
  })

  it('doit fournir l’authentification SMTP quand SMTP_USER est défini', async () => {
    vi.stubEnv('SMTP_USER', 'mailer')
    vi.stubEnv('SMTP_PASSWORD', 'pw')
    vi.stubEnv('SMTP_SECURE', 'true')
    resetEnvCache()

    await sendVerificationEmail('alice@example.com', 't', 'fr')

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 2525,
      secure: true,
      auth: { user: 'mailer', pass: 'pw' },
    })
  })

  it('doit réutiliser le même transport entre deux envois', async () => {
    await sendVerificationEmail('a@example.com', 't1', 'fr')
    await sendPasswordResetEmail('a@example.com', 't2', 'fr')

    expect(createTransport).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  it('doit recréer le transport après resetTransport', async () => {
    await sendVerificationEmail('a@example.com', 't1', 'fr')
    resetTransport()
    await sendVerificationEmail('a@example.com', 't2', 'fr')

    expect(createTransport).toHaveBeenCalledTimes(2)
  })

  it('doit propager l’erreur quand l’envoi échoue', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'))
    await expect(sendVerificationEmail('a@example.com', 't', 'fr')).rejects.toThrow('smtp down')
  })
})

describe('sendPasswordResetEmail', () => {
  it('doit envoyer un e-mail FR avec le lien de réinitialisation', async () => {
    await sendPasswordResetEmail('alice@example.com', 'rst456', 'fr')

    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = sendMail.mock.calls[0]?.[0]
    expect(mail.from).toBe('noreply@example.com')
    expect(mail.to).toBe('alice@example.com')
    expect(mail.subject).toBe('Réinitialisation de votre mot de passe')
    expect(mail.text).toContain('https://app.example.com/reset-password?token=rst456')
    expect(mail.text).toContain('30 minutes')
  })

  it('doit envoyer un e-mail EN avec le lien de réinitialisation', async () => {
    await sendPasswordResetEmail('alice@example.com', 'rst456', 'en')

    const mail = sendMail.mock.calls[0]?.[0]
    expect(mail.subject).toBe('Reset your password')
    expect(mail.text).toContain('https://app.example.com/reset-password?token=rst456')
    expect(mail.text).toContain('30 minutes')
  })

  it('doit retomber sur l’anglais quand la locale est inconnue', async () => {
    await sendPasswordResetEmail('alice@example.com', 'rst456', 'es')
    expect(sendMail.mock.calls[0]?.[0].subject).toBe('Reset your password')
  })

  it('doit propager l’erreur quand l’envoi échoue', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'))
    await expect(sendPasswordResetEmail('a@example.com', 't', 'fr')).rejects.toThrow('smtp down')
  })
})
