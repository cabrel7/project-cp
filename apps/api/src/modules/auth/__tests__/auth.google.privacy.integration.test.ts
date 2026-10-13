/**
 * P2.3 — jetons jamais conservés (CA-21) et journaux sans PII (CA-22) : INTÉGRATION PostgreSQL réel + Redis réel +
 * faux Google (MSW). Les parcours CA-6, CA-8, CA-12, CA-15 puis les chemins d'erreur sont rejoués avec des valeurs
 * uniques ; on cherche ensuite chaque valeur émise par le faux Google dans TOUTES les colonnes texte/jsonb/bytea de
 * `iam.*`, dans TOUTES les valeurs Redis et dans TOUTES les lignes pino capturées.
 * Phase RED : routes absentes.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleHarness, LINK_COOKIE, probeInfra } from '../../../../test/google-harness.js'
import { logCapture, parsedLogs } from './google-test-mocks.js'

vi.mock('nodemailer', async () => (await import('./google-test-mocks.js')).nodemailerMockModule())
vi.mock('pino', async (original) =>
  (await import('./google-test-mocks.js')).pinoCaptureModule(await original()),
)

const hasInfra = await probeInfra()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe.skipIf(!hasInfra)(
  'Confidentialité Google (PostgreSQL réel + Redis réel)',
  { timeout: 60_000 },
  () => {
    const h = new GoogleHarness()
    beforeAll(() => h.setup({ logLevel: 'debug' }))
    afterAll(() => h.teardown())
    beforeEach(() => h.beforeEach())
    afterEach(() => h.afterEach())

    const S = () => h.sessionCookieName

    /** Rejoue les parcours nominaux et d'erreur ; renvoie les valeurs sensibles à chercher. */
    async function replayAll() {
      logCapture.lines.length = 0
      const secrets = new Set<string>()
      const addIssued = () => {
        for (const t of h.fake.issued) {
          for (const v of [
            t.accessToken,
            t.refreshToken,
            t.idToken,
            t.idTokenSignature,
            t.code,
            t.spec.nonce,
          ])
            secrets.add(v)
        }
        for (const c of h.fake.tokenCalls) if (c.codeVerifier) secrets.add(c.codeVerifier)
      }
      const flows: string[] = []
      const people: { email: string; sub: string; publicId?: string }[] = []

      // CA-6 inscription, CA-8 connexion
      const g = await h.makeGoogleUser({ prefix: 'priv' })
      people.push({ email: g.email, sub: g.sub, publicId: g.publicId })
      const login = await h.signIn({ sub: g.sub, email: g.email })
      flows.push(login.flow.flowCookie, login.flow.state)
      secrets.add(login.flow.state)
      secrets.add(login.flow.flowCookie)
      secrets.add(g.cookie)

      // CA-12 liaison en attente + confirm
      const a = await h.makeUser({ prefix: 'privuser' })
      const psub = h.newSub()
      const pend = await h.signIn({ sub: psub, email: a.email })
      const linkCookie = pend.cb.cookie(LINK_COOKIE)?.value ?? ''
      secrets.add(linkCookie)
      await sleep(25)
      const session = await h.login(a.email)
      secrets.add(session)
      await h.call('GET', '/v1/auth/link/pending', {
        cookies: { [S()]: session, [LINK_COOKIE]: linkCookie },
      })
      await h.call('POST', '/v1/auth/link/confirm', {
        cookies: { [S()]: session, [LINK_COOKIE]: linkCookie },
      })
      people.push({ email: a.email, sub: psub })

      // CA-15 liaison depuis la session, puis déliaison
      const b = await h.makeUser({ prefix: 'privlink' })
      const bs = await h.login(b.email)
      secrets.add(bs)
      const { flow } = await h.startLink(bs, { next: '/account/security' })
      const bsub = h.newSub()
      const bmail = h.newEmail('privpro')
      await h.signIn({ flow, sub: bsub, email: bmail, callback: { sessionCookie: bs } })
      people.push({ email: b.email, sub: bsub }, { email: bmail, sub: bsub })
      await h.call('DELETE', '/v1/auth/identities/google', { cookies: { [S()]: bs } })
      await h.call('DELETE', '/v1/auth/identities/google', { cookies: { [S()]: bs } }) // 404

      // erreurs : state, id_token falsifié, e-mail sans autorité, fournisseur en panne, dernier moyen
      const e1 = h.newEmail('priverr')
      const s1 = h.newSub()
      const f1 = await h.start()
      await h.signIn({ flow: f1, sub: s1, email: e1, callback: { state: 'wrong-state-value' } })
      const s2 = h.newSub()
      const e2 = h.newEmail('priverr')
      await h.signIn({ sub: s2, email: e2, fault: 'wrong_nonce' })
      const s3 = h.newSub()
      const e3 = `priv.${h.uniq()}@yahoo.fr`
      await h.signIn({ sub: s3, email: e3 })
      const s4 = h.newSub()
      const e4 = h.newEmail('priverr')
      await h.signIn({ sub: s4, email: e4, token: { kind: 'status', status: 503 } })
      const s5 = h.newSub()
      const e5 = h.newEmail('priverr')
      await h.signIn({ sub: s5, email: e5, token: { kind: 'invalid_grant' } })
      await h.call('DELETE', '/v1/auth/identities/google', { cookies: { [S()]: g.cookie } }) // dernier moyen
      people.push(
        { email: e1, sub: s1 },
        { email: e2, sub: s2 },
        { email: e3, sub: s3 },
        { email: e4, sub: s4 },
        { email: e5, sub: s5 },
      )
      addIssued()
      await sleep(300)
      return { secrets: [...secrets].filter(Boolean), people, g, flows }
    }

    it('[OBLIGATOIRE] CA-21 : aucun jeton, code, code_verifier ni nonce du faux Google dans iam.* ni dans Redis ; profile = {}', async () => {
      const { secrets, g } = await replayAll()
      expect(secrets.length).toBeGreaterThan(20)
      for (const secret of secrets) {
        expect(await h.iamOccurrences(secret), `iam contient ${secret.slice(0, 12)}…`).toEqual([])
        expect(
          await h.redisValuesContaining(secret),
          `Redis contient ${secret.slice(0, 12)}…`,
        ).toEqual([])
      }
      const profiles = await h.asAdmin(
        (s) => s`SELECT profile FROM iam.user_identities WHERE provider_user_id = ${g.sub}`,
      )
      for (const row of profiles) expect(row.profile).toEqual({})
    })

    it('[OBLIGATOIRE] CA-22 : aucune ligne de journal ne contient code, state, nonce, code_verifier, jeton, e-mail, sub ni valeur de cookie', async () => {
      const { secrets, people } = await replayAll()
      const all = logCapture.lines.join('\n')
      expect(all.length).toBeGreaterThan(0)
      const forbidden = [...secrets]
      for (const p of people) {
        forbidden.push(p.email, p.sub)
        forbidden.push(encodeURIComponent(p.email), p.email.toUpperCase())
      }
      for (const needle of forbidden) {
        expect(all.includes(needle), `le journal contient ${needle.slice(0, 14)}…`).toBe(false)
      }
      expect(all).not.toMatch(/[A-Za-z0-9._%+-]+@gmail\.com/i)
      expect(all).not.toMatch(/(code|state|nonce|code_verifier)=/)
    })

    it('CA-22 : les lignes « request completed » du rappel n’ont que le chemin (sans requête)', async () => {
      await replayAll()
      const completed = parsedLogs().filter(
        (l) => l.msg === 'request completed' && String(l.path).includes('/oauth/google/callback'),
      )
      expect(completed.length).toBeGreaterThan(0)
      for (const l of completed) expect(l.path).toBe('/v1/auth/oauth/google/callback')
    })

    it('CA-22 : lignes security_event pour google_signup, identity_linked, identity_unlinked avec le public_id seulement', async () => {
      const { g } = await replayAll()
      const events = parsedLogs().filter((l) => l.msg === 'security_event' || 'security_event' in l)
      const names = new Set(events.map((l) => l.event))
      for (const name of ['google_signup', 'identity_linked', 'identity_unlinked']) {
        expect(names.has(name), `security_event ${name}`).toBe(true)
      }
      const signup = events.find((l) => l.event === 'google_signup' && l.user === g.publicId)
      expect(signup, 'google_signup avec le public_id de l’utilisateur').toBeDefined()
      expect(signup?.provider).toBe('google')
      for (const l of events) {
        expect(l.user).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        expect(l).not.toHaveProperty('email')
        expect(l).not.toHaveProperty('sub')
      }
    })
  },
)
