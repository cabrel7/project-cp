/**
 * P2.3 — harnais commun des tests d'INTÉGRATION Google (PostgreSQL réel + Redis réel + faux Google MSW).
 * Pas de test ici : fichier non collecté par vitest. Situé dans `apps/api/test/` (et non dans `__tests__/`) parce que
 * le garde d'invariants exclut `*\/test/*` pour `process.env` et le pool `app_admin` (usages légitimes en test seulement).
 *
 * Aucun mock du repository, du SQL, de Redis ni des verrous. Seules frontières simulées : Google (MSW, `fake-google.ts`),
 * le transport SMTP et le flux pino (`google-test-mocks.ts`) et le fournisseur SMS (boîte mémoire P2.2).
 * Le pool `app_admin` ne sert qu'à PRÉPARER (activer un compte, vieillir une session…) et à VÉRIFIER l'état en base.
 *
 * ═══ CONTRAT DE TEST (ce que le code de production doit fournir ; voir le compte rendu du tester) ═════════════════════
 *  - `oauth/google.client.ts` : `setGoogleOAuthConfigForTests({ clientId, clientSecret } | null)` (configuration effective
 *    = couture si posée, sinon `env`) ; `setGoogleTimeoutForTests(ms | null)` (délai maximal de l'échange, 5 s par défaut) ;
 *    `resetGoogleForTests()` (config, délai ET cache JWKS).
 *  - Le client Redis du flux OAuth est celui de `getRedisClient()` (`middlewares/rate-limit.ts`), obtenu à chaque appel et
 *    jamais mémorisé : `resetLimiters()` + `REDIS_URL` factice suffisent à simuler une panne Redis (CA-5).
 *  - Clés Redis `auth:oauth:flow:<empreinte>` et `auth:oauth:link:<empreinte>` ; l'empreinte est le SHA-256 de la valeur du
 *    cookie (hex, ou base64url : les deux sont acceptés par `redisKeyFor`).
 *  - Cookies : `cp_oauth_google` (Path=/v1/auth/oauth/google) et `cp_link` (Path=/v1/auth/link), HttpOnly, SameSite=Lax,
 *    Max-Age=600.
 */
import { createHash } from 'node:crypto'
import { getPoolRw } from '@cp/db'
import Redis from 'ioredis'
import { expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { getEnv, resetEnvCache } from '../src/env.js'
import {
  FakeGoogle,
  type IdTokenClaims,
  type IdTokenFault,
  type IssuedTokens,
  type TokenEndpointFault,
} from '../src/modules/auth/__tests__/fake-google.js'
import { mailbox, type SentMail } from '../src/modules/auth/__tests__/google-test-mocks.js'
import {
  extractCode,
  loadSrc,
  socketEnv,
  uniqueCmPhone,
  uniqueIp,
} from '../src/modules/auth/__tests__/phone-test-utils.js'

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
export type Json = any

export const APP_URL = 'https://app.test.example'
export const REDIRECT_URI = `${APP_URL}/v1/auth/oauth/google/callback`
export const FLOW_COOKIE = 'cp_oauth_google'
export const LINK_COOKIE = 'cp_link'
export const FLOW_COOKIE_PATH = '/v1/auth/oauth/google'
export const LINK_COOKIE_PATH = '/v1/auth/link'
export const PASSWORD = 'StrongP@ss42!'
export const TEST_PEPPER = 'g'.repeat(40)

const envVar = (k: string): string | undefined => process.env[k]

// ── Disponibilité de l'infrastructure (jamais un faux vert : voir CP_REQUIRE_INTEGRATION) ─────────────────────────────

export async function probeInfra(): Promise<boolean> {
  let hasDb = false
  let hasRedis = false
  if (envVar('DATABASE_URL_RW') && envVar('DATABASE_URL_AUTH') && envVar('DATABASE_URL_ADMIN')) {
    try {
      await getPoolRw()`SELECT 1`
      hasDb = true
    } catch {
      hasDb = false
    }
  }
  const r = new Redis(envVar('REDIS_URL') ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  try {
    await r.connect()
    hasRedis = (await r.ping()) === 'PONG'
  } catch {
    hasRedis = false
  } finally {
    r.disconnect()
  }
  if (envVar('CP_REQUIRE_INTEGRATION') && !(hasDb && hasRedis)) {
    throw new Error(
      `CP_REQUIRE_INTEGRATION est défini mais PostgreSQL (${hasDb}) et/ou Redis (${hasRedis}) est injoignable : un saut serait un faux vert`,
    )
  }
  return hasDb && hasRedis
}

// ── Réponses HTTP ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SetCookie {
  name: string
  value: string
  attrs: Record<string, string | true>
  raw: string
}

export function parseSetCookie(raw: string): SetCookie {
  const [pair = '', ...rest] = raw.split(';').map((p) => p.trim())
  const eq = pair.indexOf('=')
  const attrs: Record<string, string | true> = {}
  for (const part of rest) {
    const i = part.indexOf('=')
    if (i === -1) attrs[part.toLowerCase()] = true
    else attrs[part.slice(0, i).toLowerCase()] = part.slice(i + 1)
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attrs, raw }
}

export interface Res {
  res: Response
  status: number
  text: string
  json: Json
  setCookies: SetCookie[]
  location: URL | null
  cookie(name: string): SetCookie | undefined
}

export interface CallOpts {
  cookies?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
  ip?: string
}

export interface Flow {
  start: Res
  authUrl: URL
  state: string
  nonce: string
  codeChallenge: string
  flowCookie: string
}

export interface CallbackOpts {
  /** `null` : paramètre `state` absent ; `undefined` : celui du flux. */
  state?: string | null
  /** `null` : cookie de flux absent ; `undefined` : celui du flux. */
  flowCookie?: string | null
  sessionCookie?: string
  extraCookies?: Record<string, string>
  error?: string
  ip?: string
}

export interface SignInOpts {
  sub: string
  email?: string
  name?: string
  emailVerified?: boolean | string | number
  hd?: string
  claims?: IdTokenClaims
  fault?: IdTokenFault
  token?: TokenEndpointFault
  next?: string
  locale?: string
  rememberMe?: boolean | string
  flow?: Flow
  callback?: CallbackOpts
  ip?: string
}

export interface SignInResult {
  flow: Flow
  issued: IssuedTokens
  cb: Res
}

export interface TestUser {
  email: string
  password: string
  id: string
  publicId: string
}

type ClientModule = typeof import('../src/modules/auth/oauth/google.client.js')
const clientModule = () => loadSrc<ClientModule>('../oauth/google.client.js')

// ── Le harnais ────────────────────────────────────────────────────────────────────────────────────────────────────────

export class GoogleHarness {
  readonly appUrl = APP_URL
  readonly fake = new FakeGoogle()
  app!: ReturnType<typeof createApp>['app']
  adminPool!: Awaited<ReturnType<typeof import('@cp/db/admin')['getPoolAdmin']>>
  redis!: Redis
  private readonly emails = new Set<string>()
  private readonly phones = new Set<string>()
  private readonly subs = new Set<string>()

  // ── cycle de vie ──

  async setup(opts: { logLevel?: string } = {}): Promise<void> {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('LOG_LEVEL', opts.logLevel ?? 'debug')
    vi.stubEnv('OTP_PEPPER', TEST_PEPPER)
    vi.stubEnv('SMS_PROVIDER', 'simulated')
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0')
    vi.stubEnv('APP_URL', APP_URL)
    resetEnvCache()
    const { getPoolAdmin } = await import('@cp/db/admin')
    this.adminPool = getPoolAdmin()
    this.redis = new Redis(envVar('REDIS_URL') ?? 'redis://localhost:6379')
    this.fake.expectedRedirectUri = REDIRECT_URI
    this.fake.start()
    this.app = createApp().app
  }

  /** À appeler dans `beforeEach` : espions du faux Google remis à zéro, configuration Google injectée. */
  async beforeEach(opts: { configured?: boolean } = {}): Promise<void> {
    this.fake.reset()
    mailbox.sent.length = 0
    mailbox.failing = false
    mailbox.attempts = 0
    // Module de coutures absent (phase RED) : on n'échoue pas ici, pour que chaque test échoue sur SA vraie assertion
    // (route absente…). Le test « coutures de test » du fichier principal échoue, lui, explicitement.
    let client: ClientModule
    try {
      client = await clientModule()
    } catch (err) {
      if ((err as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') return
      throw err
    }
    client.resetGoogleForTests()
    if (opts.configured !== false) {
      client.setGoogleOAuthConfigForTests({
        clientId: this.fake.clientId,
        clientSecret: this.fake.clientSecret,
      })
    }
  }

  async afterEach(): Promise<void> {
    try {
      ;(await clientModule()).resetGoogleForTests()
    } catch {
      // module absent (phase RED)
    }
  }

  async teardown(): Promise<void> {
    this.fake.stop()
    const emails = [...this.emails]
    const phones = [...this.phones]
    const subs = [...this.subs]
    await this.asAdmin(async (s) => {
      const ids = s`SELECT id FROM iam.users
        WHERE email = ANY(${emails}) OR phone_e164 = ANY(${phones})
           OR id IN (SELECT user_id FROM iam.user_identities WHERE provider_user_id = ANY(${subs}))`
      await s`DELETE FROM iam.verification_tokens WHERE user_id IN (${ids}) OR target = ANY(${emails}) OR target = ANY(${phones})`
      await s`DELETE FROM iam.user_sessions WHERE user_id IN (${ids})`
      await s`DELETE FROM iam.user_identities WHERE user_id IN (${ids}) OR provider_user_id = ANY(${subs})`
      await s`DELETE FROM iam.memberships WHERE user_id IN (${ids})`
      const orgs = s`SELECT id FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await s`DELETE FROM iam.environments WHERE organization_id IN (${orgs})`
      await s`DELETE FROM iam.workspaces WHERE organization_id IN (${orgs})`
      await s`DELETE FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await s`DELETE FROM iam.users WHERE id IN (${ids})`
    }).catch(() => {})
    this.redis.disconnect()
    vi.unstubAllEnvs()
    resetEnvCache()
  }

  async asAdmin<T>(fn: (s: typeof this.adminPool) => Promise<T>): Promise<T> {
    return this.adminPool.begin(async (tx) => {
      await tx`SET LOCAL ROLE app_admin`
      return fn(tx as unknown as typeof this.adminPool)
    }) as Promise<T>
  }

  // ── données de test uniques (la base et Redis sont partagés avec d'autres fichiers) ──

  uniq(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  }

  /** Adresse Gmail unique (Google fait autorité sur gmail.com, règle P-2). Toujours en minuscules. */
  newEmail(prefix = 'awa'): string {
    const e = `${prefix}.${this.uniq()}@gmail.com`
    this.emails.add(e)
    return e
  }

  newSub(): string {
    const s = `g-${this.uniq()}`
    this.subs.add(s)
    return s
  }

  track(kind: 'email' | 'phone' | 'sub', value: string): void {
    if (kind === 'email') this.emails.add(value.toLowerCase())
    else if (kind === 'phone') this.phones.add(value)
    else this.subs.add(value)
  }

  // ── appels HTTP ──

  async call(method: string, path: string, o: CallOpts = {}): Promise<Res> {
    const headers: Record<string, string> = { 'user-agent': 'vitest', ...(o.headers ?? {}) }
    if (o.cookies && Object.keys(o.cookies).length > 0) {
      headers.cookie = Object.entries(o.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    }
    // Un navigateur envoie toujours `Origin` sur une requête non-GET : sans corps JSON, le contrôle CSRF de Hono
    // (content-type absent = text/plain) l'exige. Les tests CSRF passent leur propre `origin`.
    if (method !== 'GET' && o.body === undefined && !headers.origin) headers.origin = APP_URL
    let body: string | undefined
    if (o.body !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(o.body)
    }
    const res = await this.app.request(
      path,
      { method, headers, ...(body === undefined ? {} : { body }) },
      socketEnv(o.ip ?? uniqueIp()),
    )
    const text = await res.text()
    let json: Json = null
    try {
      json = JSON.parse(text)
    } catch {}
    const setCookies = res.headers.getSetCookie().map(parseSetCookie)
    const loc = res.headers.get('location')
    return {
      res,
      status: res.status,
      text,
      json,
      setCookies,
      location: loc ? new URL(loc, 'http://localhost') : null,
      cookie: (name) => setCookies.find((c) => c.name === name),
    }
  }

  get sessionCookieName(): string {
    return getEnv().SESSION_COOKIE_NAME
  }

  // ── flux Google ──

  /** `GET /start` : exige une redirection vers Google et en extrait les paramètres du flux. */
  async start(
    o: {
      next?: string
      locale?: string
      rememberMe?: boolean | string
      ip?: string
      cookies?: Record<string, string>
    } = {},
  ): Promise<Flow> {
    const q = new URLSearchParams()
    if (o.next !== undefined) q.set('next', o.next)
    if (o.locale !== undefined) q.set('locale', o.locale)
    if (o.rememberMe !== undefined) q.set('remember_me', String(o.rememberMe))
    const start = await this.call('GET', `/v1/auth/oauth/google/start${q.size ? `?${q}` : ''}`, {
      ...(o.ip ? { ip: o.ip } : {}),
      ...(o.cookies ? { cookies: o.cookies } : {}),
    })
    expect(
      start.status,
      `GET /start devait rediriger vers Google (reçu ${start.status} ${start.text.slice(0, 120)})`,
    ).toBe(302)
    return this.flowFrom(start, start.location as URL)
  }

  /** Construit un `Flow` depuis une URL d'autorisation (redirection de `/start` ou corps de `POST /link`). */
  flowFrom(start: Res, authUrl: URL): Flow {
    const flowCookie = start.cookie(FLOW_COOKIE)
    expect(flowCookie, `cookie ${FLOW_COOKIE} absent`).toBeDefined()
    return {
      start,
      authUrl,
      state: authUrl.searchParams.get('state') ?? '',
      nonce: authUrl.searchParams.get('nonce') ?? '',
      codeChallenge: authUrl.searchParams.get('code_challenge') ?? '',
      flowCookie: flowCookie?.value ?? '',
    }
  }

  /** `POST /oauth/google/link` (liaison depuis la session) : exige 200 et construit le flux. */
  async startLink(
    sessionCookie: string,
    o: { next?: string; ip?: string } = {},
  ): Promise<{ flow: Flow; res: Res }> {
    const res = await this.call('POST', '/v1/auth/oauth/google/link', {
      cookies: { [this.sessionCookieName]: sessionCookie },
      body: o.next === undefined ? {} : { next: o.next },
      ...(o.ip ? { ip: o.ip } : {}),
    })
    expect(
      res.status,
      `POST /oauth/google/link devait répondre 200 (reçu ${res.status} ${res.text.slice(0, 160)})`,
    ).toBe(200)
    return { flow: this.flowFrom(res, new URL(res.json.authorization_url)), res }
  }

  async callback(flow: Flow, code: string | undefined, o: CallbackOpts = {}): Promise<Res> {
    const q = new URLSearchParams()
    if (code !== undefined) q.set('code', code)
    const state = o.state === undefined ? flow.state : o.state
    if (state !== null) q.set('state', state)
    if (o.error) q.set('error', o.error)
    const cookies: Record<string, string> = {}
    const flowCookie = o.flowCookie === undefined ? flow.flowCookie : o.flowCookie
    if (flowCookie !== null) cookies[FLOW_COOKIE] = flowCookie
    if (o.sessionCookie) cookies[this.sessionCookieName] = o.sessionCookie
    Object.assign(cookies, o.extraCookies ?? {})
    return this.call('GET', `/v1/auth/oauth/google/callback?${q}`, {
      cookies,
      ...(o.ip ? { ip: o.ip } : {}),
    })
  }

  /** Démarre un flux (ou reprend `o.flow`), fait émettre un code par le faux Google et rejoue le rappel. */
  async signIn(o: SignInOpts): Promise<SignInResult> {
    const flow =
      o.flow ??
      (await this.start({
        ...(o.next === undefined ? {} : { next: o.next }),
        ...(o.locale === undefined ? {} : { locale: o.locale }),
        ...(o.rememberMe === undefined ? {} : { rememberMe: o.rememberMe }),
        ...(o.ip ? { ip: o.ip } : {}),
      }))
    this.subs.add(o.sub)
    if (o.email) this.emails.add(o.email.toLowerCase())
    const issued = this.fake.grant({
      nonce: flow.nonce,
      codeChallenge: flow.codeChallenge,
      claims: {
        sub: o.sub,
        ...(o.email === undefined ? {} : { email: o.email }),
        email_verified: o.emailVerified ?? true,
        name: o.name ?? 'Awa Nkeng',
        ...(o.hd ? { hd: o.hd } : {}),
        ...o.claims,
      },
      ...(o.fault ? { fault: o.fault } : {}),
      ...(o.token ? { token: o.token } : {}),
    })
    const cb = await this.callback(flow, issued.code, o.callback ?? {})
    return { flow, issued, cb }
  }

  // ── assertions de redirection ──

  expectRedirect(r: Res, pathname: string, query: Record<string, string | null> = {}): void {
    expect(r.status, `statut (corps : ${r.text.slice(0, 160)})`).toBe(302)
    const loc = r.location as URL
    expect(loc.origin).toBe(new URL(APP_URL).origin)
    expect(loc.pathname).toBe(pathname)
    for (const [k, v] of Object.entries(query)) {
      expect(loc.searchParams.get(k), `paramètre ${k}`).toBe(v)
    }
  }

  expectErrorRedirect(
    r: Res,
    code: string,
    o: { pathname?: string; extra?: Record<string, string | null> } = {},
  ): void {
    this.expectRedirect(r, o.pathname ?? '/auth/login', { error: code, ...(o.extra ?? {}) })
    expect(
      r.cookie(this.sessionCookieName),
      'aucun cookie de session sur une erreur',
    ).toBeUndefined()
  }

  expectFlowCookieCleared(r: Res): void {
    const c = r.cookie(FLOW_COOKIE)
    expect(c, `${FLOW_COOKIE} doit être effacé`).toBeDefined()
    expect(c?.attrs.path).toBe(FLOW_COOKIE_PATH)
    const cleared =
      c?.attrs['max-age'] === '0' ||
      (c?.attrs.expires && new Date(String(c.attrs.expires)).getTime() < Date.now())
    expect(cleared, `${FLOW_COOKIE} doit expirer immédiatement : ${c?.raw}`).toBeTruthy()
  }

  // ── comptes ──

  /** Crée un compte e-mail + mot de passe par l'API (`/register`), puis l'active et vérifie l'e-mail côté base si demandé. */
  async makeUser(
    o: {
      prefix?: string
      verified?: boolean
      password?: string
      locale?: string
      email?: string
    } = {},
  ): Promise<TestUser> {
    const email = (o.email ?? this.newEmail(o.prefix ?? 'awa')).toLowerCase()
    this.emails.add(email)
    const password = o.password ?? PASSWORD
    const reg = await this.call('POST', '/v1/auth/register', {
      body: { email, password, full_name: 'Awa Nkeng' },
    })
    expect(reg.status, `register (${reg.text.slice(0, 120)})`).toBe(200)
    const verified = o.verified ?? true
    await this.asAdmin(async (s) => {
      if (verified) {
        await s`UPDATE iam.users SET status = 'active', email_verified_at = now() WHERE email = ${email}`
      }
      if (o.locale) await s`UPDATE iam.users SET locale = ${o.locale} WHERE email = ${email}`
    })
    const row = await this.userByEmail(email)
    return { email, password, id: String(row?.id), publicId: String(row?.public_id) }
  }

  /** Connexion par mot de passe : renvoie la valeur du cookie de session. */
  async login(email: string, password = PASSWORD, ip?: string): Promise<string> {
    const r = await this.call('POST', '/v1/auth/login', {
      body: { email, password, remember_me: true },
      ...(ip ? { ip } : {}),
    })
    expect(r.status, `login (${r.text.slice(0, 120)})`).toBe(200)
    const c = r.cookie(this.sessionCookieName)
    expect(c, 'cookie de session').toBeDefined()
    return c?.value ?? ''
  }

  /** Compte « téléphone seul » (P2.2) : ni e-mail ni mot de passe. Renvoie le cookie de session. */
  async makePhoneUser(): Promise<{ cookie: string; e164: string; userId: string }> {
    const p = uniqueCmPhone()
    this.phones.add(p.e164)
    const ip = uniqueIp()
    const r1 = await this.call('POST', '/v1/auth/phone/request-code', {
      body: { phone: p.national, country: 'CM' },
      ip,
    })
    expect(r1.status, `phone/request-code (${r1.text.slice(0, 120)})`).toBe(200)
    const sim =
      await loadSrc<typeof import('../src/modules/auth/sms/sms.simulated.js')>(
        '../sms/sms.simulated.js',
      )
    const sms = sim.getSimulatedOutbox().filter((m) => m.to === p.e164)
    const last = sms[sms.length - 1]
    const r2 = await this.call('POST', '/v1/auth/phone/verify-code', {
      body: {
        phone: p.national,
        country: 'CM',
        code: extractCode(last?.text ?? ''),
        full_name: 'Awa Tel',
      },
      ip,
    })
    expect(r2.status, `phone/verify-code (${r2.text.slice(0, 120)})`).toBe(200)
    const row = (
      await this.asAdmin((s) => s`SELECT id FROM iam.users WHERE phone_e164 = ${p.e164}`)
    )[0]
    return {
      cookie: r2.cookie(this.sessionCookieName)?.value ?? '',
      e164: p.e164,
      userId: String(row?.id),
    }
  }

  /** Crée un compte par Google (inscription) et renvoie son cookie de session. */
  async makeGoogleUser(
    o: { prefix?: string; sub?: string; email?: string; name?: string } = {},
  ): Promise<{ email: string; sub: string; cookie: string; userId: string; publicId: string }> {
    const email = (o.email ?? this.newEmail(o.prefix ?? 'awa')).toLowerCase()
    const sub = o.sub ?? this.newSub()
    const { cb } = await this.signIn({ sub, email, ...(o.name ? { name: o.name } : {}) })
    expect(cb.status, `inscription Google (${cb.text.slice(0, 120)})`).toBe(302)
    const row = await this.userByEmail(email)
    return {
      email,
      sub,
      cookie: cb.cookie(this.sessionCookieName)?.value ?? '',
      userId: String(row?.id),
      publicId: String(row?.public_id),
    }
  }

  // ── lectures de contrôle en base (pool admin) ──

  userByEmail = async (email: string): Promise<Json | undefined> =>
    (await this.asAdmin((s) => s`SELECT * FROM iam.users WHERE email = ${email.toLowerCase()}`))[0]

  countUsersByEmail = async (email: string): Promise<number> =>
    Number(
      (
        await this.asAdmin(
          (s) => s`SELECT count(*)::int AS n FROM iam.users WHERE email = ${email.toLowerCase()}`,
        )
      )[0]?.n,
    )

  identitiesBySub = async (sub: string): Promise<Json[]> =>
    this.asAdmin(
      (s) =>
        s`SELECT * FROM iam.user_identities WHERE provider = 'google' AND provider_user_id = ${sub}`,
    )

  identitiesOfUser = async (userId: string): Promise<Json[]> =>
    this.asAdmin((s) => s`SELECT * FROM iam.user_identities WHERE user_id = ${userId} ORDER BY id`)

  sessionsOf = async (userId: string): Promise<Json[]> =>
    this.asAdmin((s) => s`SELECT * FROM iam.user_sessions WHERE user_id = ${userId} ORDER BY id`)

  orgsOf = async (userId: string): Promise<Json[]> =>
    this.asAdmin((s) => s`SELECT * FROM iam.organizations WHERE created_by_user_id = ${userId}`)

  /** Vieillit les sessions d'un utilisateur (fraîcheur P-1 : `now() - created_at`). */
  ageSessions = async (userId: string, minutes: number): Promise<void> => {
    await this.asAdmin(
      (s) =>
        s`UPDATE iam.user_sessions SET created_at = now() - make_interval(mins => ${minutes}) WHERE user_id = ${userId}`,
    )
  }

  setStatus = async (email: string, status: 'active' | 'suspended' | 'deleted'): Promise<void> => {
    await this.asAdmin(
      (s) =>
        s`UPDATE iam.users SET status = ${status}, deleted_at = ${status === 'deleted' ? new Date().toISOString() : null}::timestamptz WHERE email = ${email.toLowerCase()}`,
    )
  }

  /** État observable d'un utilisateur (pour prouver « rien n'a changé »). */
  async snapshot(
    userId: string,
  ): Promise<{ sessions: number; identities: string[]; orgs: number }> {
    return {
      sessions: (await this.sessionsOf(userId)).length,
      identities: (await this.identitiesOfUser(userId)).map((i) => String(i.provider_user_id)),
      orgs: (await this.orgsOf(userId)).length,
    }
  }

  // ── e-mails (transport simulé) ──

  /** Attend un e-mail (envoi non bloquant côté application). */
  async waitMail(pred: (m: SentMail) => boolean, timeoutMs = 3000): Promise<SentMail> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const found = mailbox.sent.find(pred)
      if (found) return found
      if (Date.now() > deadline) {
        throw new Error(
          `aucun e-mail attendu reçu en ${timeoutMs} ms (reçus : ${mailbox.sent.map((m) => `${m.to}|${m.subject}`).join(' ; ') || 'aucun'})`,
        )
      }
      await new Promise((r) => setTimeout(r, 25))
    }
  }

  /** Vrai si aucun e-mail correspondant n'arrive pendant `ms` (preuve d'absence). */
  async noMail(pred: (m: SentMail) => boolean, ms = 300): Promise<boolean> {
    await new Promise((r) => setTimeout(r, ms))
    return !mailbox.sent.some(pred)
  }

  /** Jeton d'un lien `…?token=XXX` dans le dernier e-mail adressé à `to` dont le texte contient `needle`. */
  tokenFromMail(to: string, needle: string): string {
    const mails = mailbox.sent.filter(
      (m) => m.to.toLowerCase() === to.toLowerCase() && (m.text ?? '').includes(needle),
    )
    const last = mails[mails.length - 1]
    const m = (last?.text ?? '').match(/token=([A-Za-z0-9_-]+)/)
    if (!m?.[1]) throw new Error(`aucun jeton « ${needle} » dans les e-mails pour ${to}`)
    return m[1]
  }

  // ── Redis ──

  /** Clé Redis `<prefix><empreinte(valeur du cookie)>` si elle existe (empreinte hex ou base64url), sinon `null`. */
  async redisKeyFor(prefix: string, cookieValue: string): Promise<string | null> {
    const digest = createHash('sha256').update(cookieValue).digest()
    for (const d of [digest.toString('hex'), digest.toString('base64url')]) {
      if ((await this.redis.exists(`${prefix}${d}`)) === 1) return `${prefix}${d}`
    }
    return null
  }

  /** Clés qui contiennent la valeur brute (un cookie) : doit toujours être vide (seule l'empreinte est stockée). */
  async redisKeysContaining(raw: string): Promise<string[]> {
    return this.redis.keys(`*${raw}*`)
  }

  /** Clés Redis dont la valeur (chaîne) contient `needle`. */
  async redisValuesContaining(needle: string): Promise<string[]> {
    const hits: string[] = []
    let cursor = '0'
    do {
      const [next, keys] = await this.redis.scan(cursor, 'COUNT', 500)
      cursor = next
      for (const key of keys) {
        try {
          const v = await this.redis.get(key)
          if (v?.includes(needle)) hits.push(key)
        } catch {
          // clé qui n'est pas une chaîne : ignorée
        }
      }
    } while (cursor !== '0')
    return hits
  }

  /** Occurrences d'une valeur dans toutes les colonnes texte, jsonb, citext et bytea du schéma `iam` (CA-21). */
  async iamOccurrences(needle: string): Promise<string[]> {
    const cols = await this.asAdmin(
      (s) => s`SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'iam'
          AND (data_type IN ('text', 'character varying', 'jsonb', 'json', 'bytea') OR udt_name = 'citext')`,
    )
    const hits: string[] = []
    for (const c of cols) {
      const table = `"iam"."${String(c.table_name).replaceAll('"', '""')}"`
      const col = `"${String(c.column_name).replaceAll('"', '""')}"`
      const expr =
        c.data_type === 'bytea'
          ? `position(convert_to($1, 'UTF8') in ${col}) > 0`
          : `position($1 in ${col}::text) > 0`
      const rows = await this.asAdmin((s) =>
        s.unsafe(`SELECT count(*)::int AS n FROM ${table} WHERE ${expr}`, [needle]),
      )
      if (Number(rows[0]?.n) > 0) hits.push(`${c.table_name}.${c.column_name}`)
    }
    return hits
  }
}
