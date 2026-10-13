/**
 * P2.3 — vérification de l'`id_token` Google (CA-10 partie U, CA-19 partie JWKS).
 * Règle (spec §3.3 étape 5) : `arctic` DÉCODE sans vérifier ; la vérification est faite par `jose` avec le JWKS de
 * Google : signature RS256 seulement (algorithmes figés), `iss`, `aud`, `exp` (tolérance 60 s), `iat` ≤ now + 60 s,
 * `nonce` égal, `sub` chaîne de 1 à 255 caractères. Tout défaut → AUTH_SOCIAL_FLOW_INVALID ; JWKS injoignable →
 * AUTH_SOCIAL_PROVIDER_UNAVAILABLE.
 *
 * Unitaire : seul le point HTTP du JWKS est simulé (faux Google MSW) ; clés RSA générées par le faux.
 * Phase RED : `oauth/google.id-token.ts` n'existe pas (import dynamique, un échec par test).
 *
 * CONTRAT : `verifyGoogleIdToken(idToken, { clientId, nonce })` → claims vérifiés (noms bruts : sub, email, …) ou rejette
 * une erreur dont `.code` vaut le code du catalogue (comparer par `code`, jamais par `instanceof` : ISSUES.log).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FakeGoogle, ID_TOKEN_FAULTS, type IdTokenFault, randomB64url } from './fake-google.js'
import { loadSrc } from './phone-test-utils.js'

type IdTokenModule = typeof import('../oauth/google.id-token.js')
const idTokenModule = () => loadSrc<IdTokenModule>('../oauth/google.id-token.js')

const fake = new FakeGoogle()
const NONCE = `nonce-${randomB64url(24)}`

beforeAll(() => fake.start())
afterAll(() => fake.stop())
beforeEach(async () => {
  fake.reset()
  fake.expectedRedirectUri = undefined
  try {
    ;(await idTokenModule()).resetGoogleJwksForTests()
  } catch {
    // module absent (phase RED) : le test échouera lui-même sur l'import
  }
})

async function verify(token: string, nonce = NONCE) {
  const { verifyGoogleIdToken } = await idTokenModule()
  return verifyGoogleIdToken(token, { clientId: fake.clientId, nonce })
}

async function errorCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
  } catch (err) {
    return (err as { code?: string }).code ?? `non-AppError:${(err as Error).message}`
  }
  return undefined
}

describe('verifyGoogleIdToken — jeton valide', () => {
  it('doit accepter un id_token RS256 correct et renvoyer les claims vérifiés', async () => {
    const token = fake.buildIdToken({
      nonce: NONCE,
      claims: { sub: 'G-valid-1', email: 'awa@gmail.com', name: 'Awa' },
    })
    const claims = (await verify(token)) as Record<string, unknown>
    expect(claims.sub).toBe('G-valid-1')
    expect(claims.email).toBe('awa@gmail.com')
    expect(fake.unhandled).toEqual([])
  })

  it('doit accepter les deux formes d’émetteur de Google (avec et sans https://)', async () => {
    for (const iss of ['https://accounts.google.com', 'accounts.google.com']) {
      const token = fake.buildIdToken({ nonce: NONCE, claims: { iss } })
      await expect(verify(token), iss).resolves.toBeDefined()
    }
  })

  it('doit tolérer 60 s d’écart d’horloge sur exp (expiré depuis 30 s : accepté)', async () => {
    const t = Math.floor(Date.now() / 1000)
    const token = fake.buildIdToken({ nonce: NONCE, claims: { iat: t - 3600, exp: t - 30 } })
    await expect(verify(token)).resolves.toBeDefined()
  })

  it('doit tolérer un iat jusqu’à 60 s dans le futur (+30 s : accepté)', async () => {
    const t = Math.floor(Date.now() / 1000)
    const token = fake.buildIdToken({ nonce: NONCE, claims: { iat: t + 30, exp: t + 3600 } })
    await expect(verify(token)).resolves.toBeDefined()
  })

  it('doit accepter un sub de 255 caractères (borne haute)', async () => {
    const token = fake.buildIdToken({ nonce: NONCE, claims: { sub: 's'.repeat(255) } })
    await expect(verify(token)).resolves.toBeDefined()
  })
})

describe('verifyGoogleIdToken — jetons falsifiés rejetés (CA-10)', () => {
  it.each(ID_TOKEN_FAULTS.map((f) => [f]))(
    'doit rejeter le défaut « %s » avec AUTH_SOCIAL_FLOW_INVALID',
    async (fault) => {
      const token = fake.buildIdToken({ nonce: NONCE, fault: fault as IdTokenFault })
      expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
    },
  )

  it('doit rejeter un nonce différent de celui du flux (rejeu d’un id_token d’un autre flux)', async () => {
    const token = fake.buildIdToken({ nonce: 'nonce-of-another-flow' })
    expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })

  it('doit rejeter un id_token sans nonce', async () => {
    const token = fake.buildIdToken({ claims: { nonce: undefined } })
    expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })

  it('doit rejeter un exp expiré depuis plus de 60 s (120 s)', async () => {
    const t = Math.floor(Date.now() / 1000)
    const token = fake.buildIdToken({ nonce: NONCE, claims: { iat: t - 3600, exp: t - 120 } })
    expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })

  it.each([
    ['vide', ''],
    ['un sub de 256 caractères', 's'.repeat(256)],
    ['un sub non textuel (nombre)', 12345],
    ['un sub non textuel (objet)', { a: 1 }],
  ])('doit rejeter %s comme sub', async (_label, sub) => {
    const token = fake.buildIdToken({ nonce: NONCE, claims: { sub: sub as never } })
    expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })

  it.each([
    ['pas un JWT', 'abc'],
    ['vide', ''],
    ['deux segments', 'aaa.bbb'],
    ['segments non base64', '%%%.%%%.%%%'],
  ])('doit rejeter une chaîne qui n’est %s', async (_label, token) => {
    expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })

  it('doit rejeter une audience correcte mais un autre client_id demandé', async () => {
    const token = fake.buildIdToken({ nonce: NONCE })
    const { verifyGoogleIdToken } = await idTokenModule()
    const code = await errorCodeOf(
      verifyGoogleIdToken(token, { clientId: 'other.apps.googleusercontent.com', nonce: NONCE }),
    )
    expect(code).toBe('AUTH_SOCIAL_FLOW_INVALID')
  })
})

describe('verifyGoogleIdToken — JWKS de Google (CA-19)', () => {
  it('doit mettre le JWKS en cache : deux vérifications = un seul appel au JWKS', async () => {
    const token = fake.buildIdToken({ nonce: NONCE })
    await verify(token)
    await verify(fake.buildIdToken({ nonce: NONCE }))
    expect(fake.jwksCalls).toBe(1)
  })

  it.each([
    ['503', { kind: 'status', status: 503 } as const],
    ['500', { kind: 'status', status: 500 } as const],
    ['erreur réseau', { kind: 'network_error' } as const],
  ])(
    'doit répondre AUTH_SOCIAL_PROVIDER_UNAVAILABLE quand le JWKS est injoignable (%s), sans jamais valider',
    async (_label, behavior) => {
      fake.jwks = behavior
      const token = fake.buildIdToken({ nonce: NONCE })
      expect(await errorCodeOf(verify(token))).toBe('AUTH_SOCIAL_PROVIDER_UNAVAILABLE')
    },
  )

  it('doit accepter à nouveau dès que le JWKS est de retour (pas de panne mémorisée)', async () => {
    fake.jwks = { kind: 'status', status: 503 }
    await errorCodeOf(verify(fake.buildIdToken({ nonce: NONCE })))
    ;(await idTokenModule()).resetGoogleJwksForTests()
    fake.jwks = { kind: 'ok' }
    await expect(verify(fake.buildIdToken({ nonce: NONCE }))).resolves.toBeDefined()
  })
})
