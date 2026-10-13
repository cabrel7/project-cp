/**
 * P2.3 — FAUX GOOGLE (helper de test, spec §5.1 « Faux Google »). Pas de test ici : fichier non collecté par vitest.
 *
 * Frontière externe simulée avec MSW (`setupServer`, `onUnhandledRequest: 'error'`) :
 *   - POST https://oauth2.googleapis.com/token           (échange du code d'autorisation)
 *   - GET  https://www.googleapis.com/oauth2/v3/certs    (JWKS des clés publiques de signature)
 * Aucun autre appel sortant n'est toléré : toute requête non prévue FAIT ÉCHOUER la requête de l'application et est
 * enregistrée dans `unhandled`.
 *
 * Comportement fidèle au vrai Google (pour que les tests prouvent des règles, pas des détails d'implémentation) :
 *   - un code d'autorisation n'est utilisable QU'UNE FOIS (rejeu → 400 invalid_grant) ;
 *   - PKCE : si une `code_challenge` est liée au code, l'échange doit présenter le `code_verifier` correspondant
 *     (S256) sinon 400 invalid_grant ; `redirect_uri` doit être identique à celle attendue ;
 *   - identifiants du client (`client_id` / `client_secret`, dans le corps OU en Basic) vérifiés ;
 *   - les réponses d'erreur RECOPIENT le code dans `error_description` (certains fournisseurs le font) : si
 *     l'application journalise la cause d'une erreur Google, le code fuit et CA-22 le détecte ;
 *   - la réponse de succès contient aussi un `refresh_token` (que l'application ne doit JAMAIS conserver, CA-21).
 *
 * Jetons signés en RS256 avec `node:crypto` (aucune dépendance de production requise) ; constructeurs d'`id_token`
 * falsifiés pour CA-10 (nonce, aud, iss, exp, iat, mauvaise clé, kid inconnu, alg none, confusion HS256, sub absent).
 *
 * CONTRAT DE TEST (coutures que le code de production doit fournir ; voir le compte rendu du tester) :
 *   `oauth/google.client.ts`   : setGoogleOAuthConfigForTests({ clientId, clientSecret } | null) ;
 *                                setGoogleTimeoutForTests(ms | null) ; resetGoogleForTests() (config + délai + cache JWKS)
 *   `oauth/google.id-token.ts` : verifyGoogleIdToken(idToken, { clientId, nonce }) ; evaluateGoogleEmail(claims) ;
 *                                resetGoogleJwksForTests()
 */
import {
  createHash,
  createHmac,
  createSign,
  generateKeyPairSync,
  type KeyObject,
  randomBytes,
} from 'node:crypto'
import { delay, HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
export const GOOGLE_AUTH_ORIGIN = 'https://accounts.google.com'
export const GOOGLE_AUTH_PATH = '/o/oauth2/v2/auth'
export const GOOGLE_ISSUER = 'https://accounts.google.com'

export const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url')
export const randomB64url = (bytes = 32): string => randomBytes(bytes).toString('base64url')
/** `code_challenge` PKCE S256 d'un `code_verifier`. */
export const pkceChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url')

export interface IdTokenClaims {
  iss?: string | undefined
  aud?: string | undefined
  sub?: string | undefined
  email?: string | undefined
  email_verified?: boolean | string | number | undefined
  hd?: string | undefined
  name?: string | undefined
  nonce?: string | undefined
  iat?: number | undefined
  exp?: number | undefined
  [claim: string]: unknown
}

/** Défauts d'`id_token` falsifié (CA-10). */
export type IdTokenFault =
  | 'wrong_nonce'
  | 'wrong_aud'
  | 'wrong_iss'
  | 'expired'
  | 'iat_future'
  | 'wrong_signature_key'
  | 'unknown_kid'
  | 'alg_none'
  | 'hs256_with_public_key'
  | 'no_sub'

export const ID_TOKEN_FAULTS: readonly IdTokenFault[] = [
  'wrong_nonce',
  'wrong_aud',
  'wrong_iss',
  'expired',
  'iat_future',
  'wrong_signature_key',
  'unknown_kid',
  'alg_none',
  'hs256_with_public_key',
  'no_sub',
]

/** Comportement du point de jeton pour UN code (CA-19). */
export type TokenEndpointFault =
  | { kind: 'status'; status: number }
  | { kind: 'network_error' }
  | { kind: 'delay'; ms: number }
  | { kind: 'invalid_grant' }

export type JwksBehavior =
  | { kind: 'ok' }
  | { kind: 'status'; status: number }
  | { kind: 'network_error' }

export interface GrantSpec {
  /** `nonce` lu dans l'URL d'autorisation émise par l'application. */
  nonce: string
  /** `code_challenge` lu dans l'URL d'autorisation : lié au code, vérifié à l'échange (PKCE S256). */
  codeChallenge?: string
  claims?: IdTokenClaims
  fault?: IdTokenFault
  token?: TokenEndpointFault
}

export interface IssuedTokens {
  code: string
  accessToken: string
  refreshToken: string
  idToken: string
  /** Troisième segment du JWT : si l'application le stocke, elle stocke le jeton. */
  idTokenSignature: string
  spec: GrantSpec
}

export interface TokenCall {
  grantType: string | null
  code: string | null
  codeVerifier: string | null
  redirectUri: string | null
  clientId: string | null
  clientSecret: string | null
  rawBody: string
  contentType: string | null
}

const nowSec = () => Math.floor(Date.now() / 1000)

export class FakeGoogle {
  readonly clientId = `fake-client-1234567890-abcdef${'.apps.google'}${'usercontent.com'}`
  readonly clientSecret = `${'GOC'}${'SPX'}-fake-client-secret-0123456789`
  readonly kid = 'fake-kid-primary'
  /** `redirect_uri` attendue à l'échange (renseignée par le test : `${APP_URL}/v1/auth/oauth/google/callback`). */
  expectedRedirectUri: string | undefined
  jwks: JwksBehavior = { kind: 'ok' }

  readonly tokenCalls: TokenCall[] = []
  jwksCalls = 0
  readonly unhandled: string[] = []
  readonly issued: IssuedTokens[] = []

  private readonly grants = new Map<string, IssuedTokens>()
  private readonly consumed = new Set<string>()
  private readonly primary = generateKeyPairSync('rsa', { modulusLength: 2048 })
  private readonly rogue = generateKeyPairSync('rsa', { modulusLength: 2048 })
  private readonly server = setupServer(
    http.post(GOOGLE_TOKEN_URL, ({ request }) => this.handleToken(request)),
    http.get(GOOGLE_JWKS_URL, () => this.handleJwks()),
  )

  constructor() {
    this.server.events.on('request:unhandled', ({ request }) => {
      this.unhandled.push(`${request.method} ${request.url}`)
    })
  }

  start(): void {
    this.server.listen({ onUnhandledRequest: 'error' })
  }

  stop(): void {
    this.server.close()
  }

  /** Remet à zéro les espions et les comportements (à appeler dans `beforeEach`). */
  reset(): void {
    this.tokenCalls.length = 0
    this.jwksCalls = 0
    this.unhandled.length = 0
    this.issued.length = 0
    this.grants.clear()
    this.consumed.clear()
    this.jwks = { kind: 'ok' }
  }

  /** Clé publique PEM (pour l'attaque de confusion d'algorithme RS256 → HS256). */
  get publicKeyPem(): string {
    return this.primary.publicKey.export({ type: 'spki', format: 'pem' }) as string
  }

  /** Enregistre un code d'autorisation et les jetons qu'il donnera. Renvoie les jetons (valeurs connues du test). */
  grant(spec: GrantSpec): IssuedTokens {
    const code = `4/0A${randomB64url(30)}`
    const idToken = this.buildIdToken({
      ...(spec.claims ? { claims: spec.claims } : {}),
      nonce: spec.nonce,
      ...(spec.fault ? { fault: spec.fault } : {}),
    })
    const issued: IssuedTokens = {
      code,
      accessToken: `ya29.${randomB64url(40)}`,
      refreshToken: `1//0g${randomB64url(40)}`,
      idToken,
      idTokenSignature: idToken.split('.')[2] ?? '',
      spec,
    }
    this.grants.set(code, issued)
    this.issued.push(issued)
    return issued
  }

  /** Construit un `id_token` signé (RS256) ou falsifié. Utilisable sans passer par un code (tests unitaires). */
  buildIdToken(opts: { claims?: IdTokenClaims; nonce?: string; fault?: IdTokenFault }): string {
    const t = nowSec()
    const claims: IdTokenClaims = {
      iss: GOOGLE_ISSUER,
      aud: this.clientId,
      sub: `sub-${randomB64url(9)}`,
      email: `user.${randomB64url(6).toLowerCase()}@gmail.com`,
      email_verified: true,
      name: 'Awa Nkeng',
      iat: t - 5,
      exp: t + 3600,
      ...(opts.nonce === undefined ? {} : { nonce: opts.nonce }),
      ...opts.claims,
    }
    let key: KeyObject = this.primary.privateKey
    let header: Record<string, unknown> = { alg: 'RS256', typ: 'JWT', kid: this.kid }

    switch (opts.fault) {
      case 'wrong_nonce':
        claims.nonce = `wrong-${randomB64url(24)}`
        break
      case 'wrong_aud':
        claims.aud = 'someone-else-999.apps.googleusercontent.com'
        break
      case 'wrong_iss':
        claims.iss = 'https://evil.example.com'
        break
      case 'expired':
        claims.iat = t - 7200
        claims.exp = t - 3600
        break
      case 'iat_future':
        claims.iat = t + 120
        claims.exp = t + 3600
        break
      case 'wrong_signature_key':
        key = this.rogue.privateKey
        break
      case 'unknown_kid':
        header = { ...header, kid: 'kid-unknown-to-the-jwks' }
        break
      case 'no_sub':
        delete claims.sub
        break
      default:
        break
    }

    if (opts.fault === 'alg_none') {
      header = { alg: 'none', typ: 'JWT' }
      return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}.`
    }
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
    if (opts.fault === 'hs256_with_public_key') {
      const hsHeader = { alg: 'HS256', typ: 'JWT', kid: this.kid }
      const input = `${b64url(JSON.stringify(hsHeader))}.${b64url(JSON.stringify(claims))}`
      const mac = createHmac('sha256', this.publicKeyPem).update(input).digest()
      return `${input}.${b64url(mac)}`
    }
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    return `${signingInput}.${b64url(signer.sign(key))}`
  }

  // ── Points de terminaison simulés ─────────────────────────────────────────────────────────

  private async handleToken(request: Request): Promise<Response> {
    const rawBody = await request.text()
    const form = new URLSearchParams(rawBody)
    const basic = request.headers.get('authorization')
    let clientId = form.get('client_id')
    let clientSecret = form.get('client_secret')
    if (basic?.startsWith('Basic ')) {
      const [id, secret] = Buffer.from(basic.slice(6), 'base64').toString('utf8').split(':')
      clientId = clientId ?? decodeURIComponent(id ?? '')
      clientSecret = clientSecret ?? decodeURIComponent(secret ?? '')
    }
    const call: TokenCall = {
      grantType: form.get('grant_type'),
      code: form.get('code'),
      codeVerifier: form.get('code_verifier'),
      redirectUri: form.get('redirect_uri'),
      clientId,
      clientSecret,
      rawBody,
      contentType: request.headers.get('content-type'),
    }
    this.tokenCalls.push(call)

    const grant = call.code ? this.grants.get(call.code) : undefined
    const echo = call.code ?? ''
    const invalidGrant = (why: string) =>
      HttpResponse.json(
        { error: 'invalid_grant', error_description: `${why} (code=${echo})` },
        { status: 400 },
      )

    const behavior = grant?.spec.token
    if (behavior?.kind === 'network_error') return HttpResponse.error()
    if (behavior?.kind === 'status') {
      return HttpResponse.json(
        { error: 'backend_error', error_description: `upstream failure (code=${echo})` },
        { status: behavior.status },
      )
    }
    if (behavior?.kind === 'delay') await delay(behavior.ms)
    if (behavior?.kind === 'invalid_grant') return invalidGrant('Bad Request')

    if (clientId !== this.clientId || clientSecret !== this.clientSecret) {
      return HttpResponse.json({ error: 'invalid_client' }, { status: 401 })
    }
    if (call.grantType !== 'authorization_code') {
      return HttpResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
    }
    if (!grant || !call.code) return invalidGrant('Malformed auth code.')
    if (this.consumed.has(call.code)) return invalidGrant('Code was already redeemed.')
    this.consumed.add(call.code)

    if (this.expectedRedirectUri !== undefined && call.redirectUri !== this.expectedRedirectUri) {
      return HttpResponse.json(
        { error: 'redirect_uri_mismatch', error_description: `bad redirect (code=${echo})` },
        { status: 400 },
      )
    }
    if (grant.spec.codeChallenge !== undefined) {
      if (!call.codeVerifier || pkceChallenge(call.codeVerifier) !== grant.spec.codeChallenge) {
        return invalidGrant('Missing or wrong code verifier.')
      }
    }

    return HttpResponse.json({
      access_token: grant.accessToken,
      expires_in: 3599,
      refresh_token: grant.refreshToken,
      scope:
        'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      token_type: 'Bearer',
      id_token: grant.idToken,
    })
  }

  private handleJwks(): Response {
    this.jwksCalls += 1
    if (this.jwks.kind === 'network_error') return HttpResponse.error()
    if (this.jwks.kind === 'status') {
      return HttpResponse.json({ error: 'unavailable' }, { status: this.jwks.status })
    }
    const jwk = this.primary.publicKey.export({ format: 'jwk' })
    return HttpResponse.json(
      { keys: [{ ...jwk, kid: this.kid, alg: 'RS256', use: 'sig' }] },
      { headers: { 'cache-control': 'public, max-age=19000, must-revalidate, no-transform' } },
    )
  }
}
