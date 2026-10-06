/**
 * P2.2 — service téléphone, tests UNITAIRES (dépendances externes simulées : repository, fournisseur SMS,
 * bibliothèque de limitation de débit). Les preuves « en base » et « dans Redis » sont dans
 * `auth.phone.integration.test.ts` (PostgreSQL réel + Redis réel, aucun mock).
 *
 * Règles testées : spec P2.2 — CA-7 (U : aucune lecture de l'utilisateur à la demande), CA-38 (clé de
 * limite = HMAC(pepper, e164)), §3.4 (valeurs des limites, D60), §4.3 (stockage du code), §4.5 (ordre des
 * contrôles, compensation d'un envoi échoué), CA-39 (aucun import admin dans le code de production).
 *
 * CONTRAT DE TEST (à respecter par le code de production, voir le compte rendu du tester) :
 *   auth.phone.service.ts     : requestPhoneCode({phone,country,locale,ip,userAgent}) → {expiresInSeconds,resendAfterSeconds}
 *                               verifyPhoneCode({phone,country,code,fullName?,rememberMe,locale,ip,userAgent})
 *                               phoneLimitKey(e164, pepper) → string (HMAC-SHA256 hex)
 *   auth.phone.repository.ts  : findUserByPhone · getCountryRules · isBlocked · issueOtpToken · expireOtpTokens · verifyOtpTx
 *   sms/sms.factory.ts        : getSmsProvider()
 *
 * Phase RED : modules de production absents → chargement dynamique (un échec par test).
 */
import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../lib/errors.js'
import { loadSrc, uniqueCmPhone, wrongCodeFor } from './phone-test-utils.js'

// ── Doubles hissés (vi.mock est hissé avant les imports) ───────────────────────────────────────────

const doubles = vi.hoisted(() => ({
  codeOverride: null as number | null,
  provider: null as null | {
    name: string
    isAvailable: () => boolean
    send: (msg: { to: string; text: string; signal?: AbortSignal }) => Promise<void>
  },
  consumed: [] as { prefix: string; key: string }[],
  created: [] as { kind: 'redis' | 'memory'; opts: Record<string, unknown> }[],
  /** Renvoie le délai (ms) de refus pour (préfixe, clé), ou null pour accepter. */
  rejectFor: null as null | ((prefix: string, key: string) => number | null),
}))

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  const randomInt = ((...args: unknown[]) =>
    doubles.codeOverride !== null
      ? doubles.codeOverride
      : (actual.randomInt as (...a: unknown[]) => number)(...args)) as typeof actual.randomInt
  return { ...actual, randomInt, default: { ...actual, randomInt } }
})

vi.mock('ioredis', () => ({
  default: class FakeRedis {
    on() {
      return this
    }
    connect() {
      return Promise.resolve()
    }
    disconnect() {}
  },
}))

vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rate-limiter-flexible')>()
  class FakeMemory {
    constructor(public opts: Record<string, unknown>) {
      doubles.created.push({ kind: 'memory', opts })
    }
    async consume() {
      return new actual.RateLimiterRes(1, 0, 1, true)
    }
  }
  class FakeRedisLimiter {
    constructor(public opts: Record<string, unknown>) {
      doubles.created.push({ kind: 'redis', opts })
    }
    async consume(key: string) {
      const prefix = String(this.opts.keyPrefix)
      doubles.consumed.push({ prefix, key: String(key) })
      const ms = doubles.rejectFor?.(prefix, String(key)) ?? null
      if (ms !== null) throw new actual.RateLimiterRes(0, ms, 0, false)
      return new actual.RateLimiterRes(Number(this.opts.points) - 1, 0, 1, true)
    }
  }
  return { ...actual, RateLimiterMemory: FakeMemory, RateLimiterRedis: FakeRedisLimiter }
})

const repo = vi.hoisted(() => ({
  findUserByPhone: vi.fn(),
  getCountryRules: vi.fn(),
  isBlocked: vi.fn(),
  issueOtpToken: vi.fn(),
  expireOtpTokens: vi.fn(),
  verifyOtpTx: vi.fn(),
}))
vi.mock('../auth.phone.repository.js', () => repo)

vi.mock('../sms/sms.factory.js', () => ({
  getSmsProvider: () => doubles.provider,
  createSmsProvider: () => doubles.provider,
  setSmsProvider: (p: typeof doubles.provider) => {
    doubles.provider = p
  },
  resetSmsProvider: () => {},
}))

// ── Aides ───────────────────────────────────────────────────────────────────────────────────────

type ServiceModule = typeof import('../auth.phone.service.js')
const loadService = () => loadSrc<ServiceModule>('../auth.phone.service.js')

const PEPPER = 'u'.repeat(40)
const TTL_SECONDS = 300
const RESEND_SECONDS = 60

const sent: { to: string; text: string; signal?: AbortSignal }[] = []

function provider(overrides: Partial<NonNullable<typeof doubles.provider>> = {}) {
  return {
    name: 'fake',
    isAvailable: () => true,
    send: async (msg: { to: string; text: string; signal?: AbortSignal }) => {
      sent.push(msg)
    },
    ...overrides,
  }
}

function requestParams(overrides: Record<string, unknown> = {}) {
  const { national } = uniqueCmPhone()
  return {
    phone: national,
    country: 'CM' as const,
    locale: 'fr' as const,
    ip: '10.9.8.7',
    userAgent: 'vitest',
    ...overrides,
  }
}

function verifyParams(overrides: Record<string, unknown> = {}) {
  const { national } = uniqueCmPhone()
  return {
    phone: national,
    country: 'CM' as const,
    code: '270512',
    rememberMe: true,
    locale: 'fr' as const,
    ip: '10.9.8.7',
    userAgent: 'vitest',
    ...overrides,
  }
}

async function appErrorOf(promise: Promise<unknown>): Promise<AppError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err, 'une AppError était attendue').toBeInstanceOf(AppError)
  return err as AppError
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('OTP_PEPPER', PEPPER)
  vi.stubEnv('SMS_PROVIDER', 'simulated')
  vi.clearAllMocks()
  doubles.codeOverride = null
  doubles.consumed.length = 0
  doubles.created.length = 0
  doubles.rejectFor = null
  doubles.provider = provider()
  sent.length = 0
  repo.getCountryRules.mockResolvedValue({
    isActive: true,
    isSignupAllowed: true,
    defaultCurrency: 'XAF',
    defaultLanguage: 'fr',
  })
  repo.isBlocked.mockResolvedValue(false)
  repo.issueOtpToken.mockResolvedValue(undefined)
  repo.expireOtpTokens.mockResolvedValue(undefined)
  repo.findUserByPhone.mockResolvedValue(null)
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ── Demande de code ─────────────────────────────────────────────────────────────────────────────

describe('requestPhoneCode — anti-énumération (CA-7, preuve structurelle)', () => {
  it("ne doit jamais lire l'utilisateur (findUserByPhone) quand le numéro est inconnu", async () => {
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams())
    expect(repo.findUserByPhone).not.toHaveBeenCalled()
  })

  it("ne doit jamais lire l'utilisateur (findUserByPhone) même quand un compte existe pour ce numéro", async () => {
    repo.findUserByPhone.mockResolvedValue({ id: 7n, status: 'active' })
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams())
    expect(repo.findUserByPhone).not.toHaveBeenCalled()
    expect(repo.issueOtpToken).toHaveBeenCalledTimes(1)
  })

  it('doit rendre la même réponse et faire les mêmes écritures pour un numéro quelconque', async () => {
    const { requestPhoneCode } = await loadService()
    const a = await requestPhoneCode(requestParams())
    const b = await requestPhoneCode(requestParams())
    expect(a).toEqual(b)
    expect(repo.issueOtpToken).toHaveBeenCalledTimes(2)
    expect(sent).toHaveLength(2)
  })

  it('doit imposer un plancher de 300 ms sur la réponse (temps indépendant du chemin)', async () => {
    const { requestPhoneCode } = await loadService()
    const start = performance.now()
    await requestPhoneCode(requestParams())
    expect(performance.now() - start).toBeGreaterThanOrEqual(298)
  })
})

describe('requestPhoneCode — nominal et stockage du code (§4.3)', () => {
  it('doit renvoyer expiresInSeconds=300 et resendAfterSeconds=60', async () => {
    const { requestPhoneCode } = await loadService()
    await expect(requestPhoneCode(requestParams())).resolves.toEqual({
      expiresInSeconds: TTL_SECONDS,
      resendAfterSeconds: RESEND_SECONDS,
    })
  })

  it('doit envoyer UN SMS au numéro E.164 avec un code à 6 chiffres et un délai maximal de 5 s', async () => {
    const { national, e164 } = uniqueCmPhone()
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ phone: national }))

    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe(e164)
    expect(sent[0]?.text).toMatch(/(?<!\d)\d{6}(?!\d)/)
    expect(sent[0]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('doit rédiger le SMS en français (« 5 minutes », jamais « 10 minutes ») et en anglais selon la langue', async () => {
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ locale: 'fr' }))
    await requestPhoneCode(requestParams({ locale: 'en' }))
    const [fr, en] = sent
    expect(fr?.text).toContain('project-cp')
    expect(fr?.text).toContain('5 minutes')
    expect(fr?.text).not.toContain('10 minutes')
    expect(en?.text).toContain('project-cp')
    expect(en?.text).toContain('5 minutes')
    expect(en?.text).not.toBe(fr?.text)
  })

  it('doit conserver les zéros initiaux du code (randomInt=42 → « 000042 »)', async () => {
    doubles.codeOverride = 42
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams())
    expect(sent[0]?.text).toContain('000042')
  })

  it('doit stocker salt(16) ‖ HMAC-SHA256(pepper, salt ‖ otp_login ‖ e164 ‖ code) : 48 octets, jamais sha256(code)', async () => {
    doubles.codeOverride = 270512
    const { national, e164 } = uniqueCmPhone()
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ phone: national, ip: '10.1.2.3' }))

    expect(repo.issueOtpToken).toHaveBeenCalledTimes(1)
    const arg = repo.issueOtpToken.mock.calls[0]?.[0] as {
      target: string
      tokenHash: Uint8Array
      ip: string | null
    }
    expect(arg.target).toBe(e164)
    expect(arg.ip).toBe('10.1.2.3')
    const hash = Buffer.from(arg.tokenHash)
    expect(hash).toHaveLength(48)
    const salt = hash.subarray(0, 16)
    const expectedMac = createHmac('sha256', PEPPER)
      .update(
        Buffer.concat([salt, Buffer.from('otp_login'), Buffer.from(e164), Buffer.from('270512')]),
      )
      .digest()
    expect(hash.subarray(16).equals(expectedMac)).toBe(true)
  })

  it('doit utiliser un sel aléatoire différent à chaque demande (unicité de token_hash)', async () => {
    doubles.codeOverride = 111111
    const { requestPhoneCode } = await loadService()
    const params = requestParams()
    await requestPhoneCode(params)
    await requestPhoneCode(params)
    const [first, second] = repo.issueOtpToken.mock.calls.map((c) =>
      Buffer.from((c[0] as { tokenHash: Uint8Array }).tokenHash),
    )
    expect(first?.subarray(0, 16).equals(second?.subarray(0, 16) ?? Buffer.alloc(0))).toBe(false)
    expect(first?.equals(second ?? Buffer.alloc(0))).toBe(false)
  })
})

describe('requestPhoneCode — ordre des contrôles (§3.2 / §4.5)', () => {
  it('doit refuser un numéro invalide en 422 PLATFORM_VALIDATION_ERROR {field, reason, expected_length} sans rien consommer ni envoyer', async () => {
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams({ phone: '6 90 12 34' })))
    expect(err.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(err.httpStatus).toBe(422)
    expect(err.details).toEqual({ field: 'phone', reason: 'TOO_SHORT', expected_length: 9 })
    expect(doubles.consumed).toHaveLength(0)
    expect(repo.issueOtpToken).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it("ne doit jamais renvoyer la valeur saisie dans l'erreur de validation", async () => {
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams({ phone: '6 90 12 34' })))
    expect(JSON.stringify(err.details)).not.toMatch(/6 ?90 ?12 ?34/)
  })

  it('doit refuser un pays inactif (ref.countries.is_active=false) en 422 sans écrire ni envoyer', async () => {
    repo.getCountryRules.mockResolvedValue({
      isActive: false,
      isSignupAllowed: true,
      defaultCurrency: 'XAF',
      defaultLanguage: 'fr',
    })
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams()))
    expect(err.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(err.details).toMatchObject({ field: 'phone' })
    expect(repo.issueOtpToken).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it('doit répondre 429 avec Retry-After=ceil(ms/1000) quand le délai de renvoi par numéro est actif, sans rien écrire', async () => {
    doubles.rejectFor = (prefix) => (prefix === 'rl:auth:otp:req:phone' ? 41_200 : null)
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams()))
    expect(err.code).toBe('PLATFORM_RATE_LIMIT')
    expect(err.httpStatus).toBe(429)
    expect(err.retryAfterSeconds).toBe(42)
    expect(repo.isBlocked).not.toHaveBeenCalled()
    expect(repo.issueOtpToken).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it('doit répondre 429 quand la limite horaire par numéro est atteinte', async () => {
    doubles.rejectFor = (prefix) => (prefix === 'rl:auth:otp:req:phone:h' ? 1_800_000 : null)
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams()))
    expect(err.code).toBe('PLATFORM_RATE_LIMIT')
    expect(err.retryAfterSeconds).toBe(1800)
    expect(sent).toHaveLength(0)
  })

  it('doit répondre 503 AUTH_SMS_UNAVAILABLE sans détail quand le fournisseur est indisponible, avant la blocklist et toute écriture', async () => {
    doubles.provider = provider({ name: 'secret-provider-name', isAvailable: () => false })
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams()))
    expect(err.code).toBe('AUTH_SMS_UNAVAILABLE')
    expect(err.httpStatus).toBe(503)
    expect(Object.keys(err.details ?? {})).toHaveLength(0)
    expect(repo.isBlocked).not.toHaveBeenCalled()
    expect(repo.issueOtpToken).not.toHaveBeenCalled()
  })

  it('doit répondre normalement mais ne pas envoyer de SMS quand le numéro est bloqué (blocklist silencieuse)', async () => {
    repo.isBlocked.mockResolvedValue(true)
    const { requestPhoneCode } = await loadService()
    await expect(requestPhoneCode(requestParams())).resolves.toEqual({
      expiresInSeconds: TTL_SECONDS,
      resendAfterSeconds: RESEND_SECONDS,
    })
    expect(sent).toHaveLength(0)
  })

  it("doit interroger la blocklist avec le numéro E.164 et l'IP du client", async () => {
    const { national, e164 } = uniqueCmPhone()
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ phone: national, ip: '10.4.4.4' }))
    expect(repo.isBlocked).toHaveBeenCalledWith({ phone: e164, ip: '10.4.4.4' })
  })

  it('doit compenser un envoi en échec : jeton expiré, AUTH_SMS_UNAVAILABLE sans détail ni message du fournisseur', async () => {
    const { national, e164 } = uniqueCmPhone()
    doubles.provider = provider({
      send: async () => {
        throw new Error('boom-secret-provider-detail')
      },
    })
    const { requestPhoneCode } = await loadService()
    const err = await appErrorOf(requestPhoneCode(requestParams({ phone: national })))
    expect(err.code).toBe('AUTH_SMS_UNAVAILABLE')
    expect(Object.keys(err.details ?? {})).toHaveLength(0)
    expect(JSON.stringify(err)).not.toContain('boom-secret-provider-detail')
    expect(repo.expireOtpTokens).toHaveBeenCalledWith(e164)
  })
})

// ── Limites : valeurs (D60), clés HMAC (CA-38), assurance mémoire ─────────────────────────────

describe('limites de débit — valeurs du §3.4 (D60 : telles quelles) et clés (CA-38)', () => {
  it('doit configurer le délai de renvoi par numéro à 1 demande / 60 s et la limite horaire à 5 / h', async () => {
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams())
    const redisLimiters = doubles.created.filter((c) => c.kind === 'redis').map((c) => c.opts)
    expect(redisLimiters).toContainEqual(
      expect.objectContaining({ keyPrefix: 'rl:auth:otp:req:phone', points: 1, duration: 60 }),
    )
    expect(redisLimiters).toContainEqual(
      expect.objectContaining({ keyPrefix: 'rl:auth:otp:req:phone:h', points: 5, duration: 3600 }),
    )
  })

  it('doit configurer la limite de vérification par numéro à 10 / 15 min, avec un préfixe distinct de la demande', async () => {
    repo.verifyOtpTx.mockResolvedValue(undefined)
    const { verifyPhoneCode } = await loadService()
    await verifyPhoneCode(verifyParams()).catch(() => {})
    const redisLimiters = doubles.created.filter((c) => c.kind === 'redis').map((c) => c.opts)
    expect(redisLimiters).toContainEqual(
      expect.objectContaining({ keyPrefix: 'rl:auth:otp:verify:phone', points: 10, duration: 900 }),
    )
    const prefixes = redisLimiters.map((o) => String(o.keyPrefix))
    expect(prefixes.filter((p) => p.startsWith('rl:auth:otp:verify:')).length).toBeGreaterThan(0)
    expect(prefixes.some((p) => p.startsWith('rl:auth:otp:req:'))).toBe(false)
  })

  it("doit doter chaque limiteur Redis d'un insuranceLimiter mémoire (une panne Redis ne bloque personne, CA-31)", async () => {
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams())
    const redisLimiters = doubles.created.filter((c) => c.kind === 'redis')
    expect(redisLimiters.length).toBeGreaterThan(0)
    for (const limiter of redisLimiters) {
      expect(limiter.opts.insuranceLimiter, String(limiter.opts.keyPrefix)).toBeDefined()
    }
  })

  it('doit calculer la clé de la limite par numéro avec HMAC-SHA256(OTP_PEPPER, e164) en hexadécimal (CA-38)', async () => {
    const { national, e164 } = uniqueCmPhone()
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ phone: national }))
    const expected = createHmac('sha256', PEPPER).update(e164).digest('hex')
    const phoneKeys = doubles.consumed.filter((c) => c.prefix.startsWith('rl:auth:otp:req:phone'))
    expect(phoneKeys.length).toBeGreaterThanOrEqual(2)
    for (const consumed of phoneKeys) expect(consumed.key).toBe(expected)
  })

  it('ne doit jamais mettre les chiffres du numéro dans une clé de limite', async () => {
    const { national, e164 } = uniqueCmPhone()
    const { requestPhoneCode } = await loadService()
    await requestPhoneCode(requestParams({ phone: national }))
    for (const consumed of doubles.consumed) {
      expect(consumed.key).not.toContain(national)
      expect(consumed.key).not.toContain(e164.slice(1))
    }
  })

  it('doit produire une clé différente avec un pepper différent et jamais le sha256 brut du numéro', async () => {
    const { phoneLimitKey } = await loadService()
    const { e164 } = uniqueCmPhone()
    const a = phoneLimitKey(e164, 'a'.repeat(40))
    const b = phoneLimitKey(e164, 'b'.repeat(40))
    expect(a).not.toBe(b)
    expect(a).toBe(createHmac('sha256', 'a'.repeat(40)).update(e164).digest('hex'))
    const { createHash } = await import('node:crypto')
    expect(a).not.toBe(createHash('sha256').update(e164).digest('hex'))
    expect(phoneLimitKey(e164, 'a'.repeat(40))).toBe(a)
  })
})

// ── Vérification : contrôles avant la transaction ──────────────────────────────────────────────

describe('verifyPhoneCode — contrôles avant la transaction (§4.5)', () => {
  it('doit refuser un numéro invalide en 422 sans limite consommée ni transaction', async () => {
    const { verifyPhoneCode } = await loadService()
    const err = await appErrorOf(verifyPhoneCode(verifyParams({ phone: '6 90 12 34' })))
    expect(err.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(err.details).toMatchObject({ field: 'phone', reason: 'TOO_SHORT' })
    expect(doubles.consumed).toHaveLength(0)
    expect(repo.verifyOtpTx).not.toHaveBeenCalled()
  })

  it('doit répondre 429 + Retry-After quand la limite de vérification par numéro est atteinte, avant la blocklist et la transaction', async () => {
    doubles.rejectFor = (prefix) => (prefix === 'rl:auth:otp:verify:phone' ? 12_000 : null)
    const { verifyPhoneCode } = await loadService()
    const err = await appErrorOf(verifyPhoneCode(verifyParams()))
    expect(err.code).toBe('PLATFORM_RATE_LIMIT')
    expect(err.retryAfterSeconds).toBe(12)
    expect(repo.isBlocked).not.toHaveBeenCalled()
    expect(repo.verifyOtpTx).not.toHaveBeenCalled()
  })

  it('doit calculer la clé de la limite de vérification par numéro avec le même HMAC que la demande, sous un autre préfixe', async () => {
    const { national, e164 } = uniqueCmPhone()
    repo.verifyOtpTx.mockResolvedValue(undefined)
    const { verifyPhoneCode } = await loadService()
    await verifyPhoneCode(verifyParams({ phone: national })).catch(() => {})
    const mine = doubles.consumed.filter((c) => c.prefix === 'rl:auth:otp:verify:phone')
    expect(mine).toHaveLength(1)
    expect(mine[0]?.key).toBe(createHmac('sha256', PEPPER).update(e164).digest('hex'))
  })

  it('doit répondre AUTH_OTP_INVALID (sans remaining_attempts) quand le numéro est bloqué entre la demande et la vérification, sans transaction', async () => {
    repo.isBlocked.mockResolvedValue(true)
    const { verifyPhoneCode } = await loadService()
    const err = await appErrorOf(verifyPhoneCode(verifyParams()))
    expect(err.code).toBe('AUTH_OTP_INVALID')
    expect(err.httpStatus).toBe(422)
    expect(err.details ?? {}).not.toHaveProperty('remaining_attempts')
    expect(repo.verifyOtpTx).not.toHaveBeenCalled()
  })

  it("ne doit jamais lire l'utilisateur hors de la transaction de vérification quand le code est faux", async () => {
    repo.verifyOtpTx.mockResolvedValue(undefined)
    const { verifyPhoneCode } = await loadService()
    await verifyPhoneCode(verifyParams({ code: wrongCodeFor('270512') })).catch(() => {})
    expect(repo.findUserByPhone).not.toHaveBeenCalled()
  })
})

// ── Garde d'architecture (CA-39) ───────────────────────────────────────────────────────────────

describe("garde d'architecture (CA-39, règle 23 du garde-fou)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const srcRoot = path.resolve(here, '../../..')

  function productionFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) return name === '__tests__' ? [] : productionFiles(full)
      return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
    })
  }

  it('ne doit importer @cp/db/admin dans aucun fichier de production de apps/api/src', () => {
    const offenders = productionFiles(srcRoot).filter((file) =>
      /@cp\/db\/admin|getPoolAdmin|getDbAdmin/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('doit contenir le module téléphone (sinon la garde ne prouve rien)', () => {
    const files = productionFiles(srcRoot).map((f) => path.relative(srcRoot, f))
    expect(files).toContain(path.join('modules', 'auth', 'auth.phone.service.ts'))
    expect(files).toContain(path.join('modules', 'auth', 'auth.phone.repository.ts'))
  })
})
