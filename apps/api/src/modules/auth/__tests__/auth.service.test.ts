import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../../../env.js'
import { AppError } from '../../../lib/errors.js'

vi.mock('../auth.repository.js', () => ({
  findUserByEmail: vi.fn(),
  findSessionByTokenHash: vi.fn(),
  findUserById: vi.fn(),
  createUserWithOrg: vi.fn(),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  touchSession: vi.fn(),
  listUserSessions: vi.fn(),
  createVerificationToken: vi.fn(),
  consumeVerificationToken: vi.fn(),
  updateUserPassword: vi.fn(),
  markEmailVerified: vi.fn(),
  updateLastLogin: vi.fn(),
  resetPasswordTx: vi.fn(),
  getFreeTierRequiresPhoneOtp: vi.fn().mockResolvedValue(true),
}))

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('../auth.password.js', async () => {
  const actual = await vi.importActual<typeof import('../auth.password.js')>('../auth.password.js')
  return {
    validatePasswordStrength: actual.validatePasswordStrength,
    hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
    verifyPassword: vi.fn(),
    dummyVerify: vi.fn(async () => {}),
  }
})

import * as email from '../auth.email.js'
import * as password from '../auth.password.js'
import * as repo from '../auth.repository.js'
import * as service from '../auth.service.js'
import { hashToken } from '../auth.token.js'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const STRONG = 'Str0ngPassw0rd'

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    publicId: '0190a000-0000-7000-8000-000000000001',
    email: 'alice@example.com',
    passwordHash: 'stored-hash',
    status: 'active',
    emailVerifiedAt: null as string | null,
    locale: 'fr',
    fullName: 'Alice',
    timezone: 'Europe/Paris',
    createdAt: '2025-12-01T00:00:00.000Z',
    phoneE164: null as string | null,
    phoneVerifiedAt: null as string | null,
    ...overrides,
  }
}

async function expectAppError(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(AppError)
  expect((err as AppError).code).toBe(code)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv('SESSION_MAX_AGE_SECONDS', '86400')
  vi.stubEnv('SESSION_REMEMBER_MAX_AGE_SECONDS', '604800')
  resetEnvCache()
  vi.mocked(email.sendVerificationEmail).mockResolvedValue(undefined)
  vi.mocked(email.sendPasswordResetEmail).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('register', () => {
  const params = {
    email: 'alice@example.com',
    password: STRONG,
    fullName: 'Alice',
    ip: '1.2.3.4',
    userAgent: 'UA',
  }

  function arrangeSuccess() {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    vi.mocked(repo.createUserWithOrg).mockResolvedValue({
      userId: 1n,
      userPublicId: 'u-pub',
      orgId: 10n,
      orgPublicId: 'o-pub',
    })
    vi.mocked(repo.createVerificationToken).mockResolvedValue(undefined)
  }

  it('doit créer compte et jeton de vérification quand les données sont valides (réponse non discriminante)', async () => {
    arrangeSuccess()

    await service.register(params)

    expect(repo.createUserWithOrg).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: `hashed:${STRONG}`, email: params.email }),
    )
    expect(repo.createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1n, purpose: 'verify_email', target: params.email }),
    )
    expect(email.sendVerificationEmail).toHaveBeenCalled()
  })

  it("doit résoudre sans erreur quand l'e-mail existe déjà (non discriminant)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)

    await expect(service.register(params)).resolves.toBeUndefined()
    expect(repo.createUserWithOrg).not.toHaveBeenCalled()
  })

  it.each([
    ['trop court', 'Ab1'],
    ['sans majuscule', 'lowercase123'],
    ['sans minuscule', 'UPPERCASE123'],
    ['sans chiffre', 'NoDigitsHere'],
  ])('doit lever AUTH_PASSWORD_TOO_WEAK (422) quand le mot de passe est %s', async (_l, pwd) => {
    await expectAppError(service.register({ ...params, password: pwd }), 'AUTH_PASSWORD_TOO_WEAK')
    expect(repo.findUserByEmail).not.toHaveBeenCalled()
    expect(repo.createUserWithOrg).not.toHaveBeenCalled()
  })

  it('doit accepter un mot de passe de exactement 8 caractères valides (borne)', async () => {
    arrangeSuccess()
    await expect(service.register({ ...params, password: 'Abcdef1x' })).resolves.toBeUndefined()
  })

  it("doit résoudre silencieusement quand une inscription concurrente viole l'unicité e-mail (23505)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    vi.mocked(repo.createUserWithOrg).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint_name: 'users_email_key' }),
    )

    await expect(service.register(params)).resolves.toBeUndefined()
  })

  it("doit propager l'erreur quand la violation d'unicité n'est pas sur l'e-mail", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    vi.mocked(repo.createUserWithOrg).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint_name: 'organizations_slug_uq' }),
    )

    await expect(service.register(params)).rejects.toThrow('dup')
  })

  it('doit propager telle quelle une erreur de base inattendue (pas de 409 abusif)', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    const boom = Object.assign(new Error('connection lost'), { code: '08006' })
    vi.mocked(repo.createUserWithOrg).mockRejectedValue(boom)

    await expect(service.register(params)).rejects.toBe(boom)
  })

  it('doit passer fullName à null quand il est absent', async () => {
    arrangeSuccess()
    await service.register({ email: params.email, password: STRONG, ip: null, userAgent: null })
    expect(repo.createUserWithOrg).toHaveBeenCalledWith(expect.objectContaining({ fullName: null }))
  })

  it("doit réussir même si l'envoi de l'e-mail échoue", async () => {
    arrangeSuccess()
    vi.mocked(email.sendVerificationEmail).mockRejectedValue(new Error('smtp down'))

    await expect(service.register(params)).resolves.toBeUndefined()
  })
})

describe('login', () => {
  const params = {
    email: 'alice@example.com',
    password: STRONG,
    rememberMe: false,
    ip: '1.2.3.4',
    userAgent: 'UA',
  }

  it('doit ouvrir une session quand les identifiants sont valides', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue({ id: 7n, publicId: 's-pub' })

    const res = await service.login(params)

    expect(password.verifyPassword).toHaveBeenCalledWith('stored-hash', STRONG)
    expect(res.maxAge).toBe(86400)
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    expect(res.authResponse.session).toMatchObject({ id: 's-pub', is_current: true })
    expect(res.authResponse.user.email).toBe('alice@example.com')
    expect(repo.updateLastLogin).toHaveBeenCalledWith(1n)
    expect(password.dummyVerify).not.toHaveBeenCalled()
  })

  it('ne doit jamais exposer le hash du mot de passe dans la réponse', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue({ id: 7n, publicId: 's-pub' })

    const res = await service.login(params)

    expect(JSON.stringify(res.authResponse)).not.toContain('stored-hash')
    expect(JSON.stringify(res.authResponse)).not.toContain('passwordHash')
  })

  it('doit utiliser la durée « se souvenir de moi » (7 j) quand rememberMe est vrai', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue({ id: 7n, publicId: 's-pub' })

    const res = await service.login({ ...params, rememberMe: true })

    expect(res.maxAge).toBe(604800)
    const args = vi.mocked(repo.createSession).mock.calls[0]?.[0]
    expect(args?.expiresAt.getTime()).toBe(NOW.getTime() + 604800 * 1000)
  })

  it("doit lever AUTH_INVALID_CREDENTIALS et appeler dummyVerify quand l'utilisateur n'existe pas", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)

    await expectAppError(service.login(params), 'AUTH_INVALID_CREDENTIALS')
    expect(password.dummyVerify).toHaveBeenCalledTimes(1)
    expect(password.verifyPassword).not.toHaveBeenCalled()
    expect(repo.createSession).not.toHaveBeenCalled()
  })

  it('doit lever AUTH_INVALID_CREDENTIALS quand le mot de passe est faux', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(false)

    await expectAppError(service.login(params), 'AUTH_INVALID_CREDENTIALS')
    expect(repo.createSession).not.toHaveBeenCalled()
    expect(repo.updateLastLogin).not.toHaveBeenCalled()
  })

  it('doit lever AUTH_ACCOUNT_SUSPENDED (403) quand le compte est suspendu et le mot de passe correct', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow({ status: 'suspended' }) as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(true)

    await expectAppError(service.login(params), 'AUTH_ACCOUNT_SUSPENDED')
    expect(repo.createSession).not.toHaveBeenCalled()
    expect(repo.updateLastLogin).not.toHaveBeenCalled()
  })

  it("ne doit pas révéler la suspension quand le mot de passe est faux (pas d'énumération)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow({ status: 'suspended' }) as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(false)

    await expectAppError(service.login(params), 'AUTH_INVALID_CREDENTIALS')
    expect(repo.createSession).not.toHaveBeenCalled()
  })

  it("doit lever AUTH_INVALID_CREDENTIALS quand le compte n'a pas de mot de passe (ex. SSO)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow({ passwordHash: null }) as never)

    await expectAppError(service.login(params), 'AUTH_INVALID_CREDENTIALS')
    expect(password.dummyVerify).toHaveBeenCalledTimes(1)
    expect(password.verifyPassword).not.toHaveBeenCalled()
  })

  it("doit autoriser la connexion d'un compte « pending » (e-mail non vérifié)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow({ status: 'pending' }) as never)
    vi.mocked(password.verifyPassword).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue({ id: 7n, publicId: 's-pub' })

    await expect(service.login(params)).resolves.toBeDefined()
  })

  it('doit renvoyer le même code pour utilisateur inconnu et mauvais mot de passe (non discriminant)', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValueOnce(null)
    const unknown = await service.login(params).catch((e: AppError) => e)
    vi.mocked(repo.findUserByEmail).mockResolvedValueOnce(userRow() as never)
    vi.mocked(password.verifyPassword).mockResolvedValueOnce(false)
    const wrong = await service.login(params).catch((e: AppError) => e)

    expect((unknown as AppError).code).toBe((wrong as AppError).code)
    expect((unknown as AppError).httpStatus).toBe((wrong as AppError).httpStatus)
  })
})

describe('logout / logoutAll', () => {
  it('logout doit révoquer la session donnée', async () => {
    await service.logout(5n)
    expect(repo.revokeSession).toHaveBeenCalledWith(5n)
  })

  it('logoutAll doit révoquer toutes les sessions sauf la courante', async () => {
    await service.logoutAll(1n, 5n)
    expect(repo.revokeAllUserSessions).toHaveBeenCalledWith(1n, 5n)
  })

  it("logoutAll doit révoquer toutes les sessions quand aucune exception n'est donnée", async () => {
    await service.logoutAll(1n)
    expect(repo.revokeAllUserSessions).toHaveBeenCalledWith(1n, undefined)
  })
})

describe('listSessions', () => {
  it('doit mapper les sessions et marquer uniquement la courante', async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue([
      {
        id: 5n,
        publicId: 'pub-5',
        ip: '1.1.1.1',
        userAgent: 'A',
        deviceLabel: null,
        createdAt: 'c5',
        lastSeenAt: 'l5',
      },
      {
        id: 6n,
        publicId: 'pub-6',
        ip: null,
        userAgent: null,
        deviceLabel: 'Phone',
        createdAt: 'c6',
        lastSeenAt: 'l6',
      },
    ] as never)

    const res = await service.listSessions(1n, 6n)

    expect(repo.listUserSessions).toHaveBeenCalledWith(1n)
    expect(res).toEqual([
      {
        id: 'pub-5',
        ip: '1.1.1.1',
        user_agent: 'A',
        device_label: null,
        created_at: 'c5',
        last_seen_at: 'l5',
        is_current: false,
      },
      {
        id: 'pub-6',
        ip: null,
        user_agent: null,
        device_label: 'Phone',
        created_at: 'c6',
        last_seen_at: 'l6',
        is_current: true,
      },
    ])
  })

  it("doit renvoyer une liste vide quand il n'y a aucune session", async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue([])
    await expect(service.listSessions(1n, 6n)).resolves.toEqual([])
  })
})

describe('revokeSessionById', () => {
  const sessions = [
    { id: 5n, publicId: 'pub-5' },
    { id: 6n, publicId: 'pub-6' },
  ]

  it('doit révoquer la session ciblée par son public_id', async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue(sessions as never)

    await service.revokeSessionById(1n, 'pub-6', 'pub-5')

    expect(repo.revokeSession).toHaveBeenCalledWith(6n)
  })

  it("doit lever PLATFORM_RESOURCE_NOT_FOUND (404) quand la session n'existe pas", async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue(sessions as never)

    await expectAppError(
      service.revokeSessionById(1n, 'pub-unknown', 'pub-5'),
      'PLATFORM_RESOURCE_NOT_FOUND',
    )
    expect(repo.revokeSession).not.toHaveBeenCalled()
  })

  it('doit refuser de révoquer la session courante (utiliser logout)', async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue(sessions as never)

    await expectAppError(
      service.revokeSessionById(1n, 'pub-5', 'pub-5'),
      'PLATFORM_RESOURCE_NOT_FOUND',
    )
    expect(repo.revokeSession).not.toHaveBeenCalled()
  })

  it("ne doit chercher que dans les sessions de l'utilisateur appelant (pas celles d'un autre)", async () => {
    vi.mocked(repo.listUserSessions).mockResolvedValue(sessions as never)

    await expectAppError(
      service.revokeSessionById(1n, 'pub-other', 'pub-5'),
      'PLATFORM_RESOURCE_NOT_FOUND',
    )
    expect(repo.listUserSessions).toHaveBeenCalledWith(1n)
    expect(repo.revokeSession).not.toHaveBeenCalled()
  })
})

describe('forgotPassword', () => {
  it("doit créer un jeton « reset_password » de 30 min et envoyer l'e-mail quand l'utilisateur existe", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow({ locale: 'en' }) as never)

    await service.forgotPassword({ email: 'alice@example.com', ip: '1.2.3.4' })

    const args = vi.mocked(repo.createVerificationToken).mock.calls[0]?.[0]
    expect(args).toMatchObject({
      userId: 1n,
      purpose: 'reset_password',
      target: 'alice@example.com',
      ip: '1.2.3.4',
    })
    expect(args?.expiresAt.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000)
    const [to, rawToken, locale] = vi.mocked(email.sendPasswordResetEmail).mock.calls[0] ?? []
    expect(to).toBe('alice@example.com')
    expect(locale).toBe('en')
    expect(Buffer.from(args?.tokenHash ?? []).toString('hex')).toBe(
      Buffer.from(hashToken(rawToken as string)).toString('hex'),
    )
  })

  it("doit résoudre sans erreur ni e-mail ni jeton quand l'utilisateur n'existe pas", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)

    await expect(
      service.forgotPassword({ email: 'ghost@example.com', ip: null }),
    ).resolves.toBeUndefined()
    expect(repo.createVerificationToken).not.toHaveBeenCalled()
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("ne doit pas attendre l'envoi de l'e-mail (temps de réponse non discriminant)", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(email.sendPasswordResetEmail).mockReturnValue(new Promise(() => {}))

    await expect(
      service.forgotPassword({ email: 'alice@example.com', ip: null }),
    ).resolves.toBeUndefined()
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1)
  })

  it("doit résoudre sans erreur même si l'envoi de l'e-mail échoue", async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(userRow() as never)
    vi.mocked(email.sendPasswordResetEmail).mockRejectedValue(new Error('smtp down'))

    await expect(
      service.forgotPassword({ email: 'alice@example.com', ip: null }),
    ).resolves.toBeUndefined()
  })
})

describe('resetPassword', () => {
  const token = 'a'.repeat(64)

  it('doit changer le mot de passe et toujours révoquer toutes les sessions (transaction unique)', async () => {
    vi.mocked(repo.resetPasswordTx).mockResolvedValue({
      userId: 9n,
      target: 'alice@example.com',
    })

    await service.resetPassword({ token, password: STRONG })

    const args = vi.mocked(repo.resetPasswordTx).mock.calls[0]?.[0]
    expect(args).toMatchObject({ passwordHash: `hashed:${STRONG}` })
    expect(Buffer.from(args?.tokenHash ?? []).toString('hex')).toBe(
      Buffer.from(hashToken(token)).toString('hex'),
    )
  })

  it('doit lever AUTH_VERIFICATION_TOKEN_INVALID (422) quand le jeton est inconnu, expiré ou déjà utilisé', async () => {
    vi.mocked(repo.resetPasswordTx).mockResolvedValue(null)

    await expectAppError(
      service.resetPassword({ token, password: STRONG }),
      'AUTH_VERIFICATION_TOKEN_INVALID',
    )
  })

  it('doit lever AUTH_PASSWORD_TOO_WEAK sans consommer le jeton quand le mot de passe est faible', async () => {
    await expectAppError(
      service.resetPassword({ token, password: 'weak' }),
      'AUTH_PASSWORD_TOO_WEAK',
    )
    expect(repo.resetPasswordTx).not.toHaveBeenCalled()
  })
})

describe('verifyEmail', () => {
  const token = 'b'.repeat(64)

  it("doit marquer l'e-mail comme vérifié quand le jeton est valide", async () => {
    vi.mocked(repo.consumeVerificationToken).mockResolvedValue({
      id: 1n,
      userId: 3n,
      target: 'alice@example.com',
    })

    await service.verifyEmail(token)

    const [hash, purpose] = vi.mocked(repo.consumeVerificationToken).mock.calls[0] ?? []
    expect(purpose).toBe('verify_email')
    expect(Buffer.from(hash as Uint8Array).toString('hex')).toBe(
      Buffer.from(hashToken(token)).toString('hex'),
    )
    expect(repo.markEmailVerified).toHaveBeenCalledWith(3n)
  })

  it('doit lever AUTH_VERIFICATION_TOKEN_INVALID quand le jeton est invalide', async () => {
    vi.mocked(repo.consumeVerificationToken).mockResolvedValue(null)

    await expectAppError(service.verifyEmail(token), 'AUTH_VERIFICATION_TOKEN_INVALID')
    expect(repo.markEmailVerified).not.toHaveBeenCalled()
  })

  it("doit lever AUTH_VERIFICATION_TOKEN_INVALID quand le jeton n'a pas d'utilisateur", async () => {
    vi.mocked(repo.consumeVerificationToken).mockResolvedValue({
      id: 1n,
      userId: null,
      target: 'x',
    } as never)

    await expectAppError(service.verifyEmail(token), 'AUTH_VERIFICATION_TOKEN_INVALID')
    expect(repo.markEmailVerified).not.toHaveBeenCalled()
  })
})

describe('resendVerification', () => {
  it("doit créer un jeton de 24 h et envoyer l'e-mail quand l'adresse n'est pas vérifiée", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(userRow({ locale: 'en' }) as never)

    await service.resendVerification({ userId: 1n, ip: '1.2.3.4' })

    const args = vi.mocked(repo.createVerificationToken).mock.calls[0]?.[0]
    expect(args).toMatchObject({
      userId: 1n,
      purpose: 'verify_email',
      target: 'alice@example.com',
    })
    expect(args?.expiresAt.getTime()).toBe(NOW.getTime() + 24 * 3600 * 1000)
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      'en',
    )
  })

  it("ne doit rien faire quand l'adresse est déjà vérifiée", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(
      userRow({ emailVerifiedAt: '2025-12-02T00:00:00.000Z' }) as never,
    )

    await expect(service.resendVerification({ userId: 1n, ip: null })).resolves.toBeUndefined()
    expect(repo.createVerificationToken).not.toHaveBeenCalled()
    expect(email.sendVerificationEmail).not.toHaveBeenCalled()
  })

  it("ne doit rien faire quand l'utilisateur n'existe pas", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(null)

    await expect(service.resendVerification({ userId: 1n, ip: null })).resolves.toBeUndefined()
    expect(repo.createVerificationToken).not.toHaveBeenCalled()
    expect(email.sendVerificationEmail).not.toHaveBeenCalled()
  })

  it("ne doit rien faire quand l'utilisateur n'a pas d'e-mail", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(userRow({ email: null }) as never)

    await service.resendVerification({ userId: 1n, ip: null })

    expect(email.sendVerificationEmail).not.toHaveBeenCalled()
  })

  it("doit résoudre même si l'envoi de l'e-mail échoue", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(userRow() as never)
    vi.mocked(email.sendVerificationEmail).mockRejectedValue(new Error('smtp down'))

    await expect(service.resendVerification({ userId: 1n, ip: null })).resolves.toBeUndefined()
  })
})

describe('getMe', () => {
  it('doit renvoyer le profil mappé (id public uniquement)', async () => {
    vi.mocked(repo.getFreeTierRequiresPhoneOtp).mockResolvedValue(true)
    vi.mocked(repo.findUserById).mockResolvedValue(
      userRow({ emailVerifiedAt: '2025-12-02T00:00:00.000Z' }) as never,
    )

    const me = await service.getMe(1n)

    expect(me).toEqual({
      id: '0190a000-0000-7000-8000-000000000001',
      email: 'alice@example.com',
      email_verified: true,
      full_name: 'Alice',
      locale: 'fr',
      timezone: 'Europe/Paris',
      created_at: '2025-12-01T00:00:00.000Z',
      phone: null,
      phone_verified: false,
      free_tier_eligible: false,
    })
    expect(JSON.stringify(me)).not.toContain('"1"')
  })

  it("doit lever une AppError quand l'utilisateur n'existe pas", async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(null)

    await expectAppError(service.getMe(404n), 'AUTH_INVALID_CREDENTIALS')
  })
})
