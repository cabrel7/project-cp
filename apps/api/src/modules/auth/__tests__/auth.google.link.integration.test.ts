/**
 * P2.3 — liaison, déliaison, pre-hijacking, concurrence, /me additif, alertes : INTÉGRATION PostgreSQL réel + Redis réel
 * + faux Google (MSW). Règles : spec P2.3 CA-12 à CA-18, CA-23, CA-24, P-1 (fraîcheur de session), D67 (jamais de
 * rattachement automatique). Chaque scénario crée DEUX utilisateurs (A et B, deux organisations) pour prouver l'isolation.
 * Aucun mock du repository/SQL/Redis/verrous ; SMTP et pino simulés (frontières). Phase RED : routes absentes.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_URL,
  GoogleHarness,
  LINK_COOKIE,
  LINK_COOKIE_PATH,
  PASSWORD,
  probeInfra,
  type Res,
} from '../../../../test/google-harness.js'
import { mailbox } from './google-test-mocks.js'

vi.mock('nodemailer', async () => (await import('./google-test-mocks.js')).nodemailerMockModule())
vi.mock('pino', async (original) =>
  (await import('./google-test-mocks.js')).pinoCaptureModule(await original()),
)

const hasInfra = await probeInfra()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|\+00:00)$/

describe.skipIf(!hasInfra)(
  'Liaison Google (PostgreSQL réel + Redis réel)',
  { timeout: 40_000 },
  () => {
    const h = new GoogleHarness()
    beforeAll(() => h.setup())
    afterAll(() => h.teardown())
    beforeEach(() => h.beforeEach())
    afterEach(() => h.afterEach())

    const S = () => h.sessionCookieName
    const as = (cookie: string, extra: Record<string, string> = {}) => ({ [S()]: cookie, ...extra })

    /** Rappel Google d'une identité inconnue portant l'e-mail du compte : doit produire une liaison en attente. */
    async function pending(email: string, sub = h.newSub()) {
      const r = await h.signIn({ sub, email: email.replace(/^./, (c) => c.toUpperCase()) })
      const link = r.cb.cookie(LINK_COOKIE)
      return { ...r, sub, linkCookie: link?.value ?? '' }
    }
    const getPending = (session: string, link: string) =>
      h.call('GET', '/v1/auth/link/pending', { cookies: as(session, { [LINK_COOKIE]: link }) })
    const confirm = (session: string, link: string, headers: Record<string, string> = {}) =>
      h.call('POST', '/v1/auth/link/confirm', {
        cookies: as(session, { [LINK_COOKIE]: link }),
        headers,
      })
    const unlink = (session: string, provider = 'google') =>
      h.call('DELETE', `/v1/auth/identities/${provider}`, { cookies: as(session) })
    const errCode = (r: Res) => r.json?.error?.code

    /** A (mot de passe) lié à Google via le chemin « depuis la session ». */
    async function userWithGoogle(prefix = 'awa') {
      const a = await h.makeUser({ prefix })
      const session = await h.login(a.email)
      const sub = h.newSub()
      const { flow } = await h.startLink(session, { next: '/account/security' })
      const { cb } = await h.signIn({
        flow,
        sub,
        email: h.newEmail('pro'),
        callback: { sessionCookie: session },
        next: '/account/security',
      })
      h.expectRedirect(cb, '/account/security', { linked: 'google' })
      return { a, session, sub }
    }

    // ── CA-12 ──
    describe('liaison en attente (CA-12)', () => {
      it('[OBLIGATOIRE] pas de rattachement automatique : e-mail connu → liaison en attente, rien d’écrit (critère en base)', async () => {
        const a = await h.makeUser({ prefix: 'awa' })
        const before = await h.snapshot(a.id)
        const sub = h.newSub()
        const { cb } = await h.signIn({ sub, email: a.email.replace(/^./, (c) => c.toUpperCase()) })
        h.expectRedirect(cb, '/auth/login', { link: 'google' })
        const link = cb.cookie(LINK_COOKIE)
        expect(link?.attrs.httponly).toBe(true)
        expect(String(link?.attrs.samesite).toLowerCase()).toBe('lax')
        expect(link?.attrs.path).toBe(LINK_COOKIE_PATH)
        expect(link?.attrs['max-age']).toBe('600')
        expect(cb.cookie(S()), 'aucune session ouverte').toBeUndefined()
        expect(await h.identitiesBySub(sub)).toHaveLength(0)
        expect(await h.snapshot(a.id)).toEqual(before)
        expect(await h.countUsersByEmail(a.email)).toBe(1)
        const key = await h.redisKeyFor('auth:oauth:link:', link?.value ?? '')
        expect(key, 'clé Redis de liaison en attente').not.toBeNull()
        expect(await h.redis.ttl(key as string)).toBeLessThanOrEqual(600)
        expect(await h.redisKeysContaining(link?.value ?? '')).toEqual([])
      })

      it('[OBLIGATOIRE] sans confirmation, après expiration, rien n’est rattaché', async () => {
        const a = await h.makeUser()
        const p = await pending(a.email)
        const key = await h.redisKeyFor('auth:oauth:link:', p.linkCookie)
        await h.redis.pexpire(key as string, 20)
        await sleep(120)
        await sleep(15)
        const session = await h.login(a.email)
        expect((await getPending(session, p.linkCookie)).status).toBe(404)
        expect((await confirm(session, p.linkCookie)).status).toBe(404)
        expect(await h.identitiesBySub(p.sub)).toHaveLength(0)
      })

      it('[OBLIGATOIRE] suite nominale : connexion après la liaison, GET pending, confirm 204, identité rattachée, alerte e-mail, reconnexion Google', async () => {
        const a = await h.makeUser({ prefix: 'awa' })
        const p = await pending(a.email)
        await sleep(25)
        const session = await h.login(a.email)

        const g = await getPending(session, p.linkCookie)
        expect(g.status).toBe(200)
        expect(g.json).toEqual({
          provider: 'google',
          email_masked: `a***@${a.email.split('@')[1]}`,
        })

        const c = await confirm(session, p.linkCookie)
        expect(c.status).toBe(204)
        const cleared = c.cookie(LINK_COOKIE)
        expect(cleared?.attrs.path).toBe(LINK_COOKIE_PATH)
        expect(cleared?.attrs['max-age'] === '0' || cleared?.attrs.expires !== undefined).toBe(true)

        const ids = await h.identitiesOfUser(a.id)
        expect(ids.map((i) => i.provider_user_id)).toEqual([p.sub])
        expect(await h.redisKeyFor('auth:oauth:link:', p.linkCookie)).toBeNull()
        const mail = await h.waitMail(
          (m) => m.to.toLowerCase() === a.email && /google/i.test(`${m.subject}${m.text}`),
        )
        expect(mail.text).toContain(`${APP_URL}/account/security`)

        const again = await h.signIn({ sub: p.sub, email: a.email })
        h.expectRedirect(again.cb, '/')
        expect(again.cb.cookie(S())).toBeDefined()
        expect(await h.identitiesBySub(p.sub)).toHaveLength(1)
      })
    })

    // ── CA-13 ──
    describe('conditions de confirmation et isolation (CA-13)', () => {
      it('B connecté (autre organisation) avec le cp_link de A : 404 sur GET et POST, la liaison de A reste intacte', async () => {
        const a = await h.makeUser()
        const b = await h.makeUser({ prefix: 'bob' })
        const sessionB = await h.login(b.email) // session de B créée AVANT la liaison en attente
        const p = await pending(a.email)
        expect((await getPending(sessionB, p.linkCookie)).status).toBe(404)
        expect((await confirm(sessionB, p.linkCookie)).status).toBe(404)
        const sessionB2 = await h.login(b.email) // et APRÈS
        expect((await getPending(sessionB2, p.linkCookie)).status).toBe(404)
        expect((await confirm(sessionB2, p.linkCookie)).status).toBe(404)
        expect(await h.identitiesBySub(p.sub)).toHaveLength(0)
        expect(await h.identitiesOfUser(b.id)).toHaveLength(0)
        const sessionA = await h.login(a.email)
        expect((await getPending(sessionA, p.linkCookie)).status).toBe(200)
      })

      it('session de A créée avant la liaison en attente : confirm → 403 AUTH_REAUTH_REQUIRED (login_before_link), GET toujours 200', async () => {
        const a = await h.makeUser()
        const old = await h.login(a.email)
        await sleep(25)
        const p = await pending(a.email)
        const r = await confirm(old, p.linkCookie)
        expect(r.status).toBe(403)
        expect(errCode(r)).toBe('AUTH_REAUTH_REQUIRED')
        expect(r.json.error.details.reason).toBe('login_before_link')
        expect((await getPending(old, p.linkCookie)).status).toBe(200)
        expect(await h.identitiesBySub(p.sub)).toHaveLength(0)
      })

      it('confirm rejoué après succès → 404 ; sans cookie cp_link → 404 ; sans session → 401', async () => {
        const a = await h.makeUser()
        const p = await pending(a.email)
        await sleep(25)
        const session = await h.login(a.email)
        expect((await confirm(session, p.linkCookie)).status).toBe(204)
        expect((await confirm(session, p.linkCookie)).status).toBe(404)
        const r = await h.call('POST', '/v1/auth/link/confirm', { cookies: as(session) })
        expect(r.status).toBe(404)
        const anon = await h.call('POST', '/v1/auth/link/confirm', {
          cookies: { [LINK_COOKIE]: p.linkCookie },
        })
        expect(anon.status).toBe(401)
        expect(
          (
            await h.call('GET', '/v1/auth/link/pending', {
              cookies: { [LINK_COOKIE]: p.linkCookie },
            })
          ).status,
        ).toBe(401)
      })

      it('Origin étrangère sur POST /link/confirm → 403 (CSRF) ; l’origine APP_URL passe', async () => {
        const a = await h.makeUser()
        const p = await pending(a.email)
        await sleep(25)
        const session = await h.login(a.email)
        const bad = await confirm(session, p.linkCookie, { origin: 'https://evil.example.net' })
        expect(bad.status).toBe(403)
        expect(errCode(bad)).toBe('AUTH_INSUFFICIENT_PERMISSIONS')
        expect(await h.identitiesBySub(p.sub)).toHaveLength(0)
        expect((await confirm(session, p.linkCookie, { origin: APP_URL })).status).toBe(204)
      })
    })

    // ── CA-14 ──
    it('[OBLIGATOIRE] pre-hijacking : un compte pending ne peut ni lier ni confirmer ; la victime reprend la main puis lie (critère en base)', async () => {
      const email = h.newEmail('victim')
      const third = await h.makeUser({ email, verified: false })
      expect((await h.userByEmail(email))?.status).toBe('pending')

      // 2. rappel Google de la victime avec cette adresse : liaison en attente, aucune session sur le compte du tiers
      const vsub = h.newSub()
      const p = await pending(email, vsub)
      expect(p.cb.cookie(S())).toBeUndefined()
      expect(await h.identitiesBySub(vsub)).toHaveLength(0)
      expect(await h.sessionsOf(third.id)).toHaveLength(0)

      // 3. le tiers (pending, session fraîche) ne peut pas lier
      await sleep(25)
      const thirdSession = await h.login(email)
      const link = await h.call('POST', '/v1/auth/oauth/google/link', {
        cookies: as(thirdSession),
        body: {},
      })
      expect(link.status).toBe(403)
      expect(errCode(link)).toBe('AUTH_ACCOUNT_NOT_VERIFIED')
      expect(link.json.error.details.reason).toBe('pending')

      // 4. connecté après la liaison en attente : confirm refusé
      const c = await confirm(thirdSession, p.linkCookie)
      expect(c.status).toBe(403)
      expect(errCode(c)).toBe('AUTH_ACCOUNT_NOT_VERIFIED')
      expect(await h.identitiesBySub(vsub)).toHaveLength(0)

      // 5. la victime réinitialise le mot de passe : sessions du tiers révoquées
      expect((await h.call('POST', '/v1/auth/forgot-password', { body: { email } })).status).toBe(
        200,
      )
      const resetToken = await (async () => {
        await h.waitMail(
          (m) => m.to.toLowerCase() === email && (m.text ?? '').includes('reset-password'),
        )
        return h.tokenFromMail(email, 'reset-password')
      })()
      const newPassword = 'Victim-N3w-P@ssw0rd!'
      expect(
        (
          await h.call('POST', '/v1/auth/reset-password', {
            body: { token: resetToken, password: newPassword },
          })
        ).status,
      ).toBe(200)
      expect((await h.call('GET', '/v1/auth/me', { cookies: as(thirdSession) })).status).toBe(401)

      // 6. la victime se connecte et vérifie son e-mail par lien
      const victimSession = await h.login(email, newPassword)
      expect(
        (await h.call('POST', '/v1/auth/resend-verification', { cookies: as(victimSession) }))
          .status,
      ).toBe(200)
      await h.waitMail(
        (m) => m.to.toLowerCase() === email && (m.text ?? '').includes('verify-email'),
      )
      const verifyToken = h.tokenFromMail(email, 'verify-email')
      expect(
        (await h.call('POST', '/v1/auth/verify-email', { body: { token: verifyToken } })).status,
      ).toBe(200)
      expect((await h.userByEmail(email))?.status).toBe('active')

      // 7. nouveau parcours Google puis confirm → rattachée
      const p2 = await pending(email, vsub)
      await sleep(25)
      const fresh = await h.login(email, newPassword)
      expect((await confirm(fresh, p2.linkCookie)).status).toBe(204)
      expect((await h.identitiesOfUser(third.id)).map((i) => i.provider_user_id)).toEqual([vsub])
    })

    // ── CA-15 / CA-16 ──
    describe('liaison depuis la session (CA-15, CA-16)', () => {
      it('CA-15 nominal : flux « link », rattachement avec un e-mail Google différent, alerte à l’e-mail vérifié de A', async () => {
        const a = await h.makeUser()
        const b = await h.makeUser({ prefix: 'bob' })
        const session = await h.login(a.email)
        const before = await h.snapshot(a.id)
        const { flow, res } = await h.startLink(session, { next: '/account/security' })
        expect(flow.authUrl.origin).toBe('https://accounts.google.com')
        expect(flow.authUrl.searchParams.get('code_challenge_method')).toBe('S256')
        expect(res.cookie('cp_oauth_google')).toBeDefined()
        const sub = h.newSub()
        const other = h.newEmail('awa.pro')
        const { cb } = await h.signIn({
          flow,
          sub,
          email: other,
          callback: { sessionCookie: session },
        })
        h.expectRedirect(cb, '/account/security', { linked: 'google' })
        expect((await h.identitiesOfUser(a.id)).map((i) => i.provider_user_id)).toEqual([sub])
        expect((await h.userByEmail(a.email))?.email).toBe(a.email)
        expect((await h.snapshot(a.id)).sessions).toBe(before.sessions)
        expect(await h.countUsersByEmail(other)).toBe(0)
        expect(await h.identitiesOfUser(b.id)).toHaveLength(0)
        const mail = await h.waitMail((m) => m.to.toLowerCase() === a.email)
        expect(mail.to.toLowerCase()).toBe(a.email)
        expect(await h.noMail((m) => m.to.toLowerCase() === other, 200)).toBe(true)
      })

      const startLink = (session: string, ip?: string) =>
        h.call('POST', '/v1/auth/oauth/google/link', {
          cookies: as(session),
          body: {},
          ...(ip ? { ip } : {}),
        })

      it('CA-16 compte téléphone sans e-mail → 403 AUTH_ACCOUNT_NOT_VERIFIED (email_required)', async () => {
        const p = await h.makePhoneUser()
        const r = await startLink(p.cookie)
        expect(r.status).toBe(403)
        expect(errCode(r)).toBe('AUTH_ACCOUNT_NOT_VERIFIED')
        expect(r.json.error.details.reason).toBe('email_required')
      })

      it('CA-16 compte pending → 403 (pending) ; session de 11 min → 403 AUTH_REAUTH_REQUIRED (recent_login_required, 600) ; 9 min → 200', async () => {
        const pend = await h.makeUser({ verified: false })
        const r1 = await startLink(await h.login(pend.email))
        expect(errCode(r1)).toBe('AUTH_ACCOUNT_NOT_VERIFIED')
        expect(r1.json.error.details.reason).toBe('pending')

        const a = await h.makeUser()
        const session = await h.login(a.email)
        await h.ageSessions(a.id, 11)
        const r2 = await startLink(session)
        expect(r2.status).toBe(403)
        expect(errCode(r2)).toBe('AUTH_REAUTH_REQUIRED')
        expect(r2.json.error.details).toMatchObject({
          reason: 'recent_login_required',
          max_age_seconds: 600,
        })
        await h.ageSessions(a.id, 9)
        expect((await startLink(session)).status).toBe(200)
      })

      it('CA-16 sans session → 401 ; Google non configuré → 503 (not_configured) ; déjà lié → 409 (provider_already_linked)', async () => {
        expect((await h.call('POST', '/v1/auth/oauth/google/link', { body: {} })).status).toBe(401)
        const a = await h.makeUser()
        const session = await h.login(a.email)
        await h.beforeEach({ configured: false })
        const r = await startLink(session)
        expect(r.status).toBe(503)
        expect(errCode(r)).toBe('AUTH_SOCIAL_PROVIDER_UNAVAILABLE')
        expect(r.json.error.details.reason).toBe('not_configured')
        await h.beforeEach()
        const linked = await userWithGoogle()
        const r2 = await startLink(linked.session)
        expect(r2.status).toBe(409)
        expect(errCode(r2)).toBe('AUTH_IDENTITY_ALREADY_LINKED')
        expect(r2.json.error.details.reason).toBe('provider_already_linked')
      })

      it('CA-16 le 11ᵉ appel dans l’heure → 429 avec Retry-After', async () => {
        const a = await h.makeUser()
        const session = await h.login(a.email)
        for (let i = 1; i <= 10; i++)
          expect((await startLink(session)).status, `appel ${i}`).toBe(200)
        const r = await startLink(session)
        expect(r.status).toBe(429)
        expect(Number(r.res.headers.get('retry-after'))).toBeGreaterThan(0)
      })

      it('CA-16 rappel : sub déjà rattaché à B → ?error=AUTH_IDENTITY_ALREADY_LINKED, rien ne change pour A ni B', async () => {
        const b = await userWithGoogle('bob')
        const a = await h.makeUser()
        const session = await h.login(a.email)
        const { flow } = await h.startLink(session, { next: '/account/security' })
        const { cb } = await h.signIn({
          flow,
          sub: b.sub,
          email: h.newEmail(),
          callback: { sessionCookie: session },
        })
        h.expectRedirect(cb, '/account/security', { error: 'AUTH_IDENTITY_ALREADY_LINKED' })
        expect(await h.identitiesOfUser(a.id)).toHaveLength(0)
        expect(await h.identitiesBySub(b.sub)).toHaveLength(1)
        expect(String((await h.identitiesBySub(b.sub))[0]?.user_id)).toBe(b.a.id)
      })

      it('CA-16 rappel : session révoquée entre-temps, ou cookie de session d’un autre utilisateur → AUTH_SOCIAL_FLOW_INVALID, rien rattaché', async () => {
        const a = await h.makeUser()
        const b = await h.makeUser({ prefix: 'bob' })
        const sa = await h.login(a.email)
        const f1 = await h.startLink(sa, { next: '/account/security' })
        expect((await h.call('POST', '/v1/auth/logout', { cookies: as(sa) })).status).toBe(204)
        const sub1 = h.newSub()
        const r1 = await h.signIn({
          flow: f1.flow,
          sub: sub1,
          email: h.newEmail(),
          callback: { sessionCookie: sa },
        })
        h.expectRedirect(r1.cb, '/account/security', { error: 'AUTH_SOCIAL_FLOW_INVALID' })
        expect(await h.identitiesBySub(sub1)).toHaveLength(0)

        const sa2 = await h.login(a.email)
        const sb = await h.login(b.email)
        const f2 = await h.startLink(sa2, { next: '/account/security' })
        const sub2 = h.newSub()
        const r2 = await h.signIn({
          flow: f2.flow,
          sub: sub2,
          email: h.newEmail(),
          callback: { sessionCookie: sb },
        })
        h.expectRedirect(r2.cb, '/account/security', { error: 'AUTH_SOCIAL_FLOW_INVALID' })
        expect(await h.identitiesBySub(sub2)).toHaveLength(0)
        expect(await h.identitiesOfUser(b.id)).toHaveLength(0)
      })
    })

    // ── CA-17 ──
    describe('déliaison (CA-17)', () => {
      it('[OBLIGATOIRE] déliaison : 204, identité supprimée, alerte, puis un rappel avec ce sub redevient une liaison en attente (pas de rattachement automatique)', async () => {
        const { a, session, sub } = await userWithGoogle()
        mailbox.sent.length = 0
        const r = await unlink(session)
        expect(r.status).toBe(204)
        expect(await h.identitiesBySub(sub)).toHaveLength(0)
        await h.waitMail((m) => m.to.toLowerCase() === a.email)
        const again = await h.signIn({ sub, email: a.email })
        h.expectRedirect(again.cb, '/auth/login', { link: 'google' })
        expect(await h.identitiesBySub(sub)).toHaveLength(0)
      })

      it('[OBLIGATOIRE] dernier moyen : compte créé par Google → 409 AUTH_LAST_SIGN_IN_METHOD ; après mot de passe oublié (H5) → 204', async () => {
        const g = await h.makeGoogleUser()
        const r = await unlink(g.cookie)
        expect(r.status).toBe(409)
        expect(errCode(r)).toBe('AUTH_LAST_SIGN_IN_METHOD')
        expect(await h.identitiesBySub(g.sub)).toHaveLength(1)

        await h.call('POST', '/v1/auth/forgot-password', { body: { email: g.email } })
        await h.waitMail(
          (m) => m.to.toLowerCase() === g.email && (m.text ?? '').includes('reset-password'),
        )
        const token = h.tokenFromMail(g.email, 'reset-password')
        expect(
          (await h.call('POST', '/v1/auth/reset-password', { body: { token, password: PASSWORD } }))
            .status,
        ).toBe(200)
        const session = await h.login(g.email)
        expect((await unlink(session)).status).toBe(204)
      })

      it('un numéro vérifié compte comme moyen de connexion : déliaison possible', async () => {
        const g = await h.makeGoogleUser()
        await h.asAdmin(
          (s) =>
            s`UPDATE iam.users SET phone_e164 = ${`+23769${String(Date.now()).slice(-7)}`}, phone_verified_at = now() WHERE id = ${g.userId}`,
        )
        expect((await unlink(g.cookie)).status).toBe(204)
      })

      it('session de plus de 10 min → 403 AUTH_REAUTH_REQUIRED, identité intacte', async () => {
        const { a, session, sub } = await userWithGoogle()
        await h.ageSessions(a.id, 11)
        const r = await unlink(session)
        expect(r.status).toBe(403)
        expect(errCode(r)).toBe('AUTH_REAUTH_REQUIRED')
        expect(await h.identitiesBySub(sub)).toHaveLength(1)
      })

      it('sans identité Google → 404 ; apple/github → 422 ; sans session → 401', async () => {
        const a = await h.makeUser()
        const session = await h.login(a.email)
        expect((await unlink(session)).status).toBe(404)
        expect((await unlink(session, 'apple')).status).toBe(422)
        expect((await unlink(session, 'github')).status).toBe(422)
        expect((await h.call('DELETE', '/v1/auth/identities/google')).status).toBe(401)
      })

      it('B qui appelle la route → 404 pour B ; l’identité de A reste intacte (requête filtrée par l’utilisateur de la session)', async () => {
        const { sub } = await userWithGoogle()
        const b = await h.makeUser({ prefix: 'bob' })
        const r = await unlink(await h.login(b.email))
        expect(r.status).toBe(404)
        expect(await h.identitiesBySub(sub)).toHaveLength(1)
      })
    })

    // ── CA-18 ──
    describe('[OBLIGATOIRE] concurrence (CA-18)', () => {
      it('(a) deux rappels simultanés pour le même nouveau sub : un utilisateur, une organisation, une identité, même session', async () => {
        for (let round = 0; round < 3; round++) {
          const sub = h.newSub()
          const email = h.newEmail()
          const [f1, f2] = [await h.start(), await h.start()]
          const [r1, r2] = await Promise.all([
            h.signIn({ flow: f1, sub, email }),
            h.signIn({ flow: f2, sub, email }),
          ])
          for (const r of [r1, r2]) {
            h.expectRedirect(r.cb, '/')
            expect(r.cb.cookie(S())).toBeDefined()
          }
          expect(await h.countUsersByEmail(email)).toBe(1)
          expect(await h.identitiesBySub(sub)).toHaveLength(1)
          const user = await h.userByEmail(email)
          expect(await h.orgsOf(String(user?.id))).toHaveLength(1)
          const ids = await Promise.all(
            [r1, r2].map(
              async (r) =>
                (await h.call('GET', '/v1/auth/me', { cookies: as(r.cb.cookie(S())?.value ?? '') }))
                  .json.id,
            ),
          )
          expect(ids[0]).toBe(ids[1])
        }
      })

      it('(b) inscription Google et POST /register simultanées sur le même e-mail : un seul utilisateur, aucun 500', async () => {
        for (let round = 0; round < 4; round++) {
          const email = h.newEmail()
          const flow = await h.start()
          const [g, reg] = await Promise.all([
            h.signIn({ flow, sub: h.newSub(), email }),
            h.call('POST', '/v1/auth/register', { body: { email, password: PASSWORD } }),
          ])
          expect(reg.status).toBe(200)
          expect(g.cb.status).toBe(302)
          expect(g.cb.location?.searchParams.get('error')).toBeNull()
          expect(await h.countUsersByEmail(email)).toBe(1)
        }
      })

      it('(c) liaison depuis la session et confirm simultanés : exactement une identité Google, l’autre → AUTH_IDENTITY_ALREADY_LINKED', async () => {
        const a = await h.makeUser()
        const p = await pending(a.email, h.newSub())
        await sleep(25)
        const session = await h.login(a.email)
        const { flow } = await h.startLink(session, { next: '/account/security' })
        const [cb, cf] = await Promise.all([
          h.signIn({
            flow,
            sub: h.newSub(),
            email: h.newEmail('x'),
            callback: { sessionCookie: session },
          }),
          confirm(session, p.linkCookie),
        ])
        expect((await h.identitiesOfUser(a.id)).length).toBe(1)
        const linkWon = cb.cb.location?.searchParams.get('linked') === 'google'
        if (linkWon) {
          expect(cf.status).toBe(409)
          expect(errCode(cf)).toBe('AUTH_IDENTITY_ALREADY_LINKED')
          expect(cf.json.error.details.reason).toBe('provider_already_linked')
        } else {
          expect(cf.status).toBe(204)
          expect(cb.cb.location?.searchParams.get('error')).toBe('AUTH_IDENTITY_ALREADY_LINKED')
        }
      })

      it('(d) deux DELETE /identities/google simultanés : un 204 et un 404', async () => {
        const { session } = await userWithGoogle()
        const rs = await Promise.all([unlink(session), unlink(session)])
        expect(rs.map((r) => r.status).sort()).toEqual([204, 404])
      })

      it('(e) deux confirm simultanés sur la même liaison : un 204 et un 404, une seule identité', async () => {
        const a = await h.makeUser()
        const p = await pending(a.email)
        await sleep(25)
        const session = await h.login(a.email)
        const rs = await Promise.all([
          confirm(session, p.linkCookie),
          confirm(session, p.linkCookie),
        ])
        expect(rs.map((r) => r.status).sort()).toEqual([204, 404])
        expect(await h.identitiesOfUser(a.id)).toHaveLength(1)
      })
    })

    // ── CA-23 ──
    describe('/me additif et isolation (CA-23)', () => {
      it('GET /me de A expose has_password et identities (ISO), ni sub ni id interne ; B ne voit rien de A ; login et phone/verify-code portent les champs', async () => {
        const { a, session, sub } = await userWithGoogle()
        const b = await h.makeUser({ prefix: 'bob' })
        const me = await h.call('GET', '/v1/auth/me', { cookies: as(session) })
        expect(me.status).toBe(200)
        expect(me.json.has_password).toBe(true)
        expect(me.json.identities).toHaveLength(1)
        expect(me.json.identities[0].provider).toBe('google')
        expect(me.json.identities[0].linked_at).toMatch(ISO)
        expect(Object.keys(me.json.identities[0]).sort()).toEqual([
          'email',
          'linked_at',
          'provider',
        ])
        expect(me.text).not.toContain(sub)
        expect(me.json.id).toBe(String((await h.userByEmail(a.email))?.public_id))

        const meB = await h.call('GET', '/v1/auth/me', { cookies: as(await h.login(b.email)) })
        expect(meB.json.identities).toEqual([])
        expect(meB.json.has_password).toBe(true)

        const login = await h.call('POST', '/v1/auth/login', {
          body: { email: a.email, password: PASSWORD, remember_me: true },
        })
        expect(login.json.user.has_password).toBe(true)
        expect(login.json.user.identities).toHaveLength(1)
        const phone = await h.makePhoneUser()
        const meP = await h.call('GET', '/v1/auth/me', { cookies: as(phone.cookie) })
        expect(meP.json.has_password).toBe(false)
        expect(meP.json.identities).toEqual([])
      })
    })

    // ── CA-24 ──
    describe('alertes e-mail (CA-24)', () => {
      it('liaison et déliaison envoient un e-mail FR/EN (langue du compte) avec fournisseur, date, lien /account/security, sans jeton', async () => {
        for (const locale of ['fr', 'en']) {
          const a = await h.makeUser({ locale })
          const session = await h.login(a.email)
          const { flow } = await h.startLink(session, { next: '/account/security' })
          await h.signIn({
            flow,
            sub: h.newSub(),
            email: h.newEmail('x'),
            callback: { sessionCookie: session },
          })
          const linked = await h.waitMail(
            (m) => m.to.toLowerCase() === a.email && /google/i.test(`${m.subject}${m.text}`),
          )
          mailbox.sent.length = 0
          expect((await unlink(session)).status).toBe(204)
          const unlinked = await h.waitMail((m) => m.to.toLowerCase() === a.email)
          for (const m of [linked, unlinked]) {
            const body = `${m.subject}\n${m.text}`
            expect(body).toMatch(/google/i)
            expect(body).toContain(`${APP_URL}/account/security`)
            expect(body).toContain(String(new Date().getFullYear()))
            expect(body).not.toMatch(/token=/i)
            expect(body).toMatch(
              locale === 'fr'
                ? /\b(votre|vous|compte|connexion)\b/i
                : /\b(your|you|account|sign-in|sign in)\b/i,
            )
          }
          expect(linked.subject).not.toBe(unlinked.subject)
        }
      })

      it('un transport SMTP en panne ne fait pas échouer la requête (302/204 inchangés) et l’échec est journalisé sans e-mail', async () => {
        const { parsedLogs } = await import('./google-test-mocks.js')
        const a = await h.makeUser()
        const session = await h.login(a.email)
        mailbox.failing = true
        const { flow } = await h.startLink(session, { next: '/account/security' })
        const { cb } = await h.signIn({
          flow,
          sub: h.newSub(),
          email: h.newEmail('x'),
          callback: { sessionCookie: session },
        })
        h.expectRedirect(cb, '/account/security', { linked: 'google' })
        expect((await unlink(session)).status).toBe(204)
        await sleep(300)
        expect(mailbox.attempts).toBeGreaterThanOrEqual(2)
        const warn = parsedLogs().filter((l) => Number(l.level) >= 40)
        expect(warn.length, 'l’échec d’envoi doit être journalisé (warn ou plus)').toBeGreaterThan(
          0,
        )
        expect(JSON.stringify(warn)).not.toContain(a.email)
      })
    })
  },
)
