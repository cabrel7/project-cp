/**
 * P2.2 — COMPLÉMENTS du tester : cas oubliés par les 40 CA initiaux. INTÉGRATION, PostgreSQL réel + Redis réel.
 * Aucun mock du repository, du SQL ni de Redis. Frontières simulées : e-mail (SMTP, comme P2.1) et fournisseur
 * SMS (boîte mémoire). Avec CP_REQUIRE_INTEGRATION, une base ou un Redis absent = ÉCHEC, jamais un saut.
 *
 * Règles testées (spec P2.2 + cp-auth §3/§7 + cp-security) :
 *   - un numéro = un utilisateur ; un compte non actif n'obtient pas de session (états de compte) ;
 *   - paramètre `free_tier.require_phone_otp` : valeur invalide ⇒ défaut sûr, jamais de 500 (D59) ;
 *   - blocklist : plage mal formée sans effet, IPv6, IP inconnue (socket absente) ;
 *   - isolation multi-organisations (API + RLS) après inscription par téléphone ;
 *   - session : jeton haché, cookie HttpOnly/SameSite/Secure, durée courte sans « rester connecté » ;
 *   - concurrence de deux demandes de code ; langue du SMS ; bornes et Unicode des entrées ;
 *   - aucune donnée personnelle dans les réponses d'erreur ;
 *   - régression P2.1 : limite par e-mail avec `Retry-After`, parcours e-mail sous les deux valeurs du paramètre.
 *
 * Les tests marqués « [DÉFAUT OUVERT] » décrivent le comportement ATTENDU et sont ROUGES tant que le code de
 * production n'est pas corrigé (ne pas les affaiblir). Les tests « [CARACTÉRISATION] » épinglent un comportement
 * ACTUEL jugé défectueux : ils échoueront volontairement le jour de la correction et devront être inversés.
 */
import { createHash, createHmac } from 'node:crypto'
import { getPoolAuth, getPoolRw, withOrgContext } from '@cp/db'
import { sql } from 'drizzle-orm'
import Redis from 'ioredis'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../app.js'
import { getEnv, resetEnvCache } from '../../../env.js'
import { resetLimiters } from '../../../middlewares/rate-limit.js'
import { resetPhoneConfig, setPhoneConfig } from '../auth.phone.config.js'
import * as phoneRepo from '../auth.phone.repository.js'
import { resetSmsProvider } from '../sms/sms.factory.js'
import { getSimulatedOutbox } from '../sms/sms.simulated.js'
import {
  extractCode,
  socketEnv,
  uniqueCmPhone,
  uniqueIp,
  withGlobalLock,
  wrongCodeFor,
} from './phone-test-utils.js'

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
type Json = any
type Phone = { national: string; e164: string }

const REQ = '/v1/auth/phone/request-code'
const VER = '/v1/auth/phone/verify-code'
const PEPPER = 'k'.repeat(40)
const SETTING = 'free_tier.require_phone_otp'

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

describe.skipIf(!(hasDb && hasRedis))(
  'Auth téléphone — compléments du tester (PostgreSQL réel + Redis réel)',
  () => {
    let app: ReturnType<typeof createApp>['app']
    let adminPool: Awaited<ReturnType<typeof import('@cp/db/admin')['getPoolAdmin']>>
    let redis: Redis
    const usedPhones = new Set<string>()
    const usedEmails = new Set<string>()
    const blockEntries: string[] = []

    async function asAdmin<T>(fn: (s: typeof adminPool) => Promise<T>): Promise<T> {
      return adminPool.begin(async (tx) => {
        await tx`SET LOCAL ROLE app_admin`
        return fn(tx as unknown as typeof adminPool)
      }) as Promise<T>
    }

    const hmac = (e164: string) => createHmac('sha256', PEPPER).update(e164).digest('hex')
    const resendKey = (e164: string) => `rl:auth:otp:req:phone:${hmac(e164)}`

    async function call(
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      opts: {
        body?: unknown
        rawBody?: string
        ip?: string | null
        cookie?: string
        bearer?: string
        headers?: Record<string, string>
      } = {},
    ) {
      // Navigateur même origine : `Origin` accompagne tout POST/DELETE. Sans lui, `csrf()` de Hono traite un POST sans
      // Content-Type (logout…) comme un envoi de formulaire et le bloque (voir le rapport : mapping 403 → 422).
      const headers: Record<string, string> = {
        'user-agent': 'vitest',
        ...(method === 'GET' ? {} : { origin: 'http://localhost' }),
        ...(opts.headers ?? {}),
      }
      if (opts.body !== undefined || opts.rawBody !== undefined)
        headers['content-type'] = 'application/json'
      if (opts.cookie) headers.cookie = opts.cookie
      if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`
      const init: RequestInit = { method, headers }
      if (opts.rawBody !== undefined) init.body = opts.rawBody
      else if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
      const ip = opts.ip === undefined ? uniqueIp() : opts.ip
      const t0 = performance.now()
      const res = await (ip === null
        ? app.request(path, init)
        : app.request(path, init, socketEnv(ip)))
      const elapsed = performance.now() - t0
      const text = await res.text()
      let json: Json = null
      try {
        json = JSON.parse(text)
      } catch {}
      return { res, json: json as Json, text, elapsed }
    }
    const post = (
      path: string,
      body: unknown,
      ip?: string | null,
      headers?: Record<string, string>,
    ) =>
      call('POST', path, {
        body,
        ...(ip === undefined ? {} : { ip }),
        ...(headers ? { headers } : {}),
      })

    const requestCode = (p: Phone, ip?: string | null, extra: object = {}) => {
      usedPhones.add(p.e164)
      return post(REQ, { phone: p.national, country: 'CM', ...extra }, ip)
    }
    const verify = (p: Phone, code: string, ip?: string | null, extra: object = {}) => {
      usedPhones.add(p.e164)
      return post(VER, { phone: p.national, country: 'CM', code, ...extra }, ip)
    }
    async function lastCode(e164: string): Promise<string> {
      const mine = getSimulatedOutbox().filter((m) => m.to === e164)
      const last = mine[mine.length - 1]
      if (!last) throw new Error(`aucun SMS simulé pour ${e164}`)
      return extractCode(last.text)
    }
    /** Inscription complète ; `name = null` n'envoie pas de `full_name`. */
    async function signup(
      p: Phone,
      name: string | null = 'Awa Nkeng',
      ip: string | null = uniqueIp(),
      extra = {},
    ) {
      const r1 = await requestCode(p, ip)
      expect(r1.res.status).toBe(200)
      return verify(p, await lastCode(p.e164), ip, {
        ...(name === null ? {} : { full_name: name }),
        ...extra,
      })
    }
    /** Nouvelle connexion par code d'un compte existant (lève le délai de renvoi de 60 s). */
    async function loginByCode(p: Phone, ip: string | null = uniqueIp(), extra = {}) {
      await redis.del(resendKey(p.e164))
      const r1 = await requestCode(p, ip)
      expect(r1.res.status).toBe(200)
      return verify(p, await lastCode(p.e164), ip, extra)
    }
    const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const tokenOf = (res: Response) => cookieOf(res).split('=')[1] ?? ''
    const me = (cookie: string) => call('GET', '/v1/auth/me', { cookie })

    const tokens = (e164: string) =>
      asAdmin(
        (s) => s`SELECT id, target, attempts, consumed_at, host(ip) AS ip, expires_at,
          (consumed_at IS NULL AND expires_at > now()) AS active
          FROM iam.verification_tokens WHERE target = ${e164} AND purpose = 'otp_login' ORDER BY id`,
      )
    const userByPhone = (e164: string) =>
      asAdmin((s) => s`SELECT * FROM iam.users WHERE phone_e164 = ${e164}`)
    const sessionsOf = (userId: string) =>
      asAdmin(
        (s) => s`SELECT id, public_id, token_hash, host(ip) AS ip, revoked_at,
          EXTRACT(EPOCH FROM (expires_at - created_at)) AS ttl
          FROM iam.user_sessions WHERE user_id = ${userId} ORDER BY id`,
      )
    const orgsOf = (userId: string) =>
      asAdmin((s) => s`SELECT * FROM iam.organizations WHERE created_by_user_id = ${userId}`)

    async function withBlocks(entries: [kind: string, value: string][], fn: () => Promise<void>) {
      for (const [kind, value] of entries) {
        await asAdmin(
          (s) =>
            s`INSERT INTO platform.blocklist_entries (kind, value, reason)
              VALUES (${kind}, ${value}, 'test P2.2 compléments')
              ON CONFLICT (kind, value) DO UPDATE SET expires_at = NULL`,
        )
        blockEntries.push(`${kind}|${value}`)
      }
      try {
        await fn()
      } finally {
        for (const [kind, value] of entries) {
          await asAdmin(
            (s) =>
              s`DELETE FROM platform.blocklist_entries WHERE kind = ${kind} AND value = ${value}`,
          )
        }
      }
    }

    const setFlag = (jsonLiteral: string) =>
      asAdmin(
        (s) => s`UPDATE platform.settings SET value = ${jsonLiteral}::jsonb WHERE key = ${SETTING}`,
      )
    /** Exclusion inter-fichiers + remise à la valeur du seed (`true`) quoi qu'il arrive. */
    const withFlag = <T>(fn: () => Promise<T>) =>
      withGlobalLock(redis, 'free-tier-setting', async () => {
        try {
          return await fn()
        } finally {
          await setFlag('true')
        }
      })

    async function emailUser(): Promise<{ email: string; password: string; cookie: string }> {
      const email = `p22c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.com`
      usedEmails.add(email)
      const password = 'StrongP@ss42!'
      const ip = uniqueIp()
      expect((await post('/v1/auth/register', { email, password }, ip)).res.status).toBe(200)
      const login = await post('/v1/auth/login', { email, password }, ip)
      expect(login.res.status).toBe(200)
      return { email, password, cookie: cookieOf(login.res) }
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

    afterEach(() => {
      resetPhoneConfig()
      resetSmsProvider()
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
      }).catch(() => {})
      await withGlobalLock(redis, 'free-tier-setting', () => setFlag('true')).catch(() => {})
      redis.disconnect()
      vi.unstubAllEnvs()
      resetEnvCache()
    })

    // ── 1. États de compte ───────────────────────────────────────────────────────────────────

    describe('états de compte', () => {
      it('[CARACTÉRISATION] statut « deleted » avec deleted_at NULL : la connexion par code renvoie 200 et crée une session, qui est ensuite refusée partout (401)', async () => {
        // DÉFAUT CONNU (signalé au backend) : `signInOrSignUp` ne refuse que `suspended` ; une session est émise pour un
        // compte `deleted`, que `requireAuth` rejette aussitôt. Attendu à la correction : refus explicite sans session
        // (comme CA-19). Ce test devra alors être inversé.
        const p = uniqueCmPhone()
        await signup(p)
        const u = (await userByPhone(p.e164))[0] as Json
        await asAdmin((s) => s`UPDATE iam.users SET status = 'deleted' WHERE id = ${u.id}`)
        const before = (await sessionsOf(u.id)).length

        const { res, json } = await loginByCode(p)
        expect(res.status).toBe(200)
        expect(json.is_new_user).toBe(false)
        expect(res.headers.get('set-cookie')).toContain('HttpOnly')
        expect((await sessionsOf(u.id)).length).toBe(before + 1)

        const probe = await me(cookieOf(res))
        expect(probe.res.status).toBe(401)
        expect(probe.json.error.code).toBe('AUTH_TOKEN_INVALID')
      })

      it('[CARACTÉRISATION] compte supprimé (deleted_at renseigné) dont le numéro est conservé : la connexion par code échoue en 500 et le jeton n’est pas consommé (le numéro est bloqué à vie, risque R5)', async () => {
        // Le lookup ignore les comptes `deleted_at IS NOT NULL` ⇒ chemin d'inscription ⇒ INSERT ⇒ 23505 sur
        // users_phone_e164_key ⇒ la tentative unique de rejeu échoue pareil ⇒ 500. L'anonymisation (02 §12) doit
        // remettre phone_e164 à NULL ; en attendant, la personne reçoit un 500 opaque au lieu d'un refus explicite.
        const p = uniqueCmPhone()
        await signup(p)
        const u = (await userByPhone(p.e164))[0] as Json
        await asAdmin(
          (s) => s`UPDATE iam.users SET status = 'deleted', deleted_at = now() WHERE id = ${u.id}`,
        )
        await redis.del(resendKey(p.e164))
        const ip = uniqueIp()
        await requestCode(p, ip)
        const { res, json, text } = await verify(p, await lastCode(p.e164), ip, { full_name: 'X' })
        expect(res.status).toBe(500)
        expect(json.error.code).toBe('PLATFORM_INTERNAL_ERROR')
        expect(json.error.details).toEqual({})
        expect(text).not.toContain(p.e164)
        const rows = await tokens(p.e164)
        expect((rows[rows.length - 1] as Json).consumed_at).toBeNull()
        expect(await userByPhone(p.e164)).toHaveLength(1)
      })
    })

    // ── 2. Paramètre free_tier.require_phone_otp ───────────────────────────────────────────

    describe('paramètre free_tier.require_phone_otp', () => {
      const INVALID = ['"maybe"', '""', '42', '0', '1', '{"a":1}', '[]', 'null', '"yes"', '"t"']

      it('valeur invalide (10 formes) : /me, la connexion e-mail et la connexion par code restent 200 ; défaut sûr = exigence activée', async () => {
        const e = await emailUser()
        const p = uniqueCmPhone()
        await signup(p)
        await withFlag(async () => {
          for (const bad of INVALID) {
            await setFlag(bad)
            const m = await me(e.cookie)
            expect(m.res.status, `/me avec ${bad}`).toBe(200)
            expect(m.json.free_tier_eligible, `e-mail sans numéro avec ${bad}`).toBe(false)
            // La limite par e-mail (5 / 5 min) borne le nombre de connexions : première et dernière valeur seulement.
            if (bad === INVALID[0] || bad === INVALID[INVALID.length - 1]) {
              const login = await post('/v1/auth/login', { email: e.email, password: e.password })
              expect(login.res.status, `login e-mail avec ${bad}`).toBe(200)
              expect(login.json.user.free_tier_eligible).toBe(false)
            }
          }
          // Connexion par code : la valeur du paramètre ne doit jamais empêcher un numéro vérifié de se connecter.
          await setFlag('"maybe"')
          const again = await loginByCode(p)
          expect(again.res.status).toBe(200)
          expect(again.json.user.free_tier_eligible).toBe(true)
          expect((await me(cookieOf(again.res))).json.free_tier_eligible).toBe(true)
        })
      })

      it('formes booléennes tolérées (chaîne « false » / « FALSE » / « False ») ⇒ éligible ; « TRUE » ⇒ non éligible', async () => {
        const e = await emailUser()
        await withFlag(async () => {
          for (const [literal, eligible] of [
            ['"false"', true],
            ['"FALSE"', true],
            ['"False"', true],
            ['false', true],
            ['"TRUE"', false],
            ['true', false],
          ] as const) {
            await setFlag(literal)
            expect((await me(e.cookie)).json.free_tier_eligible, literal).toBe(eligible)
          }
        })
      })

      it('paramètre activé puis désactivé : la connexion e-mail P2.1 (200, session) et l’inscription e-mail ne changent pas ; seul free_tier_eligible bascule', async () => {
        const e = await emailUser()
        await withFlag(async () => {
          for (const [literal, eligible] of [
            ['true', false],
            ['false', true],
          ] as const) {
            await setFlag(literal)
            const login = await post('/v1/auth/login', {
              email: e.email,
              password: e.password,
              remember_me: true,
            })
            expect(login.res.status).toBe(200)
            expect(login.json.user.email).toBe(e.email)
            expect(login.json.user.free_tier_eligible).toBe(eligible)
            expect(login.res.headers.get('set-cookie')).toContain('HttpOnly')
            // D-a : le paramètre ne bloque jamais l'inscription par e-mail.
            const email = `p22c-reg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
            usedEmails.add(email)
            expect(
              (await post('/v1/auth/register', { email, password: 'StrongP@ss42!' })).res.status,
            ).toBe(200)
          }
        })
      })

      it('la fonction SECURITY DEFINER renvoie toujours un booléen non nul, quelle que soit la valeur stockée', async () => {
        await withFlag(async () => {
          for (const v of ['true', 'false', '"zzz"', 'null']) {
            await setFlag(v)
            const rows = await getPoolRw()`SELECT platform.free_tier_requires_phone_otp() AS v`
            expect(typeof rows[0]?.v).toBe('boolean')
          }
        })
      })
    })

    // ── 3. IP inconnue (aucune socket) ─────────────────────────────────────────────────────

    describe('IP client inconnue (null)', () => {
      it('demande puis vérification sans socket : 200, jeton et session sans IP (NULL), compte créé, /me fonctionne', async () => {
        const p = uniqueCmPhone()
        const r1 = await requestCode(p, null)
        expect(r1.res.status).toBe(200)
        expect(((await tokens(p.e164))[0] as Json).ip).toBeNull()
        const r2 = await verify(p, await lastCode(p.e164), null, { full_name: 'Sans IP' })
        expect(r2.res.status).toBe(200)
        expect(r2.json.is_new_user).toBe(true)
        expect(r2.json.session.ip).toBeNull()
        const u = (await userByPhone(p.e164))[0] as Json
        expect(((await sessionsOf(u.id))[0] as Json).ip).toBeNull()
        expect((await me(cookieOf(r2.res))).res.status).toBe(200)
      })

      it('IP inconnue ne partage JAMAIS un compteur « 127.0.0.1 » : la limite IP est ignorée mais la limite par numéro s’applique toujours', async () => {
        setPhoneConfig({ requestPerIp: 1 })
        const p = uniqueCmPhone()
        expect((await requestCode(uniqueCmPhone(), null)).res.status).toBe(200)
        expect((await requestCode(uniqueCmPhone(), null)).res.status).toBe(200)
        expect((await requestCode(p, null)).res.status).toBe(200)
        const again = await requestCode(p, null)
        expect(again.res.status).toBe(429)
        expect(Number(again.res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
      })

      it("[DÉFAUT OUVERT] une entrée « ip » de valeur vide ne bloque pas les requêtes sans IP (la sentinelle '' ne doit pas être une adresse)", async () => {
        const p = uniqueCmPhone()
        await withBlocks([['ip', '']], async () => {
          const r = await requestCode(p, null)
          expect(r.res.status).toBe(200)
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(1)
        })
      })
    })

    // ── 4. Blocklist : plages mal formées et IPv6 ──────────────────────────────────────────

    describe('blocklist : CIDR mal formé et IPv6', () => {
      it('plage IPv6 valide : une adresse dedans est bloquée (aucun SMS), hors plage ou IPv4 non', async () => {
        const net = (Math.random() * 0xffff) | 0
        const inside = `2001:db8:${net.toString(16)}::5`
        const outside = `2001:db8:${(net ^ 1).toString(16)}::5`
        const p = uniqueCmPhone()
        await withBlocks([['cidr', `2001:db8:${net.toString(16)}::/48`]], async () => {
          await expect(phoneRepo.isBlocked({ phone: p.e164, ip: inside })).resolves.toBe(true)
          await expect(phoneRepo.isBlocked({ phone: p.e164, ip: outside })).resolves.toBe(false)
          await expect(phoneRepo.isBlocked({ phone: p.e164, ip: uniqueIp() })).resolves.toBe(false)
          const blocked = await requestCode(p, inside)
          expect(blocked.res.status).toBe(200)
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(0)
          const q = uniqueCmPhone()
          await requestCode(q, outside)
          expect(getSimulatedOutbox().filter((m) => m.to === q.e164)).toHaveLength(1)
        })
      })

      it('IP IPv6 exacte (kind « ip ») bloquée ; la même famille non listée ne l’est pas ; plage IPv4 ne bloque pas une IPv6', async () => {
        const tag = ((Math.random() * 0xffff) | 0).toString(16)
        const listed = `2001:db8:ee:${tag}::1`
        const other = `2001:db8:ee:${tag}::2`
        await withBlocks([['ip', listed]], async () => {
          await expect(phoneRepo.isBlocked({ phone: '+237600000000', ip: listed })).resolves.toBe(
            true,
          )
          await expect(phoneRepo.isBlocked({ phone: '+237600000000', ip: other })).resolves.toBe(
            false,
          )
        })
        const o2 = (Math.random() * 250) | 0
        const o3 = (Math.random() * 250) | 0
        await withBlocks([['cidr', `10.${o2}.${o3}.0/24`]], async () => {
          await expect(
            phoneRepo.isBlocked({ phone: '+237600000000', ip: `10.${o2}.${o3}.9` }),
          ).resolves.toBe(true)
          await expect(phoneRepo.isBlocked({ phone: '+237600000000', ip: listed })).resolves.toBe(
            false,
          )
        })
      })

      it('préfixe limite /31 : couvre exactement 2 adresses', async () => {
        const a = `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.10`
        const parts = a.split('.')
        const neighbour = `${parts[0]}.${parts[1]}.${parts[2]}.11`
        await withBlocks([['cidr', `${a}/31`]], async () => {
          await expect(phoneRepo.isBlocked({ phone: '+237600000000', ip: a })).resolves.toBe(true)
          await expect(
            phoneRepo.isBlocked({ phone: '+237600000000', ip: neighbour }),
          ).resolves.toBe(true)
          await expect(
            phoneRepo.isBlocked({
              phone: '+237600000000',
              ip: `${parts[0]}.${parts[1]}.${parts[2]}.12`,
            }),
          ).resolves.toBe(false)
        })
      })
    })

    // ── 5. Isolation multi-organisations après inscription par téléphone ───────────────────

    describe('isolation entre deux organisations inscrites par téléphone', () => {
      it('API : A et B ne voient que leurs données (/me, /sessions) ; B ne peut ni révoquer ni lister la session de A (404, jamais 403)', async () => {
        const pa = uniqueCmPhone()
        const pb = uniqueCmPhone()
        const a = await signup(pa, 'Alice Isolée')
        const b = await signup(pb, 'Bruno Isolé')
        const ca = cookieOf(a.res)
        const cb = cookieOf(b.res)

        const meA = await me(ca)
        const meB = await me(cb)
        expect(meA.json.id).toBe(a.json.user.id)
        expect(meB.json.id).toBe(b.json.user.id)
        expect(meA.json.id).not.toBe(meB.json.id)
        expect(meA.text).not.toContain(pb.e164)
        expect(meA.text).not.toContain('Bruno')
        expect(meB.text).not.toContain(pa.e164)
        expect(meB.text).not.toContain('Alice')

        const listA = await call('GET', '/v1/auth/sessions', { cookie: ca })
        expect(listA.res.status).toBe(200)
        expect(listA.json.data).toHaveLength(1)
        expect(listA.json.data[0].id).toBe(a.json.session.id)
        expect(listA.text).not.toContain(b.json.session.id)
        expect(listA.text).not.toContain(pb.e164)

        const steal = await call('DELETE', `/v1/auth/sessions/${a.json.session.id}`, { cookie: cb })
        expect(steal.res.status).toBe(404)
        expect(steal.json.error.code).toBe('PLATFORM_RESOURCE_NOT_FOUND')
        expect((await me(ca)).res.status).toBe(200)

        // Identifiant inexistant et identifiant d'autrui : réponses indiscernables (pas d'oracle d'existence).
        const ghost = await call(
          'DELETE',
          '/v1/auth/sessions/0192f000-0000-7000-8000-000000000000',
          {
            cookie: cb,
          },
        )
        expect(ghost.res.status).toBe(steal.res.status)
        expect(ghost.json.error.code).toBe(steal.json.error.code)

        // « Déconnexion partout » de B ne touche pas A.
        const bAgain = await loginByCode(pb)
        expect(
          (await call('POST', '/v1/auth/logout-all', { cookie: cookieOf(bAgain.res) })).res.status,
        ).toBe(204)
        expect((await me(cb)).res.status).toBe(401)
        expect((await me(ca)).res.status).toBe(200)
      })

      it('RLS réelle sous le contexte de A : UPDATE / DELETE / INSERT sur les lignes de B n’ont aucun effet ou sont refusés ; sans contexte, aucune organisation n’est visible', async () => {
        const pa = uniqueCmPhone()
        const pb = uniqueCmPhone()
        await signup(pa, 'Alice RLS')
        await signup(pb, 'Bruno RLS')
        const ua = (await userByPhone(pa.e164))[0] as Json
        const ub = (await userByPhone(pb.e164))[0] as Json
        const oa = (await orgsOf(ua.id))[0] as Json
        const ob = (await orgsOf(ub.id))[0] as Json
        const rows = (r: unknown) => Array.from(r as Iterable<unknown>)

        await withOrgContext({ orgId: BigInt(oa.id), userId: BigInt(ua.id) }, async (tx) => {
          expect(
            rows(
              await tx.execute(
                sql`UPDATE iam.organizations SET name = 'pwned' WHERE id = ${ob.id}::bigint RETURNING id`,
              ),
            ),
          ).toHaveLength(0)
          expect(
            rows(
              await tx.execute(
                sql`UPDATE iam.workspaces SET name = 'pwned' WHERE organization_id = ${ob.id}::bigint RETURNING id`,
              ),
            ),
          ).toHaveLength(0)
          expect(
            rows(
              await tx.execute(
                sql`DELETE FROM iam.environments WHERE organization_id = ${ob.id}::bigint RETURNING id`,
              ),
            ),
          ).toHaveLength(0)
          expect(
            rows(
              await tx.execute(
                sql`UPDATE iam.memberships SET status = 'suspended' WHERE organization_id = ${ob.id}::bigint RETURNING id`,
              ),
            ),
          ).toHaveLength(0)
          expect(
            rows(
              await tx.execute(
                sql`SELECT id FROM iam.memberships WHERE organization_id = ${ob.id}::bigint`,
              ),
            ),
          ).toHaveLength(0)
          // Les lignes de A restent visibles et modifiables.
          expect(
            rows(
              await tx.execute(
                sql`UPDATE iam.workspaces SET description = 'mine' WHERE organization_id = ${oa.id}::bigint RETURNING id`,
              ),
            ).length,
          ).toBeGreaterThan(0)
        })

        // Écrire dans l'organisation de B depuis le contexte de A : refusé par la politique WITH CHECK.
        const insertError = await withOrgContext(
          { orgId: BigInt(oa.id), userId: BigInt(ua.id) },
          (tx) =>
            tx.execute(
              sql`INSERT INTO iam.workspaces (organization_id, name, slug) VALUES (${ob.id}::bigint, 'intrus', ${`intrus-${Date.now()}`})`,
            ),
        ).then(
          () => null,
          (e: unknown) => e as { code?: string; cause?: { code?: string; message?: string } },
        )
        // 42501 = new row violates row-level security policy (WITH CHECK de `tenant_isolation`).
        expect(insertError?.cause?.code ?? insertError?.code).toBe('42501')
        expect(insertError?.cause?.message ?? '').toMatch(/row-level security/i)

        // Les données de B n'ont pas bougé.
        const after = await asAdmin(
          (s) => s`SELECT name FROM iam.organizations WHERE id = ${ob.id}`,
        )
        expect((after[0] as Json).name).toBe('Bruno RLS')

        // Sans contexte d'organisation : fail-closed.
        const none = await getPoolRw()`SELECT count(*)::int AS n FROM iam.organizations`
        expect(none[0]?.n).toBe(0)
        const noneWs = await getPoolRw()`SELECT count(*)::int AS n FROM iam.workspaces`
        expect(noneWs[0]?.n).toBe(0)
      })

      it('chaque cookie ou Bearer n’ouvre que son propre compte ; un jeton altéré d’un seul caractère est refusé', async () => {
        const a = await signup(uniqueCmPhone(), 'Alice Bearer')
        const b = await signup(uniqueCmPhone(), 'Bruno Bearer')
        const viaBearerA = await call('GET', '/v1/auth/me', { bearer: tokenOf(a.res) })
        const viaBearerB = await call('GET', '/v1/auth/me', { bearer: tokenOf(b.res) })
        expect(viaBearerA.json.id).toBe(a.json.user.id)
        expect(viaBearerB.json.id).toBe(b.json.user.id)
        const ta = tokenOf(a.res)
        const flipped = `${ta.slice(0, -1)}${ta.endsWith('0') ? '1' : '0'}`
        expect((await call('GET', '/v1/auth/me', { bearer: flipped })).res.status).toBe(401)
      })
    })

    // ── 6. Session et cookie ───────────────────────────────────────────────────────────────

    describe('session et cookie', () => {
      it('le jeton de session (256 bits) n’est jamais stocké en clair : user_sessions.token_hash = sha256(cookie), absent du corps de réponse', async () => {
        const p = uniqueCmPhone()
        const { res, text } = await signup(p)
        const token = tokenOf(res)
        expect(token).toMatch(/^[0-9a-f]{64}$/)
        expect(text).not.toContain(token)
        const u = (await userByPhone(p.e164))[0] as Json
        const s = (await sessionsOf(u.id))[0] as Json
        const stored = Buffer.from(s.token_hash)
        expect(stored.equals(createHash('sha256').update(token).digest())).toBe(true)
        expect(stored.equals(Buffer.from(token, 'hex'))).toBe(false)
        expect(stored.toString('utf8')).not.toContain(token)
      })

      it('production simulée : le cookie de session porte HttpOnly; SameSite=Lax; Path=/; Secure et le Max-Age « se souvenir de moi »', async () => {
        const p = uniqueCmPhone()
        const ip = uniqueIp()
        await requestCode(p, ip)
        const code = await lastCode(p.e164)
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('APP_URL', 'https://app.example.test') // requis en production (CSRF) — ne pas dépendre de .env.example
        vi.stubEnv('SMS_PROVIDER', 'none')
        resetEnvCache()
        const { res, json } = await verify(p, code, ip, { full_name: 'Awa Prod' })
        expect(res.status).toBe(200)
        const cookie = res.headers.get('set-cookie') ?? ''
        const attrs = cookie.split(';').map((a) => a.trim())
        expect(attrs[0]).toMatch(/^cp_session=[0-9a-f]{64}$/)
        expect(attrs).toContain('HttpOnly')
        expect(attrs).toContain('SameSite=Lax')
        expect(attrs).toContain('Path=/')
        expect(attrs).toContain('Secure')
        expect(attrs).toContain(`Max-Age=${getEnv().SESSION_REMEMBER_MAX_AGE_SECONDS}`)
        expect(attrs.some((a) => /^Domain=/i.test(a))).toBe(false)
        expect(json.is_new_user).toBe(true)

        // La déconnexion efface le cookie avec les mêmes attributs de sécurité.
        const out = await call('POST', '/v1/auth/logout', { cookie: cookieOf(res) })
        expect(out.res.status).toBe(204)
        const cleared = out.res.headers.get('set-cookie') ?? ''
        expect(cleared).toContain('Max-Age=0')
        expect(cleared).toContain('HttpOnly')
        expect(cleared).toContain('SameSite=Lax')
        expect(cleared).toContain('Secure')
        expect((await me(cookieOf(res))).res.status).toBe(401)
      })

      it('hors production : pas de Secure (HTTP local) ; aucun cookie sur les réponses d’erreur (422, 429, 403)', async () => {
        const p = uniqueCmPhone()
        const ip = uniqueIp()
        const ok = await signup(p, 'Awa Dev', ip)
        expect(ok.res.headers.get('set-cookie')).not.toContain('Secure')
        const bad = await verify(p, '123456', ip)
        expect(bad.res.status).toBe(422)
        expect(bad.res.headers.get('set-cookie')).toBeNull()
        const invalidPhone = await post(REQ, { phone: '12', country: 'CM' })
        expect(invalidPhone.res.headers.get('set-cookie')).toBeNull()
        const limited = await requestCode(p, ip) // délai de renvoi
        expect(limited.res.status).toBe(429)
        expect(limited.res.headers.get('set-cookie')).toBeNull()
      })

      it('remember_me=false : la session dure SESSION_MAX_AGE (court) en base ET dans le cookie ; remember_me par défaut : SESSION_REMEMBER_MAX_AGE', async () => {
        const short = uniqueCmPhone()
        const long = uniqueCmPhone()
        const a = await signup(short, 'Court', uniqueIp(), { remember_me: false })
        const b = await signup(long, 'Long', uniqueIp())
        const e = getEnv()
        expect(a.res.headers.get('set-cookie')).toContain(`Max-Age=${e.SESSION_MAX_AGE_SECONDS}`)
        expect(b.res.headers.get('set-cookie')).toContain(
          `Max-Age=${e.SESSION_REMEMBER_MAX_AGE_SECONDS}`,
        )
        const ua = (await userByPhone(short.e164))[0] as Json
        const ub = (await userByPhone(long.e164))[0] as Json
        const ttlShort = Number(((await sessionsOf(ua.id))[0] as Json).ttl)
        const ttlLong = Number(((await sessionsOf(ub.id))[0] as Json).ttl)
        expect(Math.abs(ttlShort - e.SESSION_MAX_AGE_SECONDS)).toBeLessThan(5)
        expect(Math.abs(ttlLong - e.SESSION_REMEMBER_MAX_AGE_SECONDS)).toBeLessThan(5)
        expect(ttlShort).toBeLessThan(ttlLong)
      })

      it('cycle de vie d’une session téléphone : liste (is_current), révocation d’une autre session (204), de la session courante (404), puis logout efface et invalide', async () => {
        const p = uniqueCmPhone()
        const first = await signup(p)
        const second = await loginByCode(p)
        const cookie2 = cookieOf(second.res)

        const list = await call('GET', '/v1/auth/sessions', { cookie: cookie2 })
        expect(list.res.status).toBe(200)
        expect(list.json.data).toHaveLength(2)
        const current = list.json.data.filter((s: Json) => s.is_current)
        expect(current).toHaveLength(1)
        expect(current[0].id).toBe(second.json.session.id)

        expect(
          (await call('DELETE', `/v1/auth/sessions/${second.json.session.id}`, { cookie: cookie2 }))
            .res.status,
        ).toBe(404)
        expect(
          (await call('DELETE', '/v1/auth/sessions/pas-un-uuid', { cookie: cookie2 })).res.status,
        ).toBe(422)
        expect(
          (await call('DELETE', `/v1/auth/sessions/${first.json.session.id}`, { cookie: cookie2 }))
            .res.status,
        ).toBe(204)
        expect((await me(cookieOf(first.res))).res.status).toBe(401)

        const out = await call('POST', '/v1/auth/logout', { cookie: cookie2 })
        expect(out.res.status).toBe(204)
        expect(out.res.headers.get('set-cookie')).toContain('Max-Age=0')
        expect((await me(cookie2)).res.status).toBe(401)
        expect((await call('POST', '/v1/auth/logout')).res.status).toBe(401)
        expect((await call('GET', '/v1/auth/sessions')).res.status).toBe(401)
      })

      it('« déconnexion partout » : toutes les autres sessions sont révoquées, la courante reste valable', async () => {
        const p = uniqueCmPhone()
        const s1 = await signup(p)
        const s2 = await loginByCode(p)
        const s3 = await loginByCode(p)
        expect(
          (await call('POST', '/v1/auth/logout-all', { cookie: cookieOf(s3.res) })).res.status,
        ).toBe(204)
        expect((await me(cookieOf(s1.res))).res.status).toBe(401)
        expect((await me(cookieOf(s2.res))).res.status).toBe(401)
        expect((await me(cookieOf(s3.res))).res.status).toBe(200)
        expect((await call('POST', '/v1/auth/logout-all')).res.status).toBe(401)
      })

      it('une session expirée, révoquée ou d’un compte suspendu ou supprimé est refusée en 401 (cookie ou Bearer)', async () => {
        const p = uniqueCmPhone()
        const s = await signup(p)
        const u = (await userByPhone(p.e164))[0] as Json
        const token = tokenOf(s.res)
        expect((await call('GET', '/v1/auth/me', { bearer: token })).res.status).toBe(200)

        await asAdmin((x) => x`UPDATE iam.users SET status = 'suspended' WHERE id = ${u.id}`)
        expect((await me(cookieOf(s.res))).res.status).toBe(401)
        await asAdmin((x) => x`UPDATE iam.users SET status = 'deleted' WHERE id = ${u.id}`)
        expect((await me(cookieOf(s.res))).res.status).toBe(401)
        await asAdmin((x) => x`UPDATE iam.users SET status = 'active' WHERE id = ${u.id}`)
        expect((await me(cookieOf(s.res))).res.status).toBe(200)

        await asAdmin(
          (x) =>
            x`UPDATE iam.user_sessions SET expires_at = now() - interval '1 second' WHERE user_id = ${u.id}`,
        )
        const expired = await me(cookieOf(s.res))
        expect(expired.res.status).toBe(401)
        expect(expired.json.error.code).toBe('AUTH_TOKEN_INVALID')
        expect((await call('GET', '/v1/auth/me', { bearer: token })).res.status).toBe(401)
      })

      it('GET /me sans jeton, avec un jeton aléatoire ou mal formé : 401 AUTH_TOKEN_INVALID sans détail', async () => {
        for (const init of [
          {},
          { cookie: 'cp_session=' },
          { cookie: `cp_session=${'0'.repeat(64)}` },
          { cookie: 'autre=1' },
          { bearer: 'x' },
        ]) {
          const r = await call('GET', '/v1/auth/me', init)
          expect(r.res.status).toBe(401)
          expect(r.json.error.code).toBe('AUTH_TOKEN_INVALID')
        }
      })

      it('routes e-mail P2.1 appelées par un compte téléphone : resend-verification est un no-op 200 (pas d’e-mail), verify-email et reset-password refusent un jeton inconnu en 422', async () => {
        const p = uniqueCmPhone()
        const s = await signup(p)
        const u = (await userByPhone(p.e164))[0] as Json
        const resend = await call('POST', '/v1/auth/resend-verification', {
          cookie: cookieOf(s.res),
        })
        expect(resend.res.status).toBe(200)
        expect(resend.json).toEqual({ ok: true })
        const emailTokens = await asAdmin(
          (x) =>
            x`SELECT count(*)::int AS n FROM iam.verification_tokens WHERE user_id = ${u.id} AND purpose = 'verify_email'`,
        )
        expect((emailTokens[0] as Json).n).toBe(0)
        expect((await call('POST', '/v1/auth/resend-verification')).res.status).toBe(401)

        const verifyBad = await post('/v1/auth/verify-email', { token: 'inconnu' })
        expect(verifyBad.res.status).toBe(422)
        expect(verifyBad.json.error.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID')
        const resetBad = await post('/v1/auth/reset-password', {
          token: 'inconnu',
          password: 'StrongP@ss42!',
        })
        expect(resetBad.res.status).toBe(422)
        expect(resetBad.json.error.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID')
        const weak = await post('/v1/auth/reset-password', {
          token: 'inconnu',
          password: 'faible123',
        })
        expect(weak.res.status).toBe(422)
        expect(weak.json.error.code).toBe('AUTH_PASSWORD_TOO_WEAK')
      })

      it('un compte téléphone (sans e-mail ni mot de passe) ne peut pas se connecter par e-mail et la réinitialisation de mot de passe n’en révèle rien', async () => {
        const p = uniqueCmPhone()
        await signup(p)
        // E-mail unique : la limite par e-mail (5 / 5 min) est conservée dans Redis d'une exécution à l'autre.
        const ghost = `p22c-ghost-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
        const login = await post('/v1/auth/login', {
          email: ghost,
          password: 'StrongP@ss42!',
        })
        expect(login.res.status).toBe(401)
        expect(login.json.error.code).toBe('AUTH_INVALID_CREDENTIALS')
        const forgot = await post('/v1/auth/forgot-password', { email: ghost })
        expect(forgot.res.status).toBe(200)
        expect(forgot.json).toEqual({ ok: true })
      })
    })

    // ── 7. Concurrence de deux demandes de code ────────────────────────────────────────────

    describe('deux demandes de code simultanées pour le même numéro', () => {
      it('configuration par défaut : exactement une passe (200), l’autre est refusée (429 + Retry-After) ; un seul SMS, un seul jeton actif', async () => {
        const p = uniqueCmPhone()
        const [a, b] = await Promise.all([requestCode(p, uniqueIp()), requestCode(p, uniqueIp())])
        expect([a.res.status, b.res.status].sort()).toEqual([200, 429])
        const loser = a.res.status === 429 ? a : b
        expect(loser.json.error.code).toBe('PLATFORM_RATE_LIMIT')
        const ra = Number(loser.res.headers.get('retry-after'))
        expect(ra).toBeGreaterThanOrEqual(1)
        expect(ra).toBeLessThanOrEqual(60)
        expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(1)
        const active = (await tokens(p.e164)).filter((t) => (t as Json).active)
        expect(active).toHaveLength(1)
        // Le code reçu fonctionne.
        expect(
          (await verify(p, await lastCode(p.e164), uniqueIp(), { full_name: 'Awa' })).res.status,
        ).toBe(200)
      })

      it('délai de renvoi désactivé : un seul des deux codes envoyés est utilisable (le plus récent), l’ancien est refusé', async () => {
        setPhoneConfig({ resendDelaySeconds: 0 })
        const p = uniqueCmPhone()
        const [a, b] = await Promise.all([requestCode(p, uniqueIp()), requestCode(p, uniqueIp())])
        expect(a.res.status).toBe(200)
        expect(b.res.status).toBe(200)
        const sms = getSimulatedOutbox().filter((m) => m.to === p.e164)
        expect(sms).toHaveLength(2)
        const codes = [...new Set(sms.map((m) => extractCode(m.text)))]
        const outcomes: number[] = []
        for (const code of codes)
          outcomes.push((await verify(p, code, uniqueIp(), { full_name: 'Awa' })).res.status)
        // Au plus un code ouvre le compte ; l'autre est refusé (jeton unique par numéro côté vérification).
        expect(outcomes.filter((s) => s === 200).length).toBeLessThanOrEqual(1)
        expect(
          outcomes.filter((s) => s === 200).length + outcomes.filter((s) => s === 422).length,
        ).toBe(codes.length)
        expect(await userByPhone(p.e164)).toHaveLength(1)
      })

      it('[DÉFAUT OUVERT] délai de renvoi désactivé : deux demandes concurrentes laissent EXACTEMENT un jeton actif (jamais deux codes valides à la fois)', async () => {
        // Sans verrou (advisory/FOR UPDATE) autour de « expirer l'actif puis insérer », deux transactions READ COMMITTED
        // concurrentes insèrent chacune un jeton actif. Gardé seulement par la limite Redis (1/60 s) : une panne Redis
        // sur plusieurs instances (limiteur mémoire par processus) rouvre la brèche. Spec CA-8 : « un seul jeton actif ».
        setPhoneConfig({ resendDelaySeconds: 0 })
        const p = uniqueCmPhone()
        await Promise.all([requestCode(p, uniqueIp()), requestCode(p, uniqueIp())])
        const active = (await tokens(p.e164)).filter((t) => (t as Json).active)
        expect(active).toHaveLength(1)
      })
    })

    // ── 8. Langue du SMS et de l’organisation ──────────────────────────────────────────────

    describe('langue', () => {
      it('locale « en » : SMS en anglais (5 minutes, code à 6 chiffres, aucun mot français) ; locale par défaut : français', async () => {
        const en = uniqueCmPhone()
        const fr = uniqueCmPhone()
        expect((await requestCode(en, uniqueIp(), { locale: 'en' })).res.status).toBe(200)
        expect((await requestCode(fr, uniqueIp())).res.status).toBe(200)
        const textEn = getSimulatedOutbox().filter((m) => m.to === en.e164)[0]?.text ?? ''
        const textFr = getSimulatedOutbox().filter((m) => m.to === fr.e164)[0]?.text ?? ''
        expect(textEn).toMatch(
          /^\d{6} is your project-cp code\. Valid for 5 minutes\. Do not share it with anyone\.$/,
        )
        expect(textEn).not.toMatch(/votre|Valable|Ne le partagez/)
        expect(textFr).toMatch(
          /^\d{6} est votre code project-cp\. Valable 5 minutes\. Ne le partagez avec personne\.$/,
        )
        expect(textEn.length).toBeLessThanOrEqual(160)
        expect(textFr.length).toBeLessThanOrEqual(160)
      })

      it('inscription en anglais sans nom : organisation « My organization », locale « en » ; en français : « Mon organisation » ; jamais le numéro', async () => {
        const en = uniqueCmPhone()
        const fr = uniqueCmPhone()
        const ipE = uniqueIp()
        await requestCode(en, ipE, { locale: 'en' })
        const a = await verify(en, await lastCode(en.e164), ipE, { locale: 'en' })
        const b = await signup(fr, null)
        expect(a.res.status).toBe(200)
        expect(b.res.status).toBe(200)
        expect(a.json.user.locale).toBe('en')
        expect(b.json.user.locale).toBe('fr')
        const orgEn = (await orgsOf(((await userByPhone(en.e164))[0] as Json).id))[0] as Json
        const orgFr = (await orgsOf(((await userByPhone(fr.e164))[0] as Json).id))[0] as Json
        expect(orgEn.name).toBe('My organization')
        expect(orgFr.name).toBe('Mon organisation')
        expect(orgEn.name + orgFr.name).not.toContain(en.national)
        expect(orgEn.name + orgFr.name).not.toContain(fr.national)
      })

      it.each(['es', 'EN', 'fr-FR', '', 'en;', null, 5])(
        'locale invalide %j : 422 PLATFORM_VALIDATION_ERROR, aucun SMS',
        async (locale) => {
          const p = uniqueCmPhone()
          const r = await post(REQ, { phone: p.national, country: 'CM', locale })
          expect(r.res.status).toBe(422)
          expect(r.json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(0)
        },
      )
    })

    // ── 9. Bornes, Unicode et injection ────────────────────────────────────────────────────

    describe('bornes des entrées, Unicode et injection', () => {
      const smsCount = () => getSimulatedOutbox().length

      it.each([
        ['numéro trop court pour le schéma (3 caractères)', { phone: '690', country: 'CM' }],
        ['numéro de 33 caractères', { phone: '6'.repeat(33), country: 'CM' }],
        ['numéro absent', { country: 'CM' }],
        ['numéro nombre JSON', { phone: 690123442, country: 'CM' }],
        ['numéro tableau', { phone: ['690123442'], country: 'CM' }],
        ['numéro nul', { phone: null, country: 'CM' }],
        ['numéro d’espaces', { phone: '          ', country: 'CM' }],
        ['pays hors liste', { phone: '690123442', country: 'GB' }],
        ['pays en minuscules', { phone: '690123442', country: 'cm' }],
        ['pays nombre', { phone: '690123442', country: 237 }],
        ['corps vide objet', {}],
      ])(
        'request-code : %s → 422 PLATFORM_VALIDATION_ERROR, aucun SMS, aucun jeton',
        async (_n, body) => {
          const before = smsCount()
          const r = await post(REQ, body)
          expect(r.res.status).toBe(422)
          expect(r.json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
          expect(smsCount()).toBe(before)
        },
      )

      it('numéro de 32 caractères accepté par le schéma mais refusé par la normalisation (TOO_LONG), sans écho de la saisie', async () => {
        const phone = '6'.repeat(32)
        const r = await post(REQ, { phone, country: 'CM' })
        expect(r.res.status).toBe(422)
        expect(r.json.error.details.reason).toBe('TOO_LONG')
        expect(r.text).not.toContain(phone)
      })

      it.each([
        ['5 chiffres', '12345'],
        ['7 chiffres', '1234567'],
        ['lettres', 'abcdef'],
        ['espace en tête', ' 123456'],
        ['espace en queue', '123456 '],
        ['chiffres pleine largeur', '１２３４５６'],
        ['chiffres arabo-indiens', '١٢٣٤٥٦'],
        ['notation exponentielle', '1e5555'],
        ['signe', '+12345'],
        ['code nombre JSON', 123456],
        ['code nul', null],
        ['injection SQL', "1' OR '1'='1"],
        ['saut de ligne', '123456\n'],
      ])(
        'verify-code : code invalide (%s) → 422 PLATFORM_VALIDATION_ERROR sans compter d’essai',
        async (_n, code) => {
          const p = uniqueCmPhone()
          const ip = uniqueIp()
          await requestCode(p, ip)
          const r = await post(VER, { phone: p.national, country: 'CM', code }, ip)
          expect(r.res.status).toBe(422)
          expect(r.json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
          expect(((await tokens(p.e164))[0] as Json).attempts).toBe(0)
          expect(r.text).not.toContain(p.national)
        },
      )

      it('full_name : 200 caractères acceptés (et conservés tels quels dans l’organisation), 201 refusés, espaces seuls refusés, espaces autour rognés', async () => {
        const long = 'A'.repeat(200)
        const ok = await signup(uniqueCmPhone(), long)
        expect(ok.res.status).toBe(200)
        expect(ok.json.user.full_name).toBe(long)
        const p2 = uniqueCmPhone()
        const ip = uniqueIp()
        await requestCode(p2, ip)
        const code = await lastCode(p2.e164)
        for (const name of ['A'.repeat(201), '   ', '']) {
          const r = await verify(p2, code, ip, { full_name: name })
          expect(r.res.status, JSON.stringify(name)).toBe(422)
          expect(r.json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
        }
        expect(((await tokens(p2.e164))[0] as Json).attempts).toBe(0)
        const trimmed = await verify(p2, code, ip, { full_name: '   Awa   ' })
        expect(trimmed.res.status).toBe(200)
        expect(trimmed.json.user.full_name).toBe('Awa')
      })

      it('full_name Unicode et hostile : stocké tel quel (JSON), jamais interprété ; les tables restent intactes', async () => {
        const names = [
          'Ñandú 山田 😀 مرحبا',
          "Robert'); DROP TABLE iam.users;--",
          '<script>alert(1)</script>',
          `{{7*7}} $\u007bprocess.env.OTP_PEPPER}`,
          'a‮b​c',
          'Zoë é',
        ]
        for (const name of names) {
          const p = uniqueCmPhone()
          const r = await signup(p, name)
          expect(r.res.status, name).toBe(200)
          expect(r.res.headers.get('content-type')).toMatch(/^application\/json/)
          expect(r.json.user.full_name).toBe(name)
          const u = (await userByPhone(p.e164))[0] as Json
          expect(u.full_name).toBe(name)
          expect(((await orgsOf(u.id))[0] as Json).name).toBe(name)
          expect(r.text).not.toContain(process.env.OTP_PEPPER ?? PEPPER)
        }
        expect((await asAdmin((s) => s`SELECT to_regclass('iam.users')::text AS t`))[0]?.t).toBe(
          'iam.users',
        )
      })

      it('[DÉFAUT OUVERT] full_name contenant un octet NUL : refus de validation (4xx), jamais un 500 ; le jeton n’est pas gaspillé', async () => {
        // Le NUL passe zod puis PostgreSQL le refuse (22021 « invalid byte sequence ») : 500 opaque au lieu d'un 422.
        const p = uniqueCmPhone()
        const ip = uniqueIp()
        await requestCode(p, ip)
        const r = await verify(p, await lastCode(p.e164), ip, { full_name: 'Awa\u0000Nkeng' })
        expect(r.res.status).toBeGreaterThanOrEqual(400)
        expect(r.res.status).toBeLessThan(500)
      })

      it.each([
        ["6 90 12 34 42'; DROP TABLE iam.users;--"],
        ["690123442');DROP TABLE iam.users;--"],
        ["690123442'--"],
        ['<script>690123442</script>'],
        ['690123442\u0000'],
        ['690123442\n690123443'],
        ['+237 690123442; +237690123443'],
        ['\u202e690123442'],
        ['tel:+237690123442'],
        [`$\u007bjndi:ldap://x}`],
      ])(
        'phone hostile %j → 422, la saisie n’est jamais renvoyée, aucun jeton, aucune table touchée',
        async (phone) => {
          const before = smsCount()
          const r = await post(REQ, { phone, country: 'CM' })
          expect(r.res.status).toBe(422)
          expect(r.json.error.code).toBe('PLATFORM_VALIDATION_ERROR')
          // Refus par le schéma (longueur) ou par la normalisation (NOT_A_NUMBER) : jamais une acceptation.
          const d = r.json.error.details
          expect(d.reason === 'NOT_A_NUMBER' || d.issues?.[0]?.path?.[0] === 'phone').toBe(true)
          expect(r.text).not.toContain('DROP TABLE')
          expect(r.text).not.toContain('script')
          expect(r.text).not.toContain('jndi')
          expect(smsCount()).toBe(before)
          expect((await asAdmin((s) => s`SELECT to_regclass('iam.users')::text AS t`))[0]?.t).toBe(
            'iam.users',
          )
        },
      )

      it('chiffres pleine largeur / arabo-indiens acceptés mais normalisés en E.164 ASCII : le jeton et le compte portent le numéro canonique', async () => {
        const p = uniqueCmPhone()
        const fullWidth = [...p.national]
          .map((d) => String.fromCharCode(0xff10 + Number(d)))
          .join('')
        const arabic = [...p.national].map((d) => String.fromCharCode(0x0660 + Number(d))).join('')
        const ip = uniqueIp()
        expect((await post(REQ, { phone: fullWidth, country: 'CM' }, ip)).res.status).toBe(200)
        usedPhones.add(p.e164)
        const rows = await tokens(p.e164)
        expect(rows).toHaveLength(1)
        expect((rows[0] as Json).target).toBe(p.e164)
        // Le même numéro écrit autrement partage le même délai de renvoi : pas de contournement par la graphie.
        const again = await post(REQ, { phone: arabic, country: 'CM' }, ip)
        expect(again.res.status).toBe(429)
        const ok = await post(
          VER,
          { phone: arabic, country: 'CM', code: await lastCode(p.e164), full_name: 'Awa' },
          ip,
        )
        expect(ok.res.status).toBe(200)
        expect(ok.json.user.phone).toBe(p.e164)
      })

      it('une extension (« ext. 12 ») est ignorée : même numéro canonique, même compteur de renvoi, aucun contournement de la limite', async () => {
        const p = uniqueCmPhone()
        expect((await requestCode(p, uniqueIp())).res.status).toBe(200)
        const viaExt = await post(REQ, { phone: `${p.national} ext. 12`, country: 'CM' })
        expect(viaExt.res.status).toBe(429)
        expect(await tokens(p.e164)).toHaveLength(1)
      })

      it.each([
        ['JSON tronqué', '{"phone": "690'],
        ['corps vide', ''],
        ['tableau', '[]'],
        ['chaîne JSON', '"690123442"'],
        ['null', 'null'],
      ])(
        'corps brut invalide (%s) : 4xx avec format d’erreur du catalogue, jamais 5xx',
        async (_n, rawBody) => {
          for (const path of [REQ, VER]) {
            const r = await call('POST', path, { rawBody })
            expect(r.res.status).toBeGreaterThanOrEqual(400)
            expect(r.res.status).toBeLessThan(500)
            expect(r.json.error.code).toMatch(/^[A-Z]+_[A-Z_]+$/)
            expect(r.json.error.request_id).toBeTruthy()
          }
        },
      )

      it('sans Content-Type JSON : refusé (4xx), aucun SMS', async () => {
        const before = smsCount()
        const res = await app.request(
          REQ,
          {
            method: 'POST',
            body: 'phone=690123442&country=CM',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
          },
          socketEnv(uniqueIp()),
        )
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(res.status).toBeLessThan(500)
        expect(smsCount()).toBe(before)
      })
    })

    // ── 10. Aucune donnée personnelle dans les réponses d’erreur ───────────────────────────

    describe('aucune PII dans les réponses d’erreur', () => {
      it('toutes les erreurs du parcours (422 numéro, 422 code, expiré, 5 essais, 429, 403, 503, 500) ne contiennent ni numéro, ni code, ni nom, ni jeton', async () => {
        const p = uniqueCmPhone()
        const name = 'Nom Secret Zébulon'
        const collected: { label: string; text: string; res: Response }[] = []
        const note = (label: string, r: { text: string; res: Response }) =>
          collected.push({ label, text: r.text, res: r.res })

        const ip = uniqueIp()
        note(
          'numéro invalide',
          await post(REQ, { phone: `${p.national.slice(0, 6)}`, country: 'CM' }, ip),
        )
        await requestCode(p, ip)
        const good = await lastCode(p.e164)
        const bad = wrongCodeFor(good)
        note('429 renvoi', await requestCode(p, ip))
        for (let i = 0; i < 5; i++)
          note(`code faux ${i + 1}`, await verify(p, bad, ip, { full_name: name }))
        note('essais épuisés', await verify(p, good, ip, { full_name: name }))
        note(
          'schéma code',
          await post(
            VER,
            { phone: p.national, country: 'CM', code: 'abcdef', full_name: name },
            ip,
          ),
        )

        const q = uniqueCmPhone()
        await requestCode(q, ip)
        const codeQ = await lastCode(q.e164)
        await asAdmin(
          (s) =>
            s`UPDATE iam.verification_tokens SET expires_at = now() - interval '1 minute' WHERE target = ${q.e164}`,
        )
        note('code expiré', await verify(q, codeQ, ip, { full_name: name }))

        const s = uniqueCmPhone()
        await signup(s)
        const us = (await userByPhone(s.e164))[0] as Json
        await asAdmin((x) => x`UPDATE iam.users SET status = 'suspended' WHERE id = ${us.id}`)
        await redis.del(resendKey(s.e164))
        const ipS = uniqueIp()
        await requestCode(s, ipS)
        note('compte suspendu', await verify(s, await lastCode(s.e164), ipS))

        const f = uniqueCmPhone()
        const ipF = uniqueIp()
        await requestCode(f, ipF)
        const codeF = await lastCode(f.e164)
        setPhoneConfig({ dataRegionCode: 'nowhere-0' })
        note('500 interne', await verify(f, codeF, ipF, { full_name: name }))
        resetPhoneConfig()

        const u = uniqueCmPhone()
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('APP_URL', 'https://app.example.test') // requis en production (CSRF) — ne pas dépendre de .env.example
        vi.stubEnv('SMS_PROVIDER', 'none')
        resetEnvCache()
        resetSmsProvider()
        note('503 fournisseur', await requestCode(u, uniqueIp()))

        const secrets = [p, q, s, f, u].flatMap((x) => [x.national, x.e164, x.e164.slice(1)])
        secrets.push(good, codeQ, name, 'Zébulon', PEPPER)
        for (const c of collected) {
          for (const secret of secrets) {
            expect(c.text, `${c.label} contient « ${secret} »`).not.toContain(secret)
          }
          expect(c.res.headers.get('set-cookie'), c.label).toBeNull()
        }
        expect(collected.map((c) => c.res.status)).toEqual(
          expect.arrayContaining([422, 429, 403, 500, 503]),
        )
        const hundred = collected.find((c) => c.label === '500 interne')
        expect(JSON.parse(hundred?.text ?? '{}').error.details).toEqual({})
      })
    })

    // ── 11. Régression P2.1 : limite par e-mail avec Retry-After (Redis réel) ──────────────

    describe('régression P2.1 : limite par e-mail avec Retry-After', () => {
      it('connexion : la 6ᵉ tentative pour le même e-mail → 429 PLATFORM_RATE_LIMIT + Retry-After (1..300) ; compteur réel dans Redis avec TTL ≤ 300 s', async () => {
        const email = `p22c-rl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
        for (let i = 0; i < 5; i++) {
          const r = await post('/v1/auth/login', { email, password: 'Mauvais1pass' })
          expect(r.res.status, `tentative ${i + 1}`).toBe(401)
        }
        const blocked = await post('/v1/auth/login', { email, password: 'Mauvais1pass' })
        expect(blocked.res.status).toBe(429)
        expect(blocked.json.error.code).toBe('PLATFORM_RATE_LIMIT')
        const ra = blocked.res.headers.get('retry-after')
        expect(ra).toMatch(/^\d+$/)
        expect(Number(ra)).toBeGreaterThanOrEqual(1)
        expect(Number(ra)).toBeLessThanOrEqual(300)

        const key = `rl:auth:email:${createHash('sha256').update(email).digest('hex')}`
        expect(await redis.exists(key)).toBe(1)
        const ttl = await redis.ttl(key)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(300)
        // La clé ne contient pas l'e-mail en clair.
        expect(key).not.toContain(email)
        expect(blocked.text).not.toContain(email)
      })

      it('connexion : e-mail existant et inconnu → 429 identiques (statut, code, Retry-After borné) : pas d’oracle d’existence', async () => {
        const known = await emailUser() // 1 inscription + 1 connexion déjà comptées
        const unknown = `p22c-unk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
        const codes: { status: number; code: string }[] = []
        for (const email of [known.email, unknown]) {
          let last = await post('/v1/auth/login', { email, password: 'Mauvais1pass' })
          for (let i = 0; i < 6 && last.res.status !== 429; i++) {
            last = await post('/v1/auth/login', { email, password: 'Mauvais1pass' })
          }
          expect(last.res.status).toBe(429)
          expect(Number(last.res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
          codes.push({ status: last.res.status, code: last.json.error.code })
        }
        expect(codes[0]).toEqual(codes[1])
      })

      it('mot de passe oublié : la 6ᵉ demande pour le même e-mail → 429 + Retry-After ; la limite par IP seule ne masque pas la limite par e-mail', async () => {
        const email = `p22c-fp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`
        for (let i = 0; i < 5; i++) {
          expect((await post('/v1/auth/forgot-password', { email })).res.status).toBe(200)
        }
        const blocked = await post('/v1/auth/forgot-password', { email })
        expect(blocked.res.status).toBe(429)
        const ra = Number(blocked.res.headers.get('retry-after'))
        expect(ra).toBeGreaterThanOrEqual(1)
        expect(ra).toBeLessThanOrEqual(300)
      })
    })

    // ── 12. Défauts ouverts (tests ROUGES attendus) ────────────────────────────────────────

    describe('[DÉFAUT OUVERT] adresse IPv4 reçue en notation IPv6 (::ffff:a.b.c.d)', () => {
      // Un serveur Node en double pile (`serve({ port })` sans hôte) rapporte les clients IPv4 sous la forme
      // `::ffff:a.b.c.d`. La blocklist (IP exacte ou plage IPv4) et les compteurs par IP ne la reconnaissent alors pas.
      const v4 = () =>
        `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${1 + ((Math.random() * 250) | 0)}`

      it('une IP IPv4 listée en blocklist (kind « ip ») bloque aussi sa forme ::ffff:a.b.c.d : 200 sans SMS', async () => {
        const ip = v4()
        const p = uniqueCmPhone()
        await withBlocks([['ip', ip]], async () => {
          const r = await requestCode(p, `::ffff:${ip}`)
          expect(r.res.status).toBe(200)
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(0)
        })
      })

      it('une plage CIDR IPv4 bloque aussi les adresses de la plage reçues en ::ffff:a.b.c.d : 200 sans SMS', async () => {
        const ip = v4()
        const parts = ip.split('.')
        const p = uniqueCmPhone()
        await withBlocks([['cidr', `${parts[0]}.${parts[1]}.${parts[2]}.0/24`]], async () => {
          const r = await requestCode(p, `::ffff:${ip}`)
          expect(r.res.status).toBe(200)
          expect(getSimulatedOutbox().filter((m) => m.to === p.e164)).toHaveLength(0)
        })
      })

      it('les deux formes d’une même adresse partagent la limite par IP (pas de double quota en contournant par la notation)', async () => {
        setPhoneConfig({ requestPerIp: 1 })
        const ip = v4()
        expect((await requestCode(uniqueCmPhone(), ip)).res.status).toBe(200)
        const second = await requestCode(uniqueCmPhone(), `::ffff:${ip}`)
        expect(second.res.status).toBe(429)
      })
    })

    // Garde-fou : le pool d'authentification reste en lecture seule pour la blocklist (aucune écriture possible).
    it('app_auth ne peut ni insérer ni modifier la blocklist (lecture seule)', async () => {
      await expect(
        getPoolAuth()`INSERT INTO platform.blocklist_entries (kind, value, reason) VALUES ('ip', '203.0.113.9', 'x')`,
      ).rejects.toThrow(/permission denied/)
    })
  },
)
