/**
 * Vérification de l'`id_token` Google (P2.3, spec §3.3 étape 5) et règle P-2 « Google fait autorité sur l'adresse ».
 *
 * `arctic` DÉCODE l'`id_token` sans vérifier sa signature : la vérification est faite ici avec `jose` et le JWKS de Google
 * (algorithme RS256 figé, `iss`, `aud`, `exp`, `iat`, `nonce`, `sub`). Aucun jeton n'est conservé ni journalisé.
 */
import { timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, errors, type JWTPayload, jwtVerify } from 'jose'
import { AppError } from '../../../lib/errors.js'

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const JWKS_TIMEOUT_MS = 5000
/** Tolérance d'horloge (secondes) sur `exp` et `iat`. */
const CLOCK_TOLERANCE_S = 60
const MAX_SUB_LENGTH = 255
const MAX_EMAIL_LENGTH = 254
const GOOGLE_MAIL_DOMAINS: ReadonlySet<string> = new Set(['gmail.com', 'googlemail.com'])

export type GoogleIdTokenClaims = JWTPayload & {
  sub: string
  email?: unknown
  email_verified?: unknown
  hd?: unknown
  name?: unknown
}

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>
let jwks: RemoteJwks | undefined

function getJwks(): RemoteJwks {
  jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), { timeoutDuration: JWKS_TIMEOUT_MS })
  return jwks
}

/** Vide le cache du JWKS (tests : `resetGoogleForTests`). */
export function resetGoogleJwksForTests(): void {
  jwks = undefined
}

/** Codes `jose` qui désignent un jeton invalide (par opposition à un JWKS ou un réseau défaillant). */
const INVALID_TOKEN_CODES: ReadonlySet<string> = new Set([
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JWK_INVALID',
])

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Vérifie signature, émetteur, audience, expiration, `iat`, `nonce` et `sub`.
 * Jeton invalide → `AUTH_SOCIAL_FLOW_INVALID` ; JWKS injoignable ou réponse du fournisseur inexploitable →
 * `AUTH_SOCIAL_PROVIDER_UNAVAILABLE`. Aucune cause n'est attachée à l'erreur (elle pourrait recopier le jeton).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
): Promise<GoogleIdTokenClaims> {
  let payload: JWTPayload
  try {
    const verified = await jwtVerify(idToken, getJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: expected.clientId,
      algorithms: ['RS256'],
      clockTolerance: CLOCK_TOLERANCE_S,
      requiredClaims: ['exp', 'iat', 'sub'],
    })
    payload = verified.payload
  } catch (err) {
    const code = err instanceof errors.JOSEError ? err.code : undefined
    if (code !== undefined && INVALID_TOKEN_CODES.has(code)) {
      throw new AppError('AUTH_SOCIAL_FLOW_INVALID', { reason: 'id_token_invalid' })
    }
    throw new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'unavailable' })
  }

  const { sub, nonce, iat } = payload
  const nowSeconds = Math.floor(Date.now() / 1000)
  const valid =
    typeof sub === 'string' &&
    sub.length >= 1 &&
    sub.length <= MAX_SUB_LENGTH &&
    typeof nonce === 'string' &&
    constantTimeEquals(nonce, expected.nonce) &&
    typeof iat === 'number' &&
    iat <= nowSeconds + CLOCK_TOLERANCE_S
  if (!valid) throw new AppError('AUTH_SOCIAL_FLOW_INVALID', { reason: 'id_token_invalid' })
  return payload as GoogleIdTokenClaims
}

export type GoogleEmailDecision = { ok: true; email: string } | { ok: false }

/**
 * Règle P-2 : `email_verified` (booléen ou la chaîne « true ») ne suffit PAS, car pour une adresse tierce un tiers peut
 * avoir créé un compte Google avec l'adresse d'autrui. On accepte l'e-mail seulement si Google fait autorité sur le
 * domaine : Gmail (`gmail.com`, `googlemail.com`) ou Google Workspace (`hd` non vide égal au domaine de l'adresse).
 * Fonction pure, volontairement isolée pour être assouplie facilement. L'e-mail accepté est normalisé en minuscules.
 */
export function evaluateGoogleEmail(claims: {
  email?: unknown
  email_verified?: unknown
  hd?: unknown
}): GoogleEmailDecision {
  const { email, email_verified: verified, hd } = claims
  if (verified !== true && verified !== 'true') return { ok: false }
  if (typeof email !== 'string' || email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false }
  }
  const parts = email.split('@')
  const [local, domainRaw] = parts
  if (parts.length !== 2 || !local || !domainRaw) return { ok: false }
  const domain = domainRaw.toLowerCase()
  const authority =
    GOOGLE_MAIL_DOMAINS.has(domain) ||
    (typeof hd === 'string' && hd.length > 0 && hd.toLowerCase() === domain)
  return authority ? { ok: true, email: email.toLowerCase() } : { ok: false }
}
