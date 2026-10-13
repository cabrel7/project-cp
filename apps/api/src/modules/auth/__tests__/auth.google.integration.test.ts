/**
 * P2.3 — connexion / inscription par Google : INTÉGRATION, PostgreSQL réel + Redis réel + faux Google (MSW).
 * Aucun mock du repository, du SQL, de Redis ni des verrous. Frontières simulées : Google (`fake-google.ts`), le
 * transport SMTP et le flux pino (`google-test-mocks.ts`). Pool admin : préparation et vérification seulement.
 *
 * Règles testées : spec P2.3 CA-1, CA-4 à CA-11, CA-19, CA-20 (démarrage, rappel, sécurité OAuth : PKCE, state, nonce,
 * id_token falsifié, règle P-2 « Google fait autorité », fournisseur lent ou en panne, états de compte). La liaison, la
 * déliaison, la concurrence, les alertes et le /me sont dans `auth.google.link.integration.test.ts` ; les jetons jamais
 * conservés et les journaux sans PII dans `auth.google.privacy.integration.test.ts`.
 * Les tests obligatoires de la spec sont préfixés « [OBLIGATOIRE] ». Garde-fou : avec CP_REQUIRE_INTEGRATION, une base
 * ou un Redis absent = ÉCHEC (jamais un saut).
 *
 * Phase RED : routes et modules `oauth/*` absents.
 */
import { getPoolRw } from '@cp/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_URL,
  FLOW_COOKIE,
  FLOW_COOKIE_PATH,
  GoogleHarness,
  type Json,
  probeInfra,
  REDIRECT_URI,
  TEST_PEPPER,
} from '../../../../test/google-harness.js'
import { resetEnvCache } from '../../../env.js'
import { resetLimiters } from '../../../middlewares/rate-limit.js'
import { ID_TOKEN_FAULTS, type IdTokenFault, pkceChallenge } from './fake-google.js'
import { loadSrc, uniqueIp } from './phone-test-utils.js'

vi.mock('nodemailer', async () => (await import('./google-test-mocks.js')).nodemailerMockModule())
vi.mock('pino', async (original) =>
  (await import('./google-test-mocks.js')).pinoCaptureModule(await original()),
)

const hasInfra = await probeInfra()
const realRedisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe.skipIf(!hasInfra)(
  'Connexion Google (PostgreSQL réel + Redis réel)',
  { timeout: 30_000 },
  () => {
    const h = new GoogleHarness()

    beforeAll(() => h.setup())
    afterAll(() => h.teardown())
    beforeEach(() => h.beforeEach())
    afterEach(() => h.afterEach())

    it('doit fournir les coutures de test de la configuration Google (contrat du tester)', async () => {
      const client = await loadSrc<typeof import('../oauth/google.client.js')>(
        '../oauth/google.client.js',
      )
      expect(typeof client.setGoogleOAuthConfigForTests).toBe('function')
      expect(typeof client.setGoogleTimeoutForTests).toBe('function')
      expect(typeof client.resetGoogleForTests).toBe('function')
      const idToken = await loadSrc<typeof import('../oauth/google.id-token.js')>(
        '../oauth/google.id-token.js',
      )
      expect(typeof idToken.resetGoogleJwksForTests).toBe('function')
    })

    // ── CA-1 : catalogue d'erreurs (migration de données 0005) ──────────────────────────────────────────

    describe('catalogue d’erreurs (CA-1)', () => {
      const expected = [
        [
          'AUTH_SOCIAL_FLOW_INVALID',
          422,
          'La connexion a expiré ou n’est pas valide. Recommencez.',
          'Sign-in expired or is invalid. Try again.',
          false,
        ],
        [
          'AUTH_SOCIAL_EMAIL_UNVERIFIED',
          422,
          'Google ne peut pas garantir cette adresse e-mail. Inscrivez-vous avec votre e-mail.',
          'Google can’t vouch for this email address. Sign up with your email.',
          false,
        ],
        [
          'AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
          503,
          'Connexion avec ce fournisseur momentanément indisponible',
          'Sign-in with this provider is temporarily unavailable',
          true,
        ],
        [
          'AUTH_IDENTITY_ALREADY_LINKED',
          409,
          'Ce compte est déjà lié',
          'This account is already linked',
          false,
        ],
        [
          'AUTH_ACCOUNT_NOT_VERIFIED',
          403,
          'Vérifiez d’abord votre adresse e-mail',
          'Verify your email address first',
          false,
        ],
        [
          'AUTH_LAST_SIGN_IN_METHOD',
          409,
          'Impossible de retirer votre dernier moyen de connexion',
          'You can’t remove your last sign-in method',
          false,
        ],
        [
          'AUTH_REAUTH_REQUIRED',
          403,
          'Pour votre sécurité, reconnectez-vous puis réessayez',
          'For your security, sign in again and retry',
          false,
        ],
      ] as const

      // La spec écrit les apostrophes en `''` SQL ; on compare après normalisation de l'apostrophe typographique.
      const norm = (s: unknown) => String(s).replaceAll('’', "'")

      it('doit contenir les 7 codes avec statut HTTP, messages FR/EN, relançable, sans remboursement et doc_path', async () => {
        const rows = await getPoolRw()`
          SELECT code, category, http_status, message, is_retryable, refunds_credits, doc_path
          FROM platform.error_codes WHERE code = ANY(${expected.map((e) => e[0])}) ORDER BY code`
        expect(rows).toHaveLength(7)
        for (const [code, status, fr, en, retryable] of expected) {
          const row = rows.find((r) => r.code === code)
          expect(row, code).toBeDefined()
          expect(row?.category, code).toBe('AUTH')
          expect(row?.http_status, code).toBe(status)
          expect(norm(row?.message?.fr), code).toBe(norm(fr))
          expect(norm(row?.message?.en), code).toBe(norm(en))
          expect(row?.is_retryable, code).toBe(retryable)
          expect(row?.refunds_credits, code).toBe(false)
          expect(row?.doc_path, code).toBe(`/errors/${code.toLowerCase()}`)
        }
      })

      it('ne doit rendre relançable que AUTH_SOCIAL_PROVIDER_UNAVAILABLE', async () => {
        const rows = await getPoolRw()`
          SELECT code FROM platform.error_codes
          WHERE code = ANY(${expected.map((e) => e[0])}) AND is_retryable ORDER BY code`
        expect(rows.map((r) => r.code)).toEqual(['AUTH_SOCIAL_PROVIDER_UNAVAILABLE'])
      })

      it('ne doit pas créer AUTH_SOCIAL_ACCOUNT_EXISTS (le compte existant n’est pas une erreur)', async () => {
        const rows =
          await getPoolRw()`SELECT code FROM platform.error_codes WHERE code = 'AUTH_SOCIAL_ACCOUNT_EXISTS'`
        expect(rows).toHaveLength(0)
      })
    })

    // ── CA-4 : démarrage ────────────────────────────────────────────────────────────────────────────────

    describe('démarrage /oauth/google/start (CA-4)', () => {
      it('doit rediriger vers Google avec PKCE S256, state, nonce et la redirect_uri exacte, sans access_type=offline', async () => {
        const flow = await h.start({ next: '/account/security', locale: 'en' })
        const u = flow.authUrl
        expect(u.origin).toBe('https://accounts.google.com')
        expect(u.pathname).toBe('/o/oauth2/v2/auth')
        const p = u.searchParams
        expect(p.get('response_type')).toBe('code')
        expect(p.get('client_id')).toBe(h.fake.clientId)
        expect(p.get('redirect_uri')).toBe(REDIRECT_URI)
        expect((p.get('scope') ?? '').split(' ').sort()).toEqual(['email', 'openid', 'profile'])
        expect(p.get('prompt')).toBe('select_account')
        expect(p.get('state') ?? '').toMatch(/^[A-Za-z0-9_-]{43,}$/)
        expect(p.get('nonce') ?? '').toMatch(/^[A-Za-z0-9_-]{43,}$/)
        expect(p.get('state')).not.toBe(p.get('nonce'))
        expect(p.get('code_challenge') ?? '').toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(p.get('code_challenge_method')).toBe('S256')
        expect(p.has('access_type')).toBe(false)
        expect(p.has('code_verifier')).toBe(false)
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('doit poser le cookie de flux HttpOnly, SameSite=Lax, Path=/v1/auth/oauth/google, Max-Age=600 (non Secure hors production)', async () => {
        const flow = await h.start()
        const c = flow.start.cookie(FLOW_COOKIE)
        expect(c?.value).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(c?.attrs.httponly).toBe(true)
        expect(String(c?.attrs.samesite).toLowerCase()).toBe('lax')
        expect(c?.attrs.path).toBe(FLOW_COOKIE_PATH)
        expect(c?.attrs['max-age']).toBe('600')
        expect(c?.attrs.secure).toBeUndefined()
      })

      it('doit stocker le flux dans Redis sous l’empreinte du cookie (TTL ≤ 600 s), jamais la valeur brute, sans e-mail', async () => {
        const flow = await h.start({ next: '/account/security', locale: 'en' })
        const key = await h.redisKeyFor('auth:oauth:flow:', flow.flowCookie)
        expect(key, 'clé Redis auth:oauth:flow:<sha256(cookie)>').not.toBeNull()
        const ttl = await h.redis.ttl(key as string)
        expect(ttl).toBeGreaterThan(590)
        expect(ttl).toBeLessThanOrEqual(600)
        expect(await h.redisKeysContaining(flow.flowCookie)).toEqual([])
        const raw = (await h.redis.get(key as string)) as string
        const stored: Json = JSON.parse(raw)
        expect(stored.state).toBe(flow.state)
        expect(stored.nonce).toBe(flow.nonce)
        expect(stored.intent).toBe('login')
        expect(stored.next).toBe('/account/security')
        expect(stored.locale).toBe('en')
        expect(pkceChallenge(stored.code_verifier)).toBe(flow.codeChallenge)
        expect(raw).not.toMatch(/@/)
        expect(raw).not.toContain(flow.flowCookie)
      })

      it('doit produire un state, un nonce, un défi PKCE et un cookie différents à chaque appel', async () => {
        const a = await h.start()
        const b = await h.start()
        expect(new Set([a.state, b.state]).size).toBe(2)
        expect(new Set([a.nonce, b.nonce]).size).toBe(2)
        expect(new Set([a.codeChallenge, b.codeChallenge]).size).toBe(2)
        expect(new Set([a.flowCookie, b.flowCookie]).size).toBe(2)
      })

      it('ne doit jamais répondre un 422 JSON pour des paramètres invalides (navigation) : redirection normale vers Google', async () => {
        const r = await h.call(
          'GET',
          '/v1/auth/oauth/google/start?remember_me=maybe&locale=zz&next=//evil.com&x=%00',
        )
        expect(r.status).toBe(302)
        expect(r.location?.origin).toBe('https://accounts.google.com')
      })

      it('doit ramener un next hostile à « / » au retour (redirection ouverte)', async () => {
        for (const next of [
          '//evil.com',
          'https://evil.com/x',
          '/\\evil.com',
          '/%5C%5Cevil.com',
          'javascript:alert(1)',
        ]) {
          const { cb } = await h.signIn({ sub: h.newSub(), email: h.newEmail(), next })
          h.expectRedirect(cb, '/')
          expect(cb.location?.href.startsWith(APP_URL)).toBe(true)
        }
      })
    })

    // ── CA-5 : démarrage indisponible ou limité ─────────────────────────────────────────────────────────

    describe('démarrage indisponible ou limité (CA-5)', () => {
      it('doit rediriger vers /auth/login?error=AUTH_SOCIAL_PROVIDER_UNAVAILABLE, sans cookie, quand Google n’est pas configuré', async () => {
        await h.beforeEach({ configured: false })
        const r = await h.call('GET', '/v1/auth/oauth/google/start')
        h.expectRedirect(r, '/auth/login', { error: 'AUTH_SOCIAL_PROVIDER_UNAVAILABLE' })
        expect(r.setCookies).toEqual([])
        expect(r.res.headers.get('content-type') ?? '').not.toContain('json')
      })

      it('doit rediriger vers la même erreur, sans cookie, quand Redis ne répond pas', async () => {
        vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1')
        resetEnvCache()
        resetLimiters()
        try {
          const r = await h.call('GET', '/v1/auth/oauth/google/start')
          h.expectRedirect(r, '/auth/login', { error: 'AUTH_SOCIAL_PROVIDER_UNAVAILABLE' })
          expect(r.cookie(FLOW_COOKIE)).toBeUndefined()
        } finally {
          vi.stubEnv('REDIS_URL', realRedisUrl)
          resetEnvCache()
          resetLimiters()
        }
      })

      it('doit rediriger vers ?error=PLATFORM_RATE_LIMIT (pas de JSON) au 31ᵉ appel d’une même IP dans la minute, sans toucher les autres IP', async () => {
        const ip = uniqueIp()
        for (let i = 1; i <= 30; i++) {
          const r = await h.call('GET', '/v1/auth/oauth/google/start', { ip })
          expect(r.status, `appel ${i}`).toBe(302)
          expect(r.location?.origin, `appel ${i}`).toBe('https://accounts.google.com')
        }
        const limited = await h.call('GET', '/v1/auth/oauth/google/start', { ip })
        h.expectRedirect(limited, '/auth/login', { error: 'PLATFORM_RATE_LIMIT' })
        expect(limited.cookie(FLOW_COOKIE)).toBeUndefined()
        expect(limited.res.headers.get('content-type') ?? '').not.toContain('json')

        const other = await h.call('GET', '/v1/auth/oauth/google/start', { ip: uniqueIp() })
        expect(other.location?.origin).toBe('https://accounts.google.com')
      })

      it('doit limiter aussi le rappel à 30 par minute et par IP, en redirection (jamais en JSON)', async () => {
        const ip = uniqueIp()
        for (let i = 1; i <= 30; i++) {
          const r = await h.call('GET', '/v1/auth/oauth/google/callback?code=x&state=y', { ip })
          h.expectErrorRedirect(r, 'AUTH_SOCIAL_FLOW_INVALID')
        }
        const limited = await h.call('GET', '/v1/auth/oauth/google/callback?code=x&state=y', { ip })
        h.expectErrorRedirect(limited, 'PLATFORM_RATE_LIMIT')
        expect(h.fake.tokenCalls).toHaveLength(0)
      })
    })

    // ── CA-6 : inscription ──────────────────────────────────────────────────────────────────────────────

    describe('inscription par Google (CA-6)', () => {
      it('[OBLIGATOIRE] inscription Google : crée utilisateur actif, organisation personnelle, identité et session (critère en base)', async () => {
        const sub = h.newSub()
        const mixed = `Awa.Nkeng.${h.uniq()}@Gmail.com`
        const email = mixed.toLowerCase()
        h.track('email', email)
        const usersBefore = await h.countUsersByEmail(email)
        expect(usersBefore).toBe(0)

        const flow = await h.start({ next: '/account/security', locale: 'en' })
        const { cb, issued } = await h.signIn({
          flow,
          sub,
          email: mixed,
          name: 'Awa Nkeng',
          next: '/account/security',
        })

        h.expectRedirect(cb, '/account/security')
        const session = cb.cookie(h.sessionCookieName)
        expect(session?.value, 'cookie de session').toMatch(/^[0-9a-f]{64}$/)
        expect(session?.attrs.httponly).toBe(true)
        expect(String(session?.attrs.samesite).toLowerCase()).toBe('lax')
        expect(session?.attrs.path).toBe('/')
        expect(session?.attrs['max-age']).toBe('604800')
        h.expectFlowCookieCleared(cb)

        const user = await h.userByEmail(email)
        expect(user, 'utilisateur créé').toBeDefined()
        expect(user?.email).toBe(email)
        expect(user?.email_verified_at).not.toBeNull()
        expect(user?.status).toBe('active')
        expect(user?.password_hash).toBeNull()
        expect(user?.full_name).toBe('Awa Nkeng')
        expect(user?.locale).toBe('en')
        expect(user?.phone_e164).toBeNull()

        const orgs = await h.orgsOf(String(user?.id))
        expect(orgs).toHaveLength(1)
        expect(orgs[0]?.country_code).toBe('CM')
        expect(orgs[0]?.default_currency).toBe('XAF')

        const identities = await h.identitiesOfUser(String(user?.id))
        expect(identities).toHaveLength(1)
        expect(identities[0]?.provider).toBe('google')
        expect(identities[0]?.provider_user_id).toBe(sub)
        expect(identities[0]?.email).toBe(email)
        expect(identities[0]?.profile).toEqual({})

        expect(await h.sessionsOf(String(user?.id))).toHaveLength(1)
        expect(
          await h.redisKeyFor('auth:oauth:flow:', flow.flowCookie),
          'clé de flux supprimée (GETDEL)',
        ).toBeNull()
        expect(h.fake.tokenCalls).toHaveLength(1)
        expect(issued.code).toBe(h.fake.tokenCalls[0]?.code)

        const me = await h.call('GET', '/v1/auth/me', {
          cookies: { [h.sessionCookieName]: session?.value ?? '' },
        })
        expect(me.status).toBe(200)
        expect(me.json.has_password).toBe(false)
        expect(me.json.email).toBe(email)
        expect(me.json.email_verified).toBe(true)
        expect(me.json.identities).toHaveLength(1)
        expect(me.json.identities[0].provider).toBe('google')
        expect(me.json.id).toBe(user?.public_id)
      })

      it('doit appliquer la locale de la page (fr par défaut, valeur invalide ramenée à fr)', async () => {
        const email = h.newEmail()
        await h.signIn({ sub: h.newSub(), email, locale: 'zz' })
        expect((await h.userByEmail(email))?.locale).toBe('fr')
      })

      it('doit utiliser une session courte quand remember_me=false (SESSION_MAX_AGE_SECONDS) et longue par défaut', async () => {
        const short = await h.signIn({ sub: h.newSub(), email: h.newEmail(), rememberMe: false })
        expect(short.cb.cookie(h.sessionCookieName)?.attrs['max-age']).toBe('86400')
        const long = await h.signIn({ sub: h.newSub(), email: h.newEmail() })
        expect(long.cb.cookie(h.sessionCookieName)?.attrs['max-age']).toBe('604800')
      })

      it('doit nettoyer le nom : conservé (1 à 200 caractères), NULL s’il est vide, trop long ou contient un NUL', async () => {
        const cases: [string, string | null][] = [
          ['A'.repeat(200), 'A'.repeat(200)],
          ['A'.repeat(201), null],
          ['', null],
          ['Awa\u0000Nkeng', null],
        ]
        for (const [name, expected] of cases) {
          const email = h.newEmail()
          const { cb } = await h.signIn({ sub: h.newSub(), email, name })
          expect(cb.status, `nom de ${name.length} caractères`).toBe(302)
          expect((await h.userByEmail(email))?.full_name ?? null).toBe(expected)
        }
      })

      it('doit poser les cookies Secure en production (flux et session)', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('SMS_PROVIDER', 'none')
        vi.stubEnv('OTP_PEPPER', TEST_PEPPER)
        resetEnvCache()
        try {
          const { cb, flow } = await h.signIn({ sub: h.newSub(), email: h.newEmail() })
          expect(flow.start.cookie(FLOW_COOKIE)?.attrs.secure).toBe(true)
          expect(cb.cookie(h.sessionCookieName)?.attrs.secure).toBe(true)
        } finally {
          vi.stubEnv('NODE_ENV', 'test')
          vi.stubEnv('SMS_PROVIDER', 'simulated')
          resetEnvCache()
        }
      })
    })

    // ── CA-7 : PKCE ─────────────────────────────────────────────────────────────────────────────────────

    it('[OBLIGATOIRE] PKCE : l’échange présente le code_verifier dont l’empreinte S256 est le code_challenge émis, en un seul appel', async () => {
      const flow = await h.start()
      const { issued, cb } = await h.signIn({ flow, sub: h.newSub(), email: h.newEmail() })
      expect(cb.status).toBe(302)
      expect(h.fake.tokenCalls).toHaveLength(1)
      const call = h.fake.tokenCalls[0]
      expect(call?.grantType).toBe('authorization_code')
      expect(call?.code).toBe(issued.code)
      expect(call?.redirectUri).toBe(REDIRECT_URI)
      expect(call?.codeVerifier ?? '').toMatch(/^[A-Za-z0-9._~-]{43,128}$/)
      expect(pkceChallenge(call?.codeVerifier ?? '')).toBe(flow.codeChallenge)
      expect(h.fake.unhandled).toEqual([])
    })

    // ── CA-8 : connexion ────────────────────────────────────────────────────────────────────────────────

    describe('connexion par Google (CA-8)', () => {
      it('[OBLIGATOIRE] connexion Google : même utilisateur, e-mail d’identité rafraîchi, users.email inchangé, sans ticket MFA (critère en base)', async () => {
        const sub = h.newSub()
        const email = h.newEmail()
        const first = await h.makeGoogleUser({ sub, email })
        const before = await h.userByEmail(email)
        const identityBefore = (await h.identitiesBySub(sub))[0]
        const usersTotal = await h.snapshot(first.userId)
        await sleep(25)
        const t0 = Date.now()
        await sleep(25)

        const [local = '', domain = ''] = email.split('@')
        const refreshed = `${local}+new@${domain}`
        for (const claimed of [email.replace(/^./, (c) => c.toUpperCase()), refreshed]) {
          const { cb } = await h.signIn({ sub, email: claimed })
          h.expectRedirect(cb, '/')
          expect(cb.cookie(h.sessionCookieName)?.value).toMatch(/^[0-9a-f]{64}$/)
          expect(cb.json, 'pas de corps JSON : redirection').toBeNull()
          h.expectFlowCookieCleared(cb)
        }

        const after = await h.userByEmail(email)
        expect(after?.email, 'users.email inchangé').toBe(email)
        expect(String(after?.id)).toBe(first.userId)
        expect(await h.countUsersByEmail(email)).toBe(1)
        expect(await h.countUsersByEmail(refreshed)).toBe(0)
        expect((await h.orgsOf(first.userId)).length).toBe(usersTotal.orgs)
        expect((await h.sessionsOf(first.userId)).length).toBe(usersTotal.sessions + 2)
        expect(after?.last_login_at, 'last_login_at mis à jour').not.toBeNull()
        expect(new Date(after?.last_login_at).getTime()).toBeGreaterThan(t0)
        if (before?.last_login_at) {
          expect(new Date(after?.last_login_at).getTime()).toBeGreaterThan(
            new Date(before.last_login_at).getTime(),
          )
        }

        const identityAfter = (await h.identitiesBySub(sub))[0]
        expect(await h.identitiesBySub(sub)).toHaveLength(1)
        expect(identityAfter?.email, 'e-mail de l’identité rafraîchi').toBe(refreshed)
        expect(new Date(identityAfter?.last_used_at).getTime()).toBeGreaterThan(t0)
        expect(String(identityAfter?.id)).toBe(String(identityBefore?.id))

        const sessions = await h.sessionsOf(first.userId)
        expect(
          sessions.every((s) => s.mfa_passed === false),
          'mfa_passed=false comme en P2.1',
        ).toBe(true)
      })

      it('doit connecter aussi quand l’e-mail Google a changé de domaine d’autorité (le sub fait foi, pas l’e-mail)', async () => {
        const sub = h.newSub()
        const first = await h.makeGoogleUser({ sub })
        const { cb } = await h.signIn({ sub, email: h.newEmail('autre') })
        h.expectRedirect(cb, '/')
        expect((await h.sessionsOf(first.userId)).length).toBe(2)
      })
    })

    // ── CA-9 : state ou flux invalide ───────────────────────────────────────────────────────────────────

    describe('state ou flux invalide (CA-9)', () => {
      async function expectRejectedFlow(
        run: (ctx: {
          sub: string
          email: string
        }) => Promise<import('../../../../test/google-harness.js').Res>,
        extra: Record<string, string | null> = {},
      ) {
        const sub = h.newSub()
        const email = h.newEmail()
        const r = await run({ sub, email })
        h.expectErrorRedirect(r, 'AUTH_SOCIAL_FLOW_INVALID', { extra })
        h.expectFlowCookieCleared(r)
        expect(await h.countUsersByEmail(email), 'aucun utilisateur').toBe(0)
        expect(await h.identitiesBySub(sub), 'aucune identité').toHaveLength(0)
      }

      it('[OBLIGATOIRE] state différent : rejeté sans appeler Google', async () => {
        await expectRejectedFlow(async ({ sub, email }) => {
          const flow = await h.start()
          const { cb } = await h.signIn({
            flow,
            sub,
            email,
            callback: { state: `${flow.state.slice(0, -1)}X` },
          })
          return cb
        })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('[OBLIGATOIRE] state absent : rejeté sans appeler Google', async () => {
        await expectRejectedFlow(async ({ sub, email }) => {
          const { cb } = await h.signIn({ sub, email, callback: { state: null } })
          return cb
        })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('[OBLIGATOIRE] cookie de flux absent : rejeté sans appeler Google', async () => {
        await expectRejectedFlow(async ({ sub, email }) => {
          const { cb } = await h.signIn({ sub, email, callback: { flowCookie: null } })
          return cb
        })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('[OBLIGATOIRE] cookie d’un AUTRE flux valide : rejeté sans appeler Google', async () => {
        await expectRejectedFlow(async ({ sub, email }) => {
          const f1 = await h.start()
          const f2 = await h.start()
          const { cb } = await h.signIn({
            flow: f1,
            sub,
            email,
            callback: { flowCookie: f2.flowCookie },
          })
          return cb
        })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('[OBLIGATOIRE] flux expiré (TTL dépassé) : rejeté sans appeler Google', async () => {
        await expectRejectedFlow(async ({ sub, email }) => {
          const flow = await h.start()
          const key = await h.redisKeyFor('auth:oauth:flow:', flow.flowCookie)
          expect(key, 'précondition : le flux existe dans Redis').not.toBeNull()
          await h.redis.pexpire(key as string, 20)
          await sleep(120)
          const { cb } = await h.signIn({ flow, sub, email })
          return cb
        })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('[OBLIGATOIRE] même rappel rejoué une deuxième fois : rejeté, un seul appel à Google, un seul utilisateur', async () => {
        const sub = h.newSub()
        const email = h.newEmail()
        const flow = await h.start()
        const first = await h.signIn({ flow, sub, email })
        expect(first.cb.status).toBe(302)
        expect(first.cb.cookie(h.sessionCookieName)).toBeDefined()

        const replay = await h.callback(flow, first.issued.code)
        h.expectErrorRedirect(replay, 'AUTH_SOCIAL_FLOW_INVALID')
        h.expectFlowCookieCleared(replay)
        expect(h.fake.tokenCalls).toHaveLength(1)
        expect(await h.countUsersByEmail(email)).toBe(1)
        expect(await h.identitiesBySub(sub)).toHaveLength(1)
        const user = await h.userByEmail(email)
        expect(await h.sessionsOf(String(user?.id))).toHaveLength(1)
      })

      it('[OBLIGATOIRE] error=access_denied : rejeté avec reason=cancelled, sans appeler Google', async () => {
        await expectRejectedFlow(
          async () => {
            const flow = await h.start()
            return h.callback(flow, undefined, { error: 'access_denied' })
          },
          { reason: 'cancelled' },
        )
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('doit rejeter toute autre erreur du fournisseur (sans reason=cancelled), sans appeler Google', async () => {
        const flow = await h.start()
        const r = await h.callback(flow, undefined, { error: 'server_error' })
        h.expectErrorRedirect(r, 'AUTH_SOCIAL_FLOW_INVALID', { extra: { reason: null } })
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('doit rejeter un rappel sans code, sans appeler Google', async () => {
        const flow = await h.start()
        const r = await h.callback(flow, undefined)
        h.expectErrorRedirect(r, 'AUTH_SOCIAL_FLOW_INVALID')
        expect(h.fake.tokenCalls).toHaveLength(0)
      })

      it('doit rejeter des paramètres démesurés (code > 2048, state > 128) sans appeler Google ni répondre en JSON', async () => {
        const flow = await h.start()
        const r1 = await h.callback(flow, 'c'.repeat(3000))
        h.expectErrorRedirect(r1, 'AUTH_SOCIAL_FLOW_INVALID')
        const flow2 = await h.start()
        const r2 = await h.callback(flow2, 'abc', { state: 's'.repeat(300) })
        h.expectErrorRedirect(r2, 'AUTH_SOCIAL_FLOW_INVALID')
        expect(h.fake.tokenCalls).toHaveLength(0)
      })
    })

    // ── CA-10 : id_token invalide ───────────────────────────────────────────────────────────────────────

    describe('id_token invalide (CA-10)', () => {
      it.each(ID_TOKEN_FAULTS.map((f) => [f]))(
        '[OBLIGATOIRE] id_token falsifié « %s » : AUTH_SOCIAL_FLOW_INVALID, sans utilisateur, identité ni session',
        async (fault) => {
          const sub = h.newSub()
          const email = h.newEmail()
          const { cb } = await h.signIn({ sub, email, fault: fault as IdTokenFault })
          h.expectErrorRedirect(cb, 'AUTH_SOCIAL_FLOW_INVALID')
          h.expectFlowCookieCleared(cb)
          expect(await h.countUsersByEmail(email)).toBe(0)
          expect(await h.identitiesBySub(sub)).toHaveLength(0)
          expect(h.fake.tokenCalls).toHaveLength(1)
        },
      )

      it('doit accepter un émetteur « accounts.google.com » sans schéma (forme historique de Google)', async () => {
        const email = h.newEmail()
        const { cb } = await h.signIn({
          sub: h.newSub(),
          email,
          claims: { iss: 'accounts.google.com' },
        })
        h.expectRedirect(cb, '/')
        expect(await h.countUsersByEmail(email)).toBe(1)
      })
    })

    // ── CA-11 : e-mail non vérifié ou sans autorité (P-2) ───────────────────────────────────────────────

    describe('e-mail sans autorité de Google (CA-11, règle P-2)', () => {
      const unique = () => h.uniq()
      const refused: [string, () => Parameters<GoogleHarness['signIn']>[0]][] = [
        [
          'email_verified:false',
          () => ({ sub: h.newSub(), email: `x.${unique()}@gmail.com`, emailVerified: false }),
        ],
        [
          'e-mail absent',
          () => ({ sub: h.newSub(), claims: { email: undefined, email_verified: true } }),
        ],
        [
          'adresse tierce (yahoo.fr) sans hd',
          () => ({ sub: h.newSub(), email: `x.${unique()}@yahoo.fr` }),
        ],
        [
          'x@company.cm avec hd étranger',
          () => ({ sub: h.newSub(), email: `x.${unique()}@company.cm`, hd: 'other.cm' }),
        ],
        [
          'email_verified:"false" (chaîne)',
          () => ({ sub: h.newSub(), email: `x.${unique()}@gmail.com`, emailVerified: 'false' }),
        ],
      ]

      it.each(refused)(
        '[OBLIGATOIRE] doit refuser (%s) : AUTH_SOCIAL_EMAIL_UNVERIFIED, rien créé',
        async (_label, build) => {
          const opts = build()
          const { cb } = await h.signIn(opts)
          h.expectErrorRedirect(cb, 'AUTH_SOCIAL_EMAIL_UNVERIFIED')
          h.expectFlowCookieCleared(cb)
          if (opts.email) expect(await h.countUsersByEmail(opts.email)).toBe(0)
          expect(await h.identitiesBySub(opts.sub)).toHaveLength(0)
        },
      )

      const accepted: [string, string, () => Partial<Parameters<GoogleHarness['signIn']>[0]>][] = [
        ['X@GMAIL.COM (majuscules)', `X.${h.uniq()}@GMAIL.COM`, () => ({})],
        ['googlemail.com', `x.${h.uniq()}@googlemail.com`, () => ({})],
        [
          'Workspace : hd égal au domaine',
          `x.${h.uniq()}@company.cm`,
          () => ({ hd: 'company.cm' }),
        ],
        [
          'email_verified:"true" (chaîne)',
          `x.${h.uniq()}@gmail.com`,
          () => ({ emailVerified: 'true' }),
        ],
      ]

      it.each(accepted)(
        'doit accepter %s et créer le compte avec l’e-mail en minuscules',
        async (_label, email, extra) => {
          const sub = h.newSub()
          const { cb } = await h.signIn({ sub, email, ...extra() })
          h.expectRedirect(cb, '/')
          expect(cb.cookie(h.sessionCookieName)).toBeDefined()
          const user = await h.userByEmail(email.toLowerCase())
          expect(user?.email).toBe(email.toLowerCase())
          expect(await h.identitiesBySub(sub)).toHaveLength(1)
        },
      )
    })

    // ── CA-19 : fournisseur indisponible ────────────────────────────────────────────────────────────────

    describe('fournisseur indisponible (CA-19)', () => {
      const down = async (opts: Parameters<GoogleHarness['signIn']>[0]) => {
        const r = await h.signIn(opts)
        h.expectErrorRedirect(r.cb, 'AUTH_SOCIAL_PROVIDER_UNAVAILABLE')
        h.expectFlowCookieCleared(r.cb)
        expect(await h.countUsersByEmail(opts.email ?? ''), 'aucun utilisateur').toBe(0)
        expect(await h.identitiesBySub(opts.sub), 'aucune identité').toHaveLength(0)
        expect(
          h.fake.tokenCalls,
          'exactement UN appel au point de jeton : aucune relance',
        ).toHaveLength(1)
        return r
      }

      it.each([[500], [503]])(
        '[OBLIGATOIRE] point de jeton en %i : AUTH_SOCIAL_PROVIDER_UNAVAILABLE, un seul appel',
        async (status) => {
          await down({ sub: h.newSub(), email: h.newEmail(), token: { kind: 'status', status } })
        },
      )

      it('[OBLIGATOIRE] erreur réseau sur le point de jeton : AUTH_SOCIAL_PROVIDER_UNAVAILABLE, un seul appel', async () => {
        await down({ sub: h.newSub(), email: h.newEmail(), token: { kind: 'network_error' } })
      })

      it('[OBLIGATOIRE] délai dépassé (couture à 200 ms, Google répond après 1,5 s) : AUTH_SOCIAL_PROVIDER_UNAVAILABLE, un seul appel', async () => {
        const client = await loadSrc<typeof import('../oauth/google.client.js')>(
          '../oauth/google.client.js',
        )
        client.setGoogleTimeoutForTests(200)
        const t0 = performance.now()
        await down({ sub: h.newSub(), email: h.newEmail(), token: { kind: 'delay', ms: 1500 } })
        expect(performance.now() - t0, 'le fournisseur lent ne bloque pas la requête').toBeLessThan(
          1300,
        )
      })

      it.each([
        ['503', { kind: 'status', status: 503 } as const],
        ['erreur réseau', { kind: 'network_error' } as const],
      ])(
        '[OBLIGATOIRE] JWKS injoignable (%s) : AUTH_SOCIAL_PROVIDER_UNAVAILABLE, sans utilisateur',
        async (_label, behavior) => {
          h.fake.jwks = behavior
          await down({ sub: h.newSub(), email: h.newEmail() })
        },
      )

      it('[OBLIGATOIRE] invalid_grant (400) : AUTH_SOCIAL_FLOW_INVALID, un seul appel', async () => {
        const email = h.newEmail()
        const sub = h.newSub()
        const { cb } = await h.signIn({ sub, email, token: { kind: 'invalid_grant' } })
        h.expectErrorRedirect(cb, 'AUTH_SOCIAL_FLOW_INVALID')
        expect(h.fake.tokenCalls).toHaveLength(1)
        expect(await h.countUsersByEmail(email)).toBe(0)
      })

      it('doit pouvoir recommencer après une panne (aucune panne mémorisée côté application)', async () => {
        await down({ sub: h.newSub(), email: h.newEmail(), token: { kind: 'status', status: 503 } })
        h.fake.reset()
        const email = h.newEmail()
        const { cb } = await h.signIn({ sub: h.newSub(), email })
        h.expectRedirect(cb, '/')
        expect(await h.countUsersByEmail(email)).toBe(1)
      })
    })

    // ── CA-20 : états de compte ─────────────────────────────────────────────────────────────────────────

    describe('états de compte (CA-20)', () => {
      it('doit refuser une identité connue d’un utilisateur suspendu : AUTH_ACCOUNT_SUSPENDED, sans session', async () => {
        const g = await h.makeGoogleUser()
        await h.setStatus(g.email, 'suspended')
        const before = (await h.sessionsOf(g.userId)).length
        const { cb } = await h.signIn({ sub: g.sub, email: g.email })
        h.expectErrorRedirect(cb, 'AUTH_ACCOUNT_SUSPENDED')
        expect((await h.sessionsOf(g.userId)).length).toBe(before)
      })

      it('doit refuser une identité connue d’un utilisateur supprimé : AUTH_SIGNUP_CLOSED, sans session', async () => {
        const g = await h.makeGoogleUser()
        await h.setStatus(g.email, 'deleted')
        const before = (await h.sessionsOf(g.userId)).length
        const { cb } = await h.signIn({ sub: g.sub, email: g.email })
        h.expectErrorRedirect(cb, 'AUTH_SIGNUP_CLOSED')
        expect((await h.sessionsOf(g.userId)).length).toBe(before)
      })

      it('doit refuser l’e-mail d’un utilisateur supprimé avec une identité inconnue : AUTH_SIGNUP_CLOSED, sans utilisateur ni session', async () => {
        const u = await h.makeUser()
        await h.setStatus(u.email, 'deleted')
        const sub = h.newSub()
        const { cb } = await h.signIn({ sub, email: u.email })
        h.expectErrorRedirect(cb, 'AUTH_SIGNUP_CLOSED')
        expect(await h.countUsersByEmail(u.email)).toBe(1)
        expect(await h.identitiesBySub(sub)).toHaveLength(0)
        expect(await h.sessionsOf(u.id)).toHaveLength(0)
      })

      it('doit traiter l’e-mail d’un compte suspendu avec une identité inconnue comme « e-mail connu » : liaison en attente, rien d’écrit', async () => {
        const u = await h.makeUser()
        await h.setStatus(u.email, 'suspended')
        const sub = h.newSub()
        const { cb } = await h.signIn({ sub, email: u.email })
        h.expectRedirect(cb, '/auth/login', { link: 'google' })
        expect(cb.cookie('cp_link')).toBeDefined()
        expect(await h.identitiesBySub(sub)).toHaveLength(0)
        expect(await h.sessionsOf(u.id)).toHaveLength(0)
      })
    })
  },
)
