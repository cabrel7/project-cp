/**
 * P2.2 — connexion / inscription par téléphone : INTÉGRATION, PostgreSQL réel + Redis réel.
 * Aucun mock du repository, du SQL ni de Redis. Seules frontières simulées : l'e-mail (SMTP, comme P2.1)
 * et le fournisseur SMS (boîte mémoire `getSimulatedOutbox()` ; un fournisseur défaillant injecté pour
 * la compensation). Le code est lu dans la boîte simulée, jamais en base (il y est haché).
 *
 * Règles testées : spec P2.2 CA-5 à CA-30, CA-35, CA-39, CA-40. Les 7 tests obligatoires sont préfixés
 * « [OBLIGATOIRE] ». Garde-fou : avec CP_REQUIRE_INTEGRATION, une base ou un Redis absent = ÉCHEC (jamais un saut).
 *
 * CONTRAT DE TEST : voir le compte rendu du tester (config injectable `auth.phone.config.ts`:
 * setPhoneConfig/resetPhoneConfig ; `sms/sms.factory.ts`: setSmsProvider/resetSmsProvider ;
 * `sms/sms.simulated.ts`: getSimulatedOutbox ; clés Redis `rl:auth:otp:*` du §3.4 avec HMAC-SHA256 hex).
 */
import { createHmac } from 'node:crypto'
import { getPoolAuth, getPoolRw, withOrgContext } from '@cp/db'
import { sql } from 'drizzle-orm'
import Redis from 'ioredis'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../app.js'
import { getEnv, resetEnvCache } from '../../../env.js'
import { resetLimiters } from '../../../middlewares/rate-limit.js'
import {
  extractCode,
  loadSrc,
  socketEnv,
  uniqueCmPhone,
  uniqueIp,
  uniqueSnPhone,
  wrongCodeFor,
} from './phone-test-utils.js'

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
type Json = any
type Sim = typeof import('../sms/sms.simulated.js')
type Factory = typeof import('../sms/sms.factory.js')
type Config = typeof import('../auth.phone.config.js')

const REQ = '/v1/auth/phone/request-code'
const VER = '/v1/auth/phone/verify-code'
const PEPPER = 'i'.repeat(40)

const env = (k: string): string | undefined => process.env[k]

async function probeDb(): Promise<boolean> {
  if (!env('DATABASE_URL_RW') || !env('DATABASE_URL_AUTH') || !env('DATABASE_URL_ADMIN'))
    return false
  try {
    await getPoolRw()`SELECT 1`
    return true
  } catch {
    return false
  }
}
async function probeRedis(): Promise<boolean> {
  const r = new Redis(env('REDIS_URL') ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  try {
    await r.connect()
    return (await r.ping()) === 'PONG'
  } catch {
    return false
  } finally {
    r.disconnect()
  }
}

const hasDb = await probeDb()
const hasRedis = await probeRedis()
if (env('CP_REQUIRE_INTEGRATION') && !(hasDb && hasRedis)) {
  throw new Error(
    `CP_REQUIRE_INTEGRATION est défini mais PostgreSQL (${hasDb}) et/ou Redis (${hasRedis}) est injoignable : un saut serait un faux vert`,
  )
}

describe.skipIf(!(hasDb && hasRedis))('Auth téléphone (PostgreSQL réel + Redis réel)', () => {
  let app: ReturnType<typeof createApp>['app']
  let adminPool: Awaited<ReturnType<typeof import('@cp/db/admin')['getPoolAdmin']>>
  let redis: Redis
  const usedPhones = new Set<string>()
  const usedEmails = new Set<string>()
  const blockEntries: string[] = []

  const sim = () => loadSrc<Sim>('../sms/sms.simulated.js')
  const factory = () => loadSrc<Factory>('../sms/sms.factory.js')
  const config = () => loadSrc<Config>('../auth.phone.config.js')

  async function asAdmin<T>(fn: (s: typeof adminPool) => Promise<T>): Promise<T> {
    return adminPool.begin(async (tx) => {
      await tx`SET LOCAL ROLE app_admin`
      return fn(tx as unknown as typeof adminPool)
    }) as Promise<T>
  }

  const hmac = (e164: string) => createHmac('sha256', PEPPER).update(e164).digest('hex')

  async function post(
    path: string,
    body: unknown,
    ip: string,
    headers: Record<string, string> = {},
  ) {
    const t0 = performance.now()
    const res = await app.request(
      path,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest', ...headers },
        body: JSON.stringify(body),
      },
      socketEnv(ip),
    )
    const elapsed = performance.now() - t0
    const text = await res.text()
    let json: Json = null
    try {
      json = JSON.parse(text)
    } catch {}
    return { res, json: json as Json, text, elapsed }
  }

  const requestCode = (p: { national: string; e164: string }, ip: string, extra: object = {}) => {
    usedPhones.add(p.e164)
    return post(REQ, { phone: p.national, country: 'CM', ...extra }, ip)
  }
  async function lastCode(e164: string): Promise<string> {
    const { getSimulatedOutbox } = await sim()
    const mine = getSimulatedOutbox().filter((m) => m.to === e164)
    const last = mine[mine.length - 1]
    if (!last) throw new Error(`aucun SMS simulé pour ${e164}`)
    return extractCode(last.text)
  }
  const verify = (
    p: { national: string; e164: string },
    code: string,
    ip: string,
    extra: object = {},
  ) => {
    usedPhones.add(p.e164)
    return post(VER, { phone: p.national, country: 'CM', code, ...extra }, ip)
  }
  async function signup(
    p: { national: string; e164: string },
    name = 'Awa Nkeng',
    ip = uniqueIp(),
  ) {
    const r1 = await requestCode(p, ip)
    expect(r1.res.status).toBe(200)
    const r2 = await verify(p, await lastCode(p.e164), ip, { full_name: name })
    return r2
  }
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

  const tokens = (e164: string) =>
    asAdmin(
      (
        s,
      ) => s`SELECT id, purpose, target, user_id, attempts, max_attempts, consumed_at, host(ip) AS ip,
        octet_length(token_hash) AS hash_len, token_hash, expires_at, created_at,
        EXTRACT(EPOCH FROM (expires_at - created_at)) AS ttl,
        EXTRACT(EPOCH FROM (expires_at - now())) AS remaining,
        (consumed_at IS NULL AND expires_at > now()) AS active
        FROM iam.verification_tokens WHERE target = ${e164} AND purpose = 'otp_login' ORDER BY id`,
    )
  const userByPhone = (e164: string) =>
    asAdmin((s) => s`SELECT * FROM iam.users WHERE phone_e164 = ${e164}`)
  const sessionsOf = (userId: string) =>
    asAdmin((s) => s`SELECT id FROM iam.user_sessions WHERE user_id = ${userId}`)
  const orgsOf = (userId: string) =>
    asAdmin((s) => s`SELECT * FROM iam.organizations WHERE created_by_user_id = ${userId}`)
  const countUsers = () =>
    asAdmin((s) => s`SELECT count(*)::int AS n FROM iam.users`).then((r) => Number(r[0]?.n))

  async function withBlock(kind: string, value: string, expired: boolean, fn: () => Promise<void>) {
    await asAdmin(
      (s) =>
        s`INSERT INTO platform.blocklist_entries (kind, value, reason, expires_at)
          VALUES (${kind}, ${value}, 'test P2.2', ${expired ? new Date(Date.now() - 3600_000).toISOString() : null}::timestamptz)
          ON CONFLICT (kind, value) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    )
    blockEntries.push(`${kind}|${value}`)
    try {
      await fn()
    } finally {
      await asAdmin(
        (s) => s`DELETE FROM platform.blocklist_entries WHERE kind = ${kind} AND value = ${value}`,
      )
    }
  }

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('LOG_LEVEL', 'error')
    vi.stubEnv('OTP_PEPPER', PEPPER)
    vi.stubEnv('SMS_PROVIDER', 'simulated')
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0')
    resetEnvCache()
    const { getPoolAdmin } = await import('@cp/db/admin')
    adminPool = getPoolAdmin()
    redis = new Redis(env('REDIS_URL') ?? 'redis://localhost:6379')
    app = createApp().app
  })

  beforeEach(() => {
    resetLimiters()
  })

  afterEach(async () => {
    try {
      ;(await config()).resetPhoneConfig()
    } catch {}
    try {
      ;(await factory()).resetSmsProvider()
    } catch {}
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('SMS_PROVIDER', 'simulated')
    resetEnvCache()
    resetLimiters()
  })

  afterAll(async () => {
    const phones = [...usedPhones]
    const emails = [...usedEmails]
    await asAdmin(async (s) => {
      const ids = s`SELECT id FROM iam.users WHERE phone_e164 = ANY(${phones}) OR email = ANY(${emails})`
      await s`DELETE FROM iam.verification_tokens WHERE target = ANY(${phones}) OR target = ANY(${emails}) OR user_id IN (${ids})`
      await s`DELETE FROM iam.user_sessions WHERE user_id IN (${ids})`
      await s`DELETE FROM iam.memberships WHERE user_id IN (${ids})`
      const orgs = s`SELECT id FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await s`DELETE FROM iam.environments WHERE organization_id IN (${orgs})`
      await s`DELETE FROM iam.workspaces WHERE organization_id IN (${orgs})`
      await s`DELETE FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await s`DELETE FROM iam.users WHERE phone_e164 = ANY(${phones}) OR email = ANY(${emails})`
      for (const e of blockEntries) {
        const [k, v] = e.split('|')
        await s`DELETE FROM platform.blocklist_entries WHERE kind = ${k ?? ''} AND value = ${v ?? ''}`
      }
      await s`UPDATE ref.countries SET is_signup_allowed = true WHERE code = 'SN'`
      await s`UPDATE platform.settings SET value = 'true'::jsonb WHERE key = 'free_tier.require_phone_otp'`
    }).catch(() => {})
    redis.disconnect()
    vi.unstubAllEnvs()
    resetEnvCache()
  })

  // ── Demande de code ───────────────────────────────────────────────────────────────────────

  describe('demande de code', () => {
    it('CA-6 : numéro inconnu → 200, un jeton haché en base (5 min, 5 essais, IP), un SMS, aucun utilisateur', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      const { res, json } = await requestCode(p, ip)
      expect(res.status).toBe(200)
      expect(json).toEqual({ ok: true, expires_in_seconds: 300, resend_after_seconds: 60 })

      const rows = await tokens(p.e164)
      expect(rows).toHaveLength(1)
      const t = rows[0] as Json
      expect(t.purpose).toBe('otp_login')
      expect(t.user_id).toBeNull()
      expect(t.max_attempts).toBe(5)
      expect(t.attempts).toBe(0)
      expect(t.ip).toBe(ip)
      expect(Number(t.ttl)).toBeGreaterThanOrEqual(299)
      expect(Number(t.ttl)).toBeLessThanOrEqual(301)
      expect(Number(t.remaining)).toBeGreaterThan(280)
      expect(Number(t.remaining)).toBeLessThanOrEqual(301)
      expect(t.hash_len).toBe(48)
      expect(await userByPhone(p.e164)).toHaveLength(0)

      const { getSimulatedOutbox } = await sim()
      const mine = getSimulatedOutbox().filter((m) => m.to === p.e164)
      expect(mine).toHaveLength(1)
      expect(mine[0]?.text).toMatch(/(?<!\d)\d{6}(?!\d)/)
    })

    it('CA-6 (stockage) : token_hash = sel(16) ‖ HMAC-SHA256(pepper, sel ‖ otp_login ‖ e164 ‖ code), pas sha256(code)', async () => {
      const p = uniqueCmPhone()
      await requestCode(p, uniqueIp())
      const code = await lastCode(p.e164)
      const hash = Buffer.from(((await tokens(p.e164))[0] as Json).token_hash)
      const mac = createHmac('sha256', getEnv().OTP_PEPPER)
        .update(
          Buffer.concat([
            hash.subarray(0, 16),
            Buffer.from('otp_login'),
            Buffer.from(p.e164),
            Buffer.from(code),
          ]),
        )
        .digest()
      expect(hash.subarray(16).equals(mac)).toBe(true)
      const { createHash } = await import('node:crypto')
      expect(hash.subarray(0, 32).equals(createHash('sha256').update(code).digest())).toBe(false)
    })

    // Comptage restreint aux cibles que ce test pourrait produire (saisie brute ou normalisation partielle) :
    // un comptage global de `verification_tokens` casserait si un autre fichier d'intégration tourne en parallèle.
    const countCa5Tokens = () =>
      asAdmin(
        (s) =>
          s`SELECT count(*)::int AS n FROM iam.verification_tokens
            WHERE target IN ('6 90 12 34', '6901234', '+2376901234', '+6901234')`,
      )

    it('CA-5 (R) : numéro invalide → 422 {field, reason, expected_length}, aucune ligne, aucun SMS, saisie non renvoyée', async () => {
      const before = await countCa5Tokens()
      const { getSimulatedOutbox } = await sim()
      const nSms = getSimulatedOutbox().length
      const { res, json, text } = await post(
        REQ,
        { phone: '6 90 12 34', country: 'CM' },
        uniqueIp(),
      )
      expect(res.status).toBe(422)
      expect(json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
      expect(json.error.details).toEqual({
        field: 'phone',
        reason: 'TOO_SHORT',
        expected_length: 9,
      })
      expect(text).not.toContain('6 90 12 34')
      expect(text).not.toContain('6901234')
      const after = await countCa5Tokens()
      expect(after[0]?.n).toBe(before[0]?.n)
      expect(getSimulatedOutbox().length).toBe(nSms)
    })

    it('CA-7 (I) : numéro existant et inconnu → statut, corps et en-têtes RateLimit identiques, 1 jeton + 1 SMS chacun', async () => {
      const known = uniqueCmPhone()
      expect((await signup(known)).res.status).toBe(200)
      await redis.del(`rl:auth:otp:req:phone:${hmac(known.e164)}`) // lève le délai de renvoi (60 s, CA-27)
      const unknown = uniqueCmPhone()
      const a = await requestCode(known, uniqueIp())
      const b = await requestCode(unknown, uniqueIp())
      expect(a.res.status).toBe(b.res.status)
      expect(a.json).toEqual(b.json)
      const rl = (r: Response) =>
        [...r.headers.entries()].filter(([k]) => /ratelimit|retry-after/i.test(k)).sort()
      expect(rl(a.res).map(([k]) => k)).toEqual(rl(b.res).map(([k]) => k))
      for (const k of ['ratelimit-limit', 'ratelimit-remaining']) {
        expect(a.res.headers.get(k)).toBe(b.res.headers.get(k))
      }
      expect((await tokens(known.e164)).length).toBe(2) // inscription + cette demande
      expect((await tokens(unknown.e164)).length).toBe(1)
      const { getSimulatedOutbox } = await sim()
      expect(getSimulatedOutbox().filter((m) => m.to === unknown.e164)).toHaveLength(1)
      expect(getSimulatedOutbox().filter((m) => m.to === known.e164)).toHaveLength(2)
    })

    it('CA-7 (R) : toute réponse 200 respecte un plancher de 300 ms (inconnu, existant, bloqué)', async () => {
      const known = uniqueCmPhone()
      await signup(known)
      await redis.del(`rl:auth:otp:req:phone:${hmac(known.e164)}`) // lève le délai de renvoi (60 s, CA-27)
      const blocked = uniqueCmPhone()
      const times: number[] = []
      times.push((await requestCode(uniqueCmPhone(), uniqueIp())).elapsed)
      times.push((await requestCode(known, uniqueIp())).elapsed)
      await withBlock('phone', blocked.e164, false, async () => {
        const r = await requestCode(blocked, uniqueIp())
        expect(r.res.status).toBe(200)
        times.push(r.elapsed)
      })
      for (const t of times) expect(t).toBeGreaterThanOrEqual(298)
    })

    it('CA-8 : une nouvelle demande expire l’ancien code (C1 → AUTH_OTP_INVALID) et C2 fonctionne', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const c1 = await lastCode(p.e164)
      await redis.del(`rl:auth:otp:req:phone:${hmac(p.e164)}`) // lève le délai de renvoi (60 s)
      await requestCode(p, ip)
      const c2 = await lastCode(p.e164)
      const rows = await tokens(p.e164)
      expect(rows).toHaveLength(2)
      expect(new Date((rows[0] as Json).expires_at).getTime()).toBeLessThanOrEqual(Date.now())
      if (c1 !== c2) {
        const bad = await verify(p, c1, ip)
        expect(bad.res.status).toBe(422)
        expect(bad.json.error.code).toBe('AUTH_OTP_INVALID')
      }
      expect((await verify(p, c2, ip, { full_name: 'Awa' })).res.status).toBe(200)
    })

    it.each([
      ['phone', (p: { e164: string }) => p.e164],
      ['ip', (_p: { e164: string }, ip: string) => ip],
      ['cidr', (_p: { e164: string }, ip: string) => `${ip}/32`],
    ])(
      'CA-9 : entrée de blocklist « %s » active → 200 identique, aucun SMS',
      async (kind, blockValue) => {
        const p = uniqueCmPhone()
        const ip = uniqueIp()
        await withBlock(kind, blockValue(p, ip), false, async () => {
          const { res, json } = await requestCode(p, ip)
          expect(res.status).toBe(200)
          expect(json).toEqual({ ok: true, expires_in_seconds: 300, resend_after_seconds: 60 })
          const { getSimulatedOutbox } = await sim()
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(0)
        })
      },
    )

    it('CA-9 : une entrée de blocklist expirée n’a aucun effet (le SMS part)', async () => {
      const p = uniqueCmPhone()
      await withBlock('phone', p.e164, true, async () => {
        await requestCode(p, uniqueIp())
        const { getSimulatedOutbox } = await sim()
        expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(1)
      })
    })
  })

  // ── Vérification ──────────────────────────────────────────────────────────────────────────

  describe('vérification du code', () => {
    it('[OBLIGATOIRE] inscription par téléphone (CA-10)', async () => {
      const p = uniqueCmPhone()
      const { res, json } = await signup(p, 'Awa Nkeng')
      expect(res.status).toBe(200)
      expect(json.is_new_user).toBe(true)
      const cookie = res.headers.get('set-cookie') ?? ''
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).not.toContain('Secure')
      expect(cookie).toContain(`Max-Age=${getEnv().SESSION_REMEMBER_MAX_AGE_SECONDS}`) // remember_me=true par défaut (D61)

      const u = (await userByPhone(p.e164))[0] as Json
      expect(u.phone_verified_at).not.toBeNull()
      expect(u.email).toBeNull()
      expect(u.password_hash).toBeNull()
      expect(u.status).toBe('active')
      expect(u.country_code).toBe('CM')
      const orgs = await orgsOf(u.id)
      expect(orgs).toHaveLength(1)
      const org = orgs[0] as Json
      expect(org.slug).toBe(`user-${u.public_id}`)
      expect(org.kind).toBe('individual')
      expect(org.default_currency).toBe('XAF')
      expect(org.name).toBe('Awa Nkeng')
      expect(org.name).not.toContain(p.national)
      const m = await asAdmin(
        (s) =>
          s`SELECT r.key FROM iam.memberships mm JOIN iam.roles r ON r.id = mm.role_id WHERE mm.organization_id = ${org.id} AND mm.user_id = ${u.id}`,
      )
      expect(m.map((r) => r.key)).toEqual(['owner'])
      expect(
        await asAdmin((s) => s`SELECT 1 FROM iam.workspaces WHERE organization_id = ${org.id}`),
      ).toHaveLength(1)
      const envs = await asAdmin(
        (s) => s`SELECT key FROM iam.environments WHERE organization_id = ${org.id}`,
      )
      expect(envs.map((e) => e.key).sort()).toEqual(['production', 'sandbox'])
      expect(await sessionsOf(u.id)).toHaveLength(1)
      expect(((await tokens(p.e164))[0] as Json).consumed_at).not.toBeNull()
    })

    it('CA-10 : remember_me=false → cookie de durée courte', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const { res } = await verify(p, await lastCode(p.e164), ip, {
        full_name: 'Awa',
        remember_me: false,
      })
      expect(res.headers.get('set-cookie')).toContain(`Max-Age=${getEnv().SESSION_MAX_AGE_SECONDS}`)
    })

    it('[OBLIGATOIRE] connexion par code (CA-11)', async () => {
      const p = uniqueCmPhone()
      const first = await signup(p, 'Awa Nkeng')
      const usersBefore = await countUsers()
      const u = (await userByPhone(p.e164))[0] as Json
      const orgsBefore = (await orgsOf(u.id)).length
      const ip = uniqueIp()
      await redis.del(`rl:auth:otp:req:phone:${hmac(p.e164)}`)
      await requestCode(p, ip)
      const { res, json } = await verify(p, await lastCode(p.e164), ip, { full_name: 'Autre Nom' })
      expect(res.status).toBe(200)
      expect(json.is_new_user).toBe(false)
      expect(json.user.id).toBe(first.json.user.id)
      const after = (await userByPhone(p.e164))[0] as Json
      expect(after.full_name).toBe('Awa Nkeng')
      expect(after.last_login_at).not.toBeNull()
      expect(await countUsers()).toBeGreaterThanOrEqual(usersBefore)
      expect((await orgsOf(u.id)).length).toBe(orgsBefore)
      expect(await sessionsOf(u.id)).toHaveLength(2)
    })

    it('[OBLIGATOIRE] code expiré (CA-12) : 422 AUTH_OTP_EXPIRED, attempts inchangé, aucune session', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const code = await lastCode(p.e164)
      await asAdmin(
        (s) =>
          s`UPDATE iam.verification_tokens SET expires_at = now() - interval '1 minute' WHERE target = ${p.e164}`,
      )
      const { res, json } = await verify(p, code, ip)
      expect(res.status).toBe(422)
      expect(json.error.code).toBe('AUTH_OTP_EXPIRED')
      expect(((await tokens(p.e164))[0] as Json).attempts).toBe(0)
      expect(await userByPhone(p.e164)).toHaveLength(0)
    })

    it('[OBLIGATOIRE] 6ᵉ essai refusé (CA-13) : 5 codes faux (4,3,2,1,0 restants) puis AUTH_OTP_ATTEMPTS_EXCEEDED même avec le bon code', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const good = await lastCode(p.e164)
      const bad = wrongCodeFor(good)
      for (const remaining of [4, 3, 2, 1, 0]) {
        const { res, json } = await verify(p, bad, ip)
        expect(res.status).toBe(422)
        expect(json.error.code).toBe('AUTH_OTP_INVALID')
        expect(json.error.details.remaining_attempts).toBe(remaining)
      }
      const sixth = await verify(p, good, ip)
      expect(sixth.res.status).toBe(422)
      expect(sixth.json.error.code).toBe('AUTH_OTP_ATTEMPTS_EXCEEDED')
      expect(((await tokens(p.e164))[0] as Json).attempts).toBe(5)
      expect(await userByPhone(p.e164)).toHaveLength(0)
    })

    it('CA-13 (variante) : 4 codes faux puis le bon au 5ᵉ essai → 200', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const good = await lastCode(p.e164)
      for (let i = 0; i < 4; i++)
        expect((await verify(p, wrongCodeFor(good), ip)).res.status).toBe(422)
      expect((await verify(p, good, ip, { full_name: 'Awa' })).res.status).toBe(200)
    })

    it('[OBLIGATOIRE] code rejoué (CA-14) : même couple numéro + code → 422 AUTH_OTP_INVALID, une seule session', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const code = await lastCode(p.e164)
      expect((await verify(p, code, ip, { full_name: 'Awa' })).res.status).toBe(200)
      const replay = await verify(p, code, ip, { full_name: 'Awa' })
      expect(replay.res.status).toBe(422)
      expect(replay.json.error.code).toBe('AUTH_OTP_INVALID')
      const u = (await userByPhone(p.e164))[0] as Json
      expect(await sessionsOf(u.id)).toHaveLength(1)
    })

    it('[OBLIGATOIRE] deuxième compte gratuit sur le même numéro refusé (CA-15) : on se connecte au compte existant', async () => {
      const p = uniqueCmPhone()
      const a = await signup(p, 'Awa Nkeng')
      const ip = uniqueIp()
      await redis.del(`rl:auth:otp:req:phone:${hmac(p.e164)}`)
      await requestCode(p, ip)
      const second = await verify(p, await lastCode(p.e164), ip, { full_name: 'Autre' })
      expect(second.res.status).toBe(200)
      expect(second.json.is_new_user).toBe(false)
      expect(second.json.user.id).toBe(a.json.user.id)
      const users = await userByPhone(p.e164)
      expect(users).toHaveLength(1)
      expect(await orgsOf((users[0] as Json).id)).toHaveLength(1)
    })

    it('[OBLIGATOIRE] deux numéros différents dans la même minute (CA-16) : 4 réponses 200, 2 comptes, clés Redis distinctes', async () => {
      const ip = uniqueIp()
      const x = uniqueCmPhone()
      const y = uniqueCmPhone()
      const rx = await requestCode(x, ip)
      const ry = await requestCode(y, ip)
      const vx = await verify(x, await lastCode(x.e164), ip, { full_name: 'X' })
      const vy = await verify(y, await lastCode(y.e164), ip, { full_name: 'Y' })
      expect([rx, ry, vx, vy].map((r) => r.res.status)).toEqual([200, 200, 200, 200])
      const ux = (await userByPhone(x.e164))[0] as Json
      const uy = (await userByPhone(y.e164))[0] as Json
      expect(ux.id).not.toBe(uy.id)
      expect((await orgsOf(ux.id))[0]?.id).not.toBe((await orgsOf(uy.id))[0]?.id)
      expect((await sessionsOf(ux.id))[0]?.id).not.toBe((await sessionsOf(uy.id))[0]?.id)
      expect(hmac(x.e164)).not.toBe(hmac(y.e164))
      expect(await redis.exists(`rl:auth:otp:req:phone:${hmac(x.e164)}`)).toBe(1)
      expect(await redis.exists(`rl:auth:otp:req:phone:${hmac(y.e164)}`)).toBe(1)
      expect(await redis.exists(`rl:auth:otp:req:ip:${ip}`)).toBe(1)
    })

    it('CA-17 (concurrence) : deux vérifications simultanées → exactement un 200 et un 422 AUTH_OTP_INVALID ; 1 compte, 1 organisation, 1 session', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const code = await lastCode(p.e164)
      const [a, b] = await Promise.all([
        verify(p, code, ip, { full_name: 'Awa' }),
        verify(p, code, ip, { full_name: 'Awa' }),
      ])
      expect([a.res.status, b.res.status].sort()).toEqual([200, 422])
      const loser = a.res.status === 422 ? a : b
      expect(loser.json.error.code).toBe('AUTH_OTP_INVALID')
      const users = await userByPhone(p.e164)
      expect(users).toHaveLength(1)
      expect(await orgsOf((users[0] as Json).id)).toHaveLength(1)
      expect(await sessionsOf((users[0] as Json).id)).toHaveLength(1)
    })

    it('CA-17 (variante) : deux codes faux simultanés → attempts +2 exactement (aucune mise à jour perdue)', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const bad = wrongCodeFor(await lastCode(p.e164))
      await Promise.all([verify(p, bad, ip), verify(p, bad, ip)])
      expect(((await tokens(p.e164))[0] as Json).attempts).toBe(2)
    })

    it('CA-18 : aucun code demandé → 422 AUTH_OTP_INVALID sans remaining_attempts', async () => {
      const { res, json } = await verify(uniqueCmPhone(), '123456', uniqueIp())
      expect(res.status).toBe(422)
      expect(json.error.code).toBe('AUTH_OTP_INVALID')
      expect(json.error.details).not.toHaveProperty('remaining_attempts')
    })

    it('CA-19 : utilisateur suspendu → 403 AUTH_ACCOUNT_SUSPENDED, aucune session de plus, jeton consommé', async () => {
      const p = uniqueCmPhone()
      await signup(p)
      const u = (await userByPhone(p.e164))[0] as Json
      await asAdmin((s) => s`UPDATE iam.users SET status = 'suspended' WHERE id = ${u.id}`)
      const ip = uniqueIp()
      await redis.del(`rl:auth:otp:req:phone:${hmac(p.e164)}`)
      await requestCode(p, ip)
      const { res, json } = await verify(p, await lastCode(p.e164), ip)
      expect(res.status).toBe(403)
      expect(json.error.code).toBe('AUTH_ACCOUNT_SUSPENDED')
      expect(res.headers.get('set-cookie')).toBeNull()
      expect(await sessionsOf(u.id)).toHaveLength(1)
      const rows = await tokens(p.e164)
      expect((rows[rows.length - 1] as Json).consumed_at).not.toBeNull()
    })

    it('CA-20 : numéro bloqué entre la demande et la vérification → 422 AUTH_OTP_INVALID, aucun compte', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const code = await lastCode(p.e164)
      await withBlock('phone', p.e164, false, async () => {
        const { res, json } = await verify(p, code, ip, { full_name: 'Awa' })
        expect(res.status).toBe(422)
        expect(json.error.code).toBe('AUTH_OTP_INVALID')
      })
      expect(await userByPhone(p.e164)).toHaveLength(0)
    })

    it('CA-21 : pays à inscription fermée → 403 AUTH_SIGNUP_CLOSED pour un inconnu ; un utilisateur existant se connecte', async () => {
      const existing = uniqueSnPhone()
      const fresh = uniqueSnPhone()
      const sn = (p: { national: string; e164: string }, code: string, ip: string) => {
        usedPhones.add(p.e164)
        return post(VER, { phone: p.national, country: 'SN', code, full_name: 'Moussa' }, ip)
      }
      const reqSn = (p: { national: string; e164: string }, ip: string) => {
        usedPhones.add(p.e164)
        return post(REQ, { phone: p.national, country: 'SN' }, ip)
      }
      const ip = uniqueIp()
      await reqSn(existing, ip)
      expect((await sn(existing, await lastCode(existing.e164), ip)).res.status).toBe(200)
      try {
        await asAdmin(
          (s) => s`UPDATE ref.countries SET is_signup_allowed = false WHERE code = 'SN'`,
        )
        await reqSn(fresh, ip)
        const closed = await sn(fresh, await lastCode(fresh.e164), ip)
        expect(closed.res.status).toBe(403)
        expect(closed.json.error.code).toBe('AUTH_SIGNUP_CLOSED')
        expect(await userByPhone(fresh.e164)).toHaveLength(0)
        await redis.del(`rl:auth:otp:req:phone:${hmac(existing.e164)}`)
        await reqSn(existing, ip)
        expect((await sn(existing, await lastCode(existing.e164), ip)).res.status).toBe(200)
      } finally {
        await asAdmin((s) => s`UPDATE ref.countries SET is_signup_allowed = true WHERE code = 'SN'`)
      }
    })

    it('CA-23 (atomicité) : échec de create_personal_organization → 500 details {}, aucun utilisateur orphelin, jeton non consommé', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const code = await lastCode(p.e164)
      ;(await config()).setPhoneConfig({ dataRegionCode: 'nowhere-0' })
      const { res, json } = await verify(p, code, ip, { full_name: 'Awa' })
      expect(res.status).toBe(500)
      expect(json.error.code).toBe('PLATFORM_INTERNAL_ERROR')
      expect(json.error.details).toEqual({})
      expect(await userByPhone(p.e164)).toHaveLength(0)
      const t = (await tokens(p.e164))[0] as Json
      expect(t.consumed_at).toBeNull()
      expect(t.attempts).toBe(0)
    })

    it('CA-22 : /me après vérification → phone, phone_verified, email null, free_tier_eligible true', async () => {
      const p = uniqueCmPhone()
      const { res } = await signup(p)
      const me = await app.request(
        '/v1/auth/me',
        { headers: { cookie: cookieOf(res) } },
        socketEnv(uniqueIp()),
      )
      expect(me.status).toBe(200)
      const body: Json = await me.json()
      expect(body.phone).toBe(p.e164)
      expect(body.phone_verified).toBe(true)
      expect(body.email).toBeNull()
      expect(body.free_tier_eligible).toBe(true)
    })
  })

  // ── Paramètre free_tier.require_phone_otp ──────────────────────────────────────────────────

  describe('compte gratuit et paramètre free_tier.require_phone_otp', () => {
    async function emailUserCookie(): Promise<string> {
      const email = `p22-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.com`
      usedEmails.add(email)
      const password = 'StrongP@ss42!'
      const ip = uniqueIp()
      expect((await post('/v1/auth/register', { email, password }, ip)).res.status).toBe(200)
      const login = await post('/v1/auth/login', { email, password }, ip)
      expect(login.res.status).toBe(200)
      return cookieOf(login.res)
    }
    const me = async (cookie: string): Promise<Json> =>
      (await app.request('/v1/auth/me', { headers: { cookie } }, socketEnv(uniqueIp()))).json()

    it('CA-24 (paramètre activé) : e-mail sans téléphone → false ; numéro vérifié → true', async () => {
      const m = await me(await emailUserCookie())
      expect(m.phone).toBeNull()
      expect(m.free_tier_eligible).toBe(false)
      const phoneUser = await signup(uniqueCmPhone())
      expect((await me(cookieOf(phoneUser.res))).free_tier_eligible).toBe(true)
    })

    it('CA-25 (paramètre désactivé) : e-mail sans téléphone → true ; « un numéro = un utilisateur » reste actif', async () => {
      try {
        await asAdmin(
          (s) =>
            s`UPDATE platform.settings SET value = 'false'::jsonb WHERE key = 'free_tier.require_phone_otp'`,
        )
        expect((await me(await emailUserCookie())).free_tier_eligible).toBe(true)
        const p = uniqueCmPhone()
        const a = await signup(p)
        const ip = uniqueIp()
        await redis.del(`rl:auth:otp:req:phone:${hmac(p.e164)}`)
        await requestCode(p, ip)
        const second = await verify(p, await lastCode(p.e164), ip, { full_name: 'Autre' })
        expect(second.json.is_new_user).toBe(false)
        expect(second.json.user.id).toBe(a.json.user.id)
        expect(await userByPhone(p.e164)).toHaveLength(1)
      } finally {
        await asAdmin(
          (s) =>
            s`UPDATE platform.settings SET value = 'true'::jsonb WHERE key = 'free_tier.require_phone_otp'`,
        )
      }
    })
  })

  // ── Limites de débit : Redis réel ──────────────────────────────────────────────────────────

  describe('limites de débit (Redis réel)', () => {
    it('CA-27 : 2ᵉ demande avant 60 s → 429 + Retry-After 1..60 ; clé Redis HMAC présente, sans les chiffres du numéro ; réponse identique pour un compte existant', async () => {
      const known = uniqueCmPhone()
      await signup(known)
      const unknown = uniqueCmPhone()
      await requestCode(unknown, uniqueIp())
      const r1 = await requestCode(unknown, uniqueIp())
      const r2 = await requestCode(known, uniqueIp())
      for (const r of [r1, r2]) {
        expect(r.res.status).toBe(429)
        expect(r.json.error.code).toBe('PLATFORM_RATE_LIMIT')
        const ra = Number(r.res.headers.get('retry-after'))
        expect(ra).toBeGreaterThanOrEqual(1)
        expect(ra).toBeLessThanOrEqual(60)
      }
      expect(r1.json.error.details).toEqual(r2.json.error.details)
      const key = `rl:auth:otp:req:phone:${hmac(unknown.e164)}`
      expect(await redis.exists(key)).toBe(1)
      expect(key).not.toContain(unknown.national)
      expect(await redis.ttl(key)).toBeGreaterThan(0)
      expect(await redis.ttl(key)).toBeLessThanOrEqual(60)
    })

    it('CA-27 : la toute première demande après démarrage est déjà comptée dans Redis (pas seulement dans le limiteur mémoire)', async () => {
      resetLimiters()
      const p = uniqueCmPhone()
      const r = await requestCode(p, uniqueIp())
      expect(r.res.status).toBe(200)
      expect(await redis.exists(`rl:auth:otp:req:phone:${hmac(p.e164)}`)).toBe(1)
    })

    it('CA-28 : limites injectées (2 / h, renvoi à 0) → la 3ᵉ demande dans l’heure est refusée avec Retry-After', async () => {
      const cfg = await config()
      cfg.setPhoneConfig({ resendDelaySeconds: 0, requestPerPhonePerHour: 2 })
      resetLimiters()
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      expect((await requestCode(p, ip)).res.status).toBe(200)
      expect((await requestCode(p, ip)).res.status).toBe(200)
      const third = await requestCode(p, ip)
      expect(third.res.status).toBe(429)
      expect(Number(third.res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
      expect(await redis.exists(`rl:auth:otp:req:phone:h:${hmac(p.e164)}`)).toBe(1)
    })

    it('CA-29 : limite IP injectée (N=3) → la 4ᵉ demande (numéros différents) est refusée, une autre IP passe, X-Forwarded-For forgé inutile', async () => {
      const cfg = await config()
      cfg.setPhoneConfig({ requestPerIp: 3 })
      resetLimiters()
      const ipA = uniqueIp()
      for (let i = 0; i < 3; i++)
        expect((await requestCode(uniqueCmPhone(), ipA)).res.status).toBe(200)
      const fourth = await requestCode(uniqueCmPhone(), ipA)
      expect(fourth.res.status).toBe(429)
      expect(Number(fourth.res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
      expect(await redis.exists(`rl:auth:otp:req:ip:${ipA}`)).toBe(1)
      expect((await requestCode(uniqueCmPhone(), uniqueIp())).res.status).toBe(200)
      const p = uniqueCmPhone()
      usedPhones.add(p.e164)
      const forged = await post(REQ, { phone: p.national, country: 'CM' }, ipA, {
        'x-forwarded-for': uniqueIp(),
      })
      expect(forged.res.status).toBe(429)
    })

    it('CA-30 : vérification — limite par numéro par défaut (10 / 15 min) : la 11ᵉ tentative est refusée en 429 ; clé distincte de la demande', async () => {
      const p = uniqueCmPhone()
      const ip = uniqueIp()
      await requestCode(p, ip)
      const bad = wrongCodeFor(await lastCode(p.e164))
      for (let i = 0; i < 10; i++) expect((await verify(p, bad, ip)).res.status).toBe(422)
      const eleventh = await verify(p, bad, ip)
      expect(eleventh.res.status).toBe(429)
      expect(Number(eleventh.res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
      const vkey = `rl:auth:otp:verify:phone:${hmac(p.e164)}`
      expect(await redis.exists(vkey)).toBe(1)
      expect(vkey).not.toBe(`rl:auth:otp:req:phone:${hmac(p.e164)}`)
    })

    it('CA-30 : vérification — limite IP injectée (2) → la 3ᵉ vérification depuis la même IP est refusée ; clé Redis par IP présente', async () => {
      const cfg = await config()
      cfg.setPhoneConfig({ verifyPerIp: 2 })
      resetLimiters()
      const ip = uniqueIp()
      for (let i = 0; i < 2; i++)
        expect((await verify(uniqueCmPhone(), '123456', ip)).res.status).toBe(422)
      const third = await verify(uniqueCmPhone(), '123456', ip)
      expect(third.res.status).toBe(429)
      expect(await redis.exists(`rl:auth:otp:verify:ip:${ip}`)).toBe(1)
    })
  })

  // ── Fournisseur SMS : production sans fournisseur, envoi en échec (CA-35) ─────────────────

  describe('fournisseur SMS indisponible (CA-35)', () => {
    it('production + SMS_PROVIDER=none → 503 AUTH_SMS_UNAVAILABLE details {}, aucun jeton actif, réponse identique pour un compte existant', async () => {
      const known = uniqueCmPhone()
      await signup(known)
      const unknown = uniqueCmPhone()
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SMS_PROVIDER', 'none')
      resetEnvCache()
      ;(await factory()).resetSmsProvider()
      const a = await requestCode(unknown, uniqueIp())
      const b = await requestCode(known, uniqueIp())
      for (const r of [a, b]) {
        expect(r.res.status).toBe(503)
        expect(r.json.error.code).toBe('AUTH_SMS_UNAVAILABLE')
        expect(r.json.error.details).toEqual({})
        expect(r.text).not.toMatch(/simulated|none|provider/i)
      }
      expect((await tokens(unknown.e164)).filter((t) => (t as Json).active)).toHaveLength(0)
      expect((await tokens(known.e164)).filter((t) => (t as Json).active)).toHaveLength(0)
    })

    it('envoi en échec → 503 et jeton expiré par compensation (aucun code actif ne reste)', async () => {
      ;(await factory()).setSmsProvider({
        name: 'failing',
        isAvailable: () => true,
        send: async () => {
          throw new Error('provider down')
        },
      })
      const p = uniqueCmPhone()
      const { res, json } = await requestCode(p, uniqueIp())
      expect(res.status).toBe(503)
      expect(json.error.code).toBe('AUTH_SMS_UNAVAILABLE')
      expect(json.error.details).toEqual({})
      expect((await tokens(p.e164)).filter((t) => (t as Json).active)).toHaveLength(0)
    })
  })

  // ── Rôles et isolation (CA-39, CA-40) ──────────────────────────────────────────────────────

  describe('rôles et isolation multi-organisations', () => {
    it('CA-39 : app_auth lit la blocklist et appelle la fonction de paramètre, mais ne peut pas écrire dans verification_tokens', async () => {
      const pool = getPoolAuth()
      await expect(pool`SELECT count(*) FROM platform.blocklist_entries`).resolves.toBeDefined()
      const r = await pool`SELECT platform.free_tier_requires_phone_otp() AS v`
      expect(typeof r[0]?.v).toBe('boolean')
      await expect(
        pool`INSERT INTO iam.verification_tokens (purpose, target, token_hash, expires_at)
             VALUES ('otp_login', '+237600000098', decode('00', 'hex'), now() + interval '5 minutes')`,
      ).rejects.toThrow(/permission denied/)
    })

    it('CA-40 : A et B inscrits par téléphone — le contexte app_rw de A ne voit que les lignes de A ; usurpation de create_personal_organization refusée (42501)', async () => {
      const pa = uniqueCmPhone()
      const pb = uniqueCmPhone()
      await signup(pa, 'Alice A')
      await signup(pb, 'Bruno B')
      const ua = (await userByPhone(pa.e164))[0] as Json
      const ub = (await userByPhone(pb.e164))[0] as Json
      const oa = (await orgsOf(ua.id))[0] as Json
      const ob = (await orgsOf(ub.id))[0] as Json

      await withOrgContext({ orgId: BigInt(oa.id), userId: BigInt(ua.id) }, async (tx) => {
        const orgs = Array.from(
          (await tx.execute(sql`SELECT id FROM iam.organizations`)) as Iterable<unknown>,
        )
        const ws = Array.from(
          (await tx.execute(sql`SELECT organization_id FROM iam.workspaces`)) as Iterable<unknown>,
        )
        const envs = Array.from(
          (await tx.execute(
            sql`SELECT organization_id FROM iam.environments`,
          )) as Iterable<unknown>,
        )
        expect(orgs.map((r) => String((r as Json).id))).toEqual([String(oa.id)])
        expect(ws.length).toBeGreaterThan(0)
        for (const r of [...ws, ...envs])
          expect(String((r as Json).organization_id)).toBe(String(oa.id))
        expect(orgs.map((r) => String((r as Json).id))).not.toContain(String(ob.id))
      })

      const err = await getPoolRw()
        .begin(async (tx) => {
          await tx`SELECT set_config('app.user_id', ${String(ua.id)}, true)`
          await tx`SELECT * FROM iam.create_personal_organization(${String(ub.id)}::bigint, ${String(ub.public_id)}, 'Usurpation', 'CM'::char(2), 'XAF'::char(3), 'fr', 'eu-fr')`
        })
        .then(
          () => null,
          (e: unknown) => e as { code?: string },
        )
      expect(err?.code).toBe('42501')
    })
  })
})
