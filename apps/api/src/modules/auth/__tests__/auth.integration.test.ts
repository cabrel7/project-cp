import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../env.js', () => ({
  getEnv: () => ({
    APP_URL: 'https://app.example.com',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_FROM: 'noreply@example.com',
    SESSION_MAX_AGE_SECONDS: 3600,
    SESSION_REMEMBER_MAX_AGE_SECONDS: 86400 * 30,
    REDIS_URL: 'redis://localhost:6379',
  }),
  resetEnvCache: () => {},
}))

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

const envVar = (key: string): string | undefined => process.env[key]

async function isReachable(): Promise<boolean> {
  const url = envVar('DATABASE_URL_RW')
  if (!url) return false
  try {
    const { getPoolRw } = await import('@cp/db')
    const pool = getPoolRw()
    await pool`SELECT 1`
    return true
  } catch {
    return false
  }
}

const requiredUrls = ['DATABASE_URL_RW', 'DATABASE_URL_AUTH'].map(envVar)
const hasDb = requiredUrls.every(Boolean) && (await isReachable())

describe.skipIf(!hasDb)('Auth integration (PostgreSQL réel)', () => {
  let service: typeof import('../auth.service.js')
  let repo: typeof import('../auth.repository.js')
  let tokenMod: typeof import('../auth.token.js')
  let adminPool: Awaited<ReturnType<typeof import('@cp/db/admin')['getPoolAdmin']>>

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const emailA = `alice-${suffix}@example.com`
  const emailB = `bob-${suffix}@example.com`
  const password = 'StrongP@ss42!'

  beforeAll(async () => {
    const { getPoolAdmin } = await import('@cp/db/admin')
    adminPool = getPoolAdmin()

    service = await import('../auth.service.js')
    repo = await import('../auth.repository.js')
    tokenMod = await import('../auth.token.js')
  })

  afterAll(async () => {
    const emails = [emailA, emailB]
    await adminPool`DELETE FROM iam.user_sessions WHERE user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails}))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.verification_tokens WHERE user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails}))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.memberships WHERE user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails}))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.environments WHERE organization_id IN (SELECT id FROM iam.organizations WHERE created_by_user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails})))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.workspaces WHERE organization_id IN (SELECT id FROM iam.organizations WHERE created_by_user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails})))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.organizations WHERE created_by_user_id IN (SELECT id FROM iam.users WHERE email = ANY(${emails}))`.catch(
      () => {},
    )
    await adminPool`DELETE FROM iam.users WHERE email = ANY(${emails})`.catch(() => {})
  })

  it('register — crée un utilisateur et son organisation', async () => {
    await service.register({
      email: emailA,
      password,
      fullName: 'Alice Test',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })

    const user = await repo.findUserByEmail(emailA)
    expect(user).not.toBeNull()
    expect(user?.status).toBe('pending')
    expect(user?.email).toBe(emailA)

    const orgs =
      await adminPool`SELECT slug FROM iam.organizations WHERE created_by_user_id = ${user?.id.toString()}`
    expect(orgs).toHaveLength(1)
    expect(orgs[0]?.slug).toBe(`user-${user?.publicId}`)
  })

  it('register — même e-mail : aucune erreur, aucun doublon', async () => {
    await expect(
      service.register({
        email: emailA,
        password,
        fullName: 'Alice Bis',
        ip: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).resolves.toBeUndefined()

    const users = await adminPool`SELECT id FROM iam.users WHERE email = ${emailA}`
    expect(users).toHaveLength(1)
  })

  it('register — deuxième utilisateur distinct', async () => {
    await service.register({
      email: emailB,
      password,
      fullName: 'Bob Test',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })
    const userB = await repo.findUserByEmail(emailB)
    const userA = await repo.findUserByEmail(emailA)
    expect(userB).not.toBeNull()
    expect(userB?.publicId).not.toBe(userA?.publicId)
  })

  it('login — identifiants invalides', async () => {
    await expect(
      service.login({
        email: emailA,
        password: 'wrong',
        rememberMe: false,
        ip: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).rejects.toThrow('AUTH_INVALID_CREDENTIALS')
  })

  it('login — identifiants valides : retourne un token et une session', async () => {
    const result = await service.login({
      email: emailA,
      password,
      rememberMe: true,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })

    expect(result.token).toBeDefined()
    expect(result.token.length).toBeGreaterThan(0)
    expect(result.maxAge).toBe(86400 * 30)
    expect(result.authResponse.user.email).toBe(emailA)

    const sessionRow = await repo.findSessionByTokenHash(tokenMod.hashToken(result.token))
    expect(sessionRow).not.toBeNull()
    expect(sessionRow?.revokedAt).toBeNull()
  })

  it('verify-email — consomme le jeton et passe le statut à active', async () => {
    const user = await repo.findUserByEmail(emailA)
    expect(user?.status).toBe('pending')

    const rawToken = `verify-${suffix}`
    const hash = tokenMod.hashToken(rawToken)
    const hexHash = Buffer.from(hash).toString('hex')
    await adminPool`INSERT INTO iam.verification_tokens (user_id, purpose, target, token_hash, expires_at) VALUES (${user?.id.toString()}, 'verify_email', ${emailA}, decode(${hexHash}, 'hex'), now() + interval '1 hour')`

    await service.verifyEmail(rawToken)

    const userAfter = await repo.findUserByEmail(emailA)
    expect(userAfter?.status).toBe('active')
    expect(userAfter?.emailVerifiedAt).not.toBeNull()
  })

  it('verify-email — jeton déjà consommé : erreur', async () => {
    const rawToken = `verify-${suffix}`
    await expect(service.verifyEmail(rawToken)).rejects.toThrow('AUTH_VERIFICATION_TOKEN_INVALID')
  })

  it('verify-email — jeton expiré : erreur', async () => {
    const user = await repo.findUserByEmail(emailA)
    const rawToken = `verify-expired-${suffix}`
    const hash = tokenMod.hashToken(rawToken)
    const hexHash = Buffer.from(hash).toString('hex')
    await adminPool`INSERT INTO iam.verification_tokens (user_id, purpose, target, token_hash, expires_at) VALUES (${user?.id.toString()}, 'verify_email', ${emailA}, decode(${hexHash}, 'hex'), now() - interval '1 minute')`

    await expect(service.verifyEmail(rawToken)).rejects.toThrow('AUTH_VERIFICATION_TOKEN_INVALID')
  })

  it('reset-password — transaction : jeton consommé, mdp changé, sessions révoquées', async () => {
    const user = await repo.findUserByEmail(emailA)

    const loginBefore = await service.login({
      email: emailA,
      password,
      rememberMe: false,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })

    const rawToken = `reset-${suffix}`
    const hash = tokenMod.hashToken(rawToken)
    const hexHash = Buffer.from(hash).toString('hex')
    await adminPool`INSERT INTO iam.verification_tokens (user_id, purpose, target, token_hash, expires_at) VALUES (${user?.id.toString()}, 'reset_password', ${emailA}, decode(${hexHash}, 'hex'), now() + interval '30 minutes')`

    const newPassword = 'NewStr0ngP@ss!'
    await service.resetPassword({ token: rawToken, password: newPassword })

    const sessionAfter = await repo.findSessionByTokenHash(tokenMod.hashToken(loginBefore.token))
    expect(sessionAfter?.revokedAt).not.toBeNull()

    await expect(
      service.login({
        email: emailA,
        password,
        rememberMe: false,
        ip: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).rejects.toThrow('AUTH_INVALID_CREDENTIALS')

    const loginAfter = await service.login({
      email: emailA,
      password: newPassword,
      rememberMe: false,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    })
    expect(loginAfter.token).toBeDefined()
  })

  it('logout-all — révoque toutes les sessions sauf la courante', async () => {
    const newPassword = 'NewStr0ngP@ss!'
    const s1 = await service.login({
      email: emailA,
      password: newPassword,
      rememberMe: false,
      ip: '127.0.0.1',
      userAgent: 'vitest-s1',
    })
    const s2 = await service.login({
      email: emailA,
      password: newPassword,
      rememberMe: false,
      ip: '127.0.0.1',
      userAgent: 'vitest-s2',
    })

    const session2 = await repo.findSessionByTokenHash(tokenMod.hashToken(s2.token))
    const user = await repo.findUserByEmail(emailA)

    await service.logoutAll(user?.id, session2?.id)

    const s1After = await repo.findSessionByTokenHash(tokenMod.hashToken(s1.token))
    const s2After = await repo.findSessionByTokenHash(tokenMod.hashToken(s2.token))
    expect(s1After?.revokedAt).not.toBeNull()
    expect(s2After?.revokedAt).toBeNull()
  })
})
