/**
 * P2.2 — routes `POST /v1/auth/phone/request-code` et `/verify-code` (couche HTTP seule).
 * Le service est simulé : ce fichier prouve le câblage (validation zod → 422, défauts, en-têtes, cookie,
 * mapping des erreurs du catalogue, limite IP dédiée avec assurance mémoire quand Redis est injoignable)
 * et la régression P2.1 CA-32 (`Retry-After` sur la limite e-mail). Les preuves en base et dans Redis sont
 * dans `auth.phone.integration.test.ts`.
 *
 * Règles testées : spec P2.2 §3.1-§3.4, CA-5 (R, partie zod), CA-29/CA-31 (limite IP), CA-32 (R), D61.
 *
 * CONTRAT DE TEST : le service expose
 *   requestPhoneCode({phone,country,locale,ip,userAgent}) → {expiresInSeconds,resendAfterSeconds}
 *   verifyPhoneCode({phone,country,code,fullName?,rememberMe,locale,ip,userAgent})
 *       → {authResponse:{user,session}, isNewUser, token, maxAge}
 * Les routes sont montées sur /v1/auth ; la limite IP de la demande est de 20 / 15 min et celle de la
 * vérification de 60 / 15 min (§3.4, D60), avec des compteurs distincts.
 */
import { phoneVerifyCodeResponseSchema } from '@cp/shared/auth-schemas'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../app.js'
import { resetEnvCache } from '../../../env.js'
import { AppError } from '../../../lib/errors.js'
import { resetLimiters } from '../../../middlewares/rate-limit.js'
import { socketEnv, uniqueIp } from './phone-test-utils.js'

// ── Doubles : service téléphone + dépendances externes de /register (régression P2.1) ───────────

const phoneService = vi.hoisted(() => ({
  requestPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
  phoneLimitKey: vi.fn(),
}))
vi.mock('../auth.phone.service.js', () => phoneService)

vi.mock('../auth.repository.js', () => ({
  findUserByEmail: vi.fn().mockResolvedValue(null),
  createUserWithOrg: vi.fn().mockResolvedValue({
    userId: 1n,
    userPublicId: '01930000-0000-7000-8000-000000000001',
    orgId: 1n,
    orgPublicId: '01930000-0000-7000-8000-000000000002',
  }),
  createVerificationToken: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

vi.mock('../auth.password.js', async () => {
  const actual = await vi.importActual<typeof import('../auth.password.js')>('../auth.password.js')
  return {
    ...actual,
    hashPassword: vi.fn().mockResolvedValue('$argon2id$v=19$m=19456,t=2,p=1$hashed'),
  }
})

// ── Aides ───────────────────────────────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
type Json = any

const REQUEST_PATH = '/v1/auth/phone/request-code'
const VERIFY_PATH = '/v1/auth/phone/verify-code'
const PEPPER = 'r'.repeat(40)

let app: ReturnType<typeof createApp>['app']

function stubBaseEnv(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    OTP_PEPPER: PEPPER,
    SMS_PROVIDER: 'simulated',
    TRUSTED_PROXY_HOPS: '0',
    SESSION_COOKIE_NAME: 'cp_session',
    SESSION_MAX_AGE_SECONDS: '3600',
    SESSION_REMEMBER_MAX_AGE_SECONDS: '2592000',
    // Redis injoignable : ce sont les limiteurs mémoire d'assurance qui répondent (CA-31)
    REDIS_URL: 'redis://127.0.0.1:9',
    ...overrides,
  }
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  resetEnvCache()
  resetLimiters()
}

async function post(
  path: string,
  body: unknown,
  options: { ip?: string; headers?: Record<string, string>; raw?: boolean } = {},
) {
  const res = await app.request(
    path,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest-agent',
        ...options.headers,
      },
      body: options.raw ? (body as string) : JSON.stringify(body),
    },
    socketEnv(options.ip ?? uniqueIp()),
  )
  const text = await res.text()
  let json: Json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { res, json: json as Json, text }
}

function verifyResult(overrides: Record<string, unknown> = {}) {
  return {
    authResponse: {
      user: {
        id: '0190a000-0000-7000-8000-000000000001',
        email: null,
        email_verified: false,
        full_name: 'Awa Nkeng',
        locale: 'fr',
        timezone: 'Africa/Douala',
        created_at: '2026-10-06T10:00:00.000Z',
        phone: '+237690123442',
        phone_verified: true,
        free_tier_eligible: true,
      },
      session: {
        id: '0190a000-0000-7000-8000-0000000000aa',
        ip: '10.0.0.1',
        user_agent: 'vitest-agent',
        device_label: null,
        created_at: '2026-10-06T10:00:00.000Z',
        last_seen_at: '2026-10-06T10:00:00.000Z',
        is_current: true,
      },
    },
    isNewUser: true,
    token: 'session-token-abc',
    maxAge: 2592000,
    ...overrides,
  }
}

beforeAll(() => {
  stubBaseEnv()
  app = createApp().app
})

afterAll(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
  resetLimiters()
})

beforeEach(() => {
  stubBaseEnv()
  vi.clearAllMocks()
  phoneService.requestPhoneCode.mockResolvedValue({ expiresInSeconds: 300, resendAfterSeconds: 60 })
  phoneService.verifyPhoneCode.mockResolvedValue(verifyResult())
})

// ── POST /v1/auth/phone/request-code ────────────────────────────────────────────────────────────

describe('POST /v1/auth/phone/request-code — nominal', () => {
  it('doit répondre 200 {ok:true, expires_in_seconds:300, resend_after_seconds:60} sans authentification', async () => {
    const { res, json } = await post(REQUEST_PATH, { phone: '6 90 12 34 42' })
    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true, expires_in_seconds: 300, resend_after_seconds: 60 })
  })

  it('doit appeler le service avec les défauts country=CM, locale=fr, l’IP de la socket et le user-agent', async () => {
    const ip = uniqueIp()
    await post(REQUEST_PATH, { phone: '6 90 12 34 42' }, { ip })
    expect(phoneService.requestPhoneCode).toHaveBeenCalledTimes(1)
    expect(phoneService.requestPhoneCode).toHaveBeenCalledWith({
      phone: '6 90 12 34 42',
      country: 'CM',
      locale: 'fr',
      ip,
      userAgent: 'vitest-agent',
    })
  })

  it('doit transmettre country et locale explicites au service', async () => {
    await post(REQUEST_PATH, { phone: '77 123 45 67', country: 'SN', locale: 'en' })
    expect(phoneService.requestPhoneCode).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '77 123 45 67', country: 'SN', locale: 'en' }),
    )
  })

  it('doit rogner le numéro avant de le passer au service (z.string().trim())', async () => {
    await post(REQUEST_PATH, { phone: '   690123442  ' })
    expect(phoneService.requestPhoneCode).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '690123442' }),
    )
  })

  it('doit ignorer X-Forwarded-For quand TRUSTED_PROXY_HOPS=0 : l’IP transmise est celle de la socket', async () => {
    const ip = uniqueIp()
    await post(
      REQUEST_PATH,
      { phone: '690123442' },
      { ip, headers: { 'x-forwarded-for': '1.2.3.4' } },
    )
    expect(phoneService.requestPhoneCode).toHaveBeenCalledWith(expect.objectContaining({ ip }))
  })
})

describe('POST /v1/auth/phone/request-code — validation (CA-5, partie zod)', () => {
  it.each([
    ['numéro absent', {}],
    ['numéro trop court (< 4 caractères)', { phone: '123' }],
    ['numéro trop long (> 32 caractères)', { phone: '1'.repeat(33) }],
    ['pays hors liste', { phone: '690123442', country: 'GB' }],
    ['langue inconnue', { phone: '690123442', locale: 'de' }],
    ['numéro non textuel', { phone: 690123442 }],
  ])(
    'doit répondre 422 PLATFORM_VALIDATION_ERROR sans appeler le service : %s',
    async (_label, body) => {
      const { res, json } = await post(REQUEST_PATH, body)
      expect(res.status).toBe(422)
      expect(json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
      expect(json.error.request_id).toBeTruthy()
      expect(phoneService.requestPhoneCode).not.toHaveBeenCalled()
    },
  )

  it('doit répondre 4xx (jamais 500) sur un JSON malformé', async () => {
    const { res, json } = await post(REQUEST_PATH, '{bad', { raw: true })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(phoneService.requestPhoneCode).not.toHaveBeenCalled()
  })
})

describe('POST /v1/auth/phone/request-code — erreurs du catalogue', () => {
  it('doit relayer le 422 du service avec details {field, reason, expected_length} et sans écho de la saisie', async () => {
    phoneService.requestPhoneCode.mockRejectedValue(
      new AppError('PLATFORM_VALIDATION_ERROR', {
        field: 'phone',
        reason: 'TOO_SHORT',
        expected_length: 9,
      }),
    )
    const { res, json, text } = await post(REQUEST_PATH, { phone: '6 90 12 34' })
    expect(res.status).toBe(422)
    expect(json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(json.error.details).toEqual({ field: 'phone', reason: 'TOO_SHORT', expected_length: 9 })
    expect(text).not.toContain('6 90 12 34')
  })

  it('doit répondre 429 PLATFORM_RATE_LIMIT avec l’en-tête Retry-After du service', async () => {
    phoneService.requestPhoneCode.mockRejectedValue(
      new AppError('PLATFORM_RATE_LIMIT', undefined, { retryAfterSeconds: 42 }),
    )
    const { res, json } = await post(REQUEST_PATH, { phone: '690123442' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
    expect(json.error.code).toBe('PLATFORM_RATE_LIMIT')
  })

  it('doit répondre 503 AUTH_SMS_UNAVAILABLE avec details vide (ni fournisseur ni pile)', async () => {
    phoneService.requestPhoneCode.mockRejectedValue(
      new AppError('AUTH_SMS_UNAVAILABLE', { provider: 'secret', stack: 'at …' }),
    )
    const { res, json, text } = await post(REQUEST_PATH, { phone: '690123442' })
    expect(res.status).toBe(503)
    expect(json.error.code).toBe('AUTH_SMS_UNAVAILABLE')
    expect(json.error.details).toEqual({})
    expect(text).not.toContain('secret')
  })

  it('doit répondre 500 PLATFORM_INTERNAL_ERROR sans fuite quand le service lève une erreur inconnue', async () => {
    phoneService.requestPhoneCode.mockRejectedValue(
      new Error('connection to db-secret-host failed'),
    )
    const { res, json, text } = await post(REQUEST_PATH, { phone: '690123442' })
    expect(res.status).toBe(500)
    expect(json.error.code).toBe('PLATFORM_INTERNAL_ERROR')
    expect(text).not.toContain('db-secret-host')
  })
})

// ── POST /v1/auth/phone/verify-code ─────────────────────────────────────────────────────────────

describe('POST /v1/auth/phone/verify-code — nominal', () => {
  const body = { phone: '6 90 12 34 42', code: '270512', full_name: 'Awa Nkeng' }

  it('doit répondre 200 avec user, session et is_new_user conformes au schéma partagé', async () => {
    const { res, json } = await post(VERIFY_PATH, body)
    expect(res.status).toBe(200)
    expect(phoneVerifyCodeResponseSchema.safeParse(json).success).toBe(true)
    expect(json.is_new_user).toBe(true)
    expect(json.user.phone).toBe('+237690123442')
    expect(json.user.id).toBe('0190a000-0000-7000-8000-000000000001')
  })

  it('doit renvoyer is_new_user=false quand le service connecte un compte existant', async () => {
    phoneService.verifyPhoneCode.mockResolvedValue(verifyResult({ isNewUser: false }))
    const { json } = await post(VERIFY_PATH, body)
    expect(json.is_new_user).toBe(false)
  })

  it('ne doit jamais exposer le jeton de session, le hash ni un identifiant interne dans le corps JSON', async () => {
    const { text } = await post(VERIFY_PATH, body)
    expect(text).not.toContain('session-token-abc')
    expect(text).not.toMatch(/"(token|token_hash|organization_id|user_id|password_hash)"/)
  })

  it('doit poser un cookie HttpOnly; SameSite=Lax; Path=/ avec le Max-Age du service, sans Secure hors production', async () => {
    const { res } = await post(VERIFY_PATH, body)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('cp_session=session-token-abc')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=2592000')
    expect(cookie).not.toContain('Secure')
  })

  it('doit ajouter Secure au cookie en production', async () => {
    stubBaseEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'none' })
    const { res } = await post(VERIFY_PATH, body)
    expect(res.headers.get('set-cookie') ?? '').toContain('Secure')
  })

  it('doit appliquer les défauts country=CM, locale=fr et remember_me=true (D61) puis appeler le service', async () => {
    const ip = uniqueIp()
    await post(VERIFY_PATH, body, { ip })
    expect(phoneService.verifyPhoneCode).toHaveBeenCalledTimes(1)
    expect(phoneService.verifyPhoneCode).toHaveBeenCalledWith({
      phone: '6 90 12 34 42',
      country: 'CM',
      code: '270512',
      fullName: 'Awa Nkeng',
      rememberMe: true,
      locale: 'fr',
      ip,
      userAgent: 'vitest-agent',
    })
  })

  it('doit transmettre remember_me=false au service', async () => {
    await post(VERIFY_PATH, { ...body, remember_me: false })
    expect(phoneService.verifyPhoneCode).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: false }),
    )
  })

  it('doit appeler le service sans nom quand full_name est absent (connexion)', async () => {
    await post(VERIFY_PATH, { phone: '690123442', code: '270512' })
    const params = phoneService.verifyPhoneCode.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params.fullName ?? undefined).toBeUndefined()
  })

  it('doit transmettre un code à zéros initiaux tel quel (chaîne, jamais un nombre)', async () => {
    await post(VERIFY_PATH, { phone: '690123442', code: '000042' })
    expect(phoneService.verifyPhoneCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: '000042' }),
    )
  })
})

describe('POST /v1/auth/phone/verify-code — validation et erreurs', () => {
  it.each([
    ['code de 5 chiffres', { phone: '690123442', code: '12345' }],
    ['code de 7 chiffres', { phone: '690123442', code: '1234567' }],
    ['code non numérique', { phone: '690123442', code: 'abcdef' }],
    ['code numérique (nombre JSON)', { phone: '690123442', code: 270512 }],
    ['code absent', { phone: '690123442' }],
    ['numéro absent', { code: '270512' }],
    ['nom vide', { phone: '690123442', code: '270512', full_name: '' }],
    ['remember_me non booléen', { phone: '690123442', code: '270512', remember_me: 'oui' }],
  ])(
    'doit répondre 422 PLATFORM_VALIDATION_ERROR sans appeler le service ni poser de cookie : %s',
    async (_label, body) => {
      const { res, json } = await post(VERIFY_PATH, body)
      expect(res.status).toBe(422)
      expect(json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
      expect(res.headers.get('set-cookie')).toBeNull()
      expect(phoneService.verifyPhoneCode).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['AUTH_OTP_INVALID', 422, { remaining_attempts: 3 }],
    ['AUTH_OTP_EXPIRED', 422, undefined],
    ['AUTH_OTP_ATTEMPTS_EXCEEDED', 422, undefined],
    ['AUTH_ACCOUNT_SUSPENDED', 403, undefined],
    ['AUTH_SIGNUP_CLOSED', 403, undefined],
  ] as const)(
    'doit relayer %s en %s au format d’erreur unique, sans cookie',
    async (code, status, details) => {
      phoneService.verifyPhoneCode.mockRejectedValue(new AppError(code, details))
      const { res, json } = await post(VERIFY_PATH, { phone: '690123442', code: '270512' })
      expect(res.status).toBe(status)
      expect(json.error.code).toBe(code)
      expect(json.error.request_id).toBeTruthy()
      expect(json.error.documentation_url).toContain(`/errors/${code.toLowerCase()}`)
      expect(json.error.details).toEqual(details ?? {})
      expect(res.headers.get('set-cookie')).toBeNull()
    },
  )

  it('doit répondre 429 avec Retry-After quand la limite de vérification est atteinte', async () => {
    phoneService.verifyPhoneCode.mockRejectedValue(
      new AppError('PLATFORM_RATE_LIMIT', undefined, { retryAfterSeconds: 120 }),
    )
    const { res } = await post(VERIFY_PATH, { phone: '690123442', code: '270512' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('120')
  })
})

// ── Limite IP dédiée, assurance mémoire (CA-29, CA-31) ───────────────────────────────────────────

describe('limite IP dédiée avec Redis injoignable (CA-29, CA-31, §3.4)', () => {
  it('ne doit pas bloquer toutes les requêtes quand Redis est injoignable (limiteur mémoire d’assurance)', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () => post(REQUEST_PATH, { phone: '690123442' })),
    ).then((rs) => rs.map((r) => r.res.status))
    expect(statuses.filter((s) => s === 429)).toHaveLength(0)
    expect(statuses.every((s) => s === 200)).toBe(true)
  })

  it('doit accepter 20 demandes de code par IP puis refuser la 21e en 429 avec Retry-After entre 1 et 900 s', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 20; i++) {
      const { res } = await post(REQUEST_PATH, { phone: '690123442' }, { ip })
      expect(res.status, `demande ${i + 1}`).toBe(200)
    }
    const { res, json } = await post(REQUEST_PATH, { phone: '690123442' }, { ip })
    expect(res.status).toBe(429)
    expect(json.error.code).toBe('PLATFORM_RATE_LIMIT')
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(900)
    expect(phoneService.requestPhoneCode).toHaveBeenCalledTimes(20)
  })

  it('doit laisser passer une autre IP quand la première est limitée', async () => {
    const ipA = uniqueIp()
    for (let i = 0; i < 21; i++) await post(REQUEST_PATH, { phone: '690123442' }, { ip: ipA })
    const other = await post(REQUEST_PATH, { phone: '690123442' }, { ip: uniqueIp() })
    expect(other.res.status).toBe(200)
  })

  it('ne doit pas permettre de contourner la limite avec un X-Forwarded-For forgé (TRUSTED_PROXY_HOPS=0)', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 20; i++) await post(REQUEST_PATH, { phone: '690123442' }, { ip })
    const forged = await post(
      REQUEST_PATH,
      { phone: '690123442' },
      { ip, headers: { 'x-forwarded-for': uniqueIp() } },
    )
    expect(forged.res.status).toBe(429)
  })

  it('doit compter la demande et la vérification séparément : la limite de la demande ne bloque pas la vérification', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 21; i++) await post(REQUEST_PATH, { phone: '690123442' }, { ip })
    const verify = await post(VERIFY_PATH, { phone: '690123442', code: '270512' }, { ip })
    expect(verify.res.status).toBe(200)
  })

  it('doit accepter 60 vérifications par IP puis refuser la 61e en 429 avec Retry-After', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 60; i++) {
      const { res } = await post(VERIFY_PATH, { phone: '690123442', code: '270512' }, { ip })
      expect(res.status, `vérification ${i + 1}`).toBe(200)
    }
    const { res, json } = await post(VERIFY_PATH, { phone: '690123442', code: '270512' }, { ip })
    expect(res.status).toBe(429)
    expect(json.error.code).toBe('PLATFORM_RATE_LIMIT')
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
    expect(phoneService.verifyPhoneCode).toHaveBeenCalledTimes(60)
  })

  it('ne doit pas exiger de session : aucune des deux routes ne répond 401', async () => {
    const a = await post(REQUEST_PATH, { phone: '690123442' })
    const b = await post(VERIFY_PATH, { phone: '690123442', code: '270512' })
    expect([a.res.status, b.res.status]).toEqual([200, 200])
  })
})

// ── Régression P2.1 — CA-32 : Retry-After sur la limite par e-mail ───────────────────────────────

describe('régression P2.1 — limite par e-mail avec Retry-After (CA-32)', () => {
  const strong = 'StrongP@ss42!'

  it('doit répondre 429 avec Retry-After (entier entre 1 et 300) à la 6e inscription pour le même e-mail', async () => {
    const email = `rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
    for (let i = 0; i < 5; i++) {
      const { res } = await post('/v1/auth/register', { email, password: strong })
      expect(res.status, `inscription ${i + 1}`).toBe(200)
    }
    const { res, json } = await post('/v1/auth/register', { email, password: strong })
    expect(res.status).toBe(429)
    expect(json.error.code).toBe('PLATFORM_RATE_LIMIT')
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(300)
  })

  it('doit aussi porter Retry-After sur la limite par e-mail de forgot-password', async () => {
    const email = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
    for (let i = 0; i < 5; i++) {
      const { res } = await post('/v1/auth/forgot-password', { email })
      expect(res.status, `demande ${i + 1}`).toBe(200)
    }
    const { res } = await post('/v1/auth/forgot-password', { email })
    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(300)
  })
})
