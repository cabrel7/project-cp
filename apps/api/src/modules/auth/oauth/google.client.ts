/**
 * Client Google (P2.3) : configuration effective, URL d'autorisation (PKCE S256) et échange du code via `arctic`.
 *
 * - Aucune relance : un code d'autorisation ne sert qu'une fois (un 5xx ou un délai = indisponible, jamais un nouvel essai).
 * - Délai maximal de 5 s sur l'échange (couture de test : `setGoogleTimeoutForTests`).
 * - Seul l'`id_token` sort de ce module : les jetons d'accès et de rafraîchissement ne sont jamais conservés.
 */
import { Google, OAuth2RequestError } from 'arctic'
import { getEnv } from '../../../env.js'
import { AppError } from '../../../lib/errors.js'
import { resetGoogleJwksForTests } from './google.id-token.js'

const TOKEN_EXCHANGE_TIMEOUT_MS = 5000
const GOOGLE_SCOPES = ['openid', 'email', 'profile']
const CALLBACK_PATH = '/v1/auth/oauth/google/callback'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
}

let configOverride: GoogleOAuthConfig | null | undefined
let timeoutOverride: number | null = null

/** Couture de test : configuration injectée (`null` = Google non configuré), sinon `env`. */
export function setGoogleOAuthConfigForTests(config: GoogleOAuthConfig | null): void {
  configOverride = config
}

/** Couture de test : délai maximal de l'échange, en millisecondes (`null` = valeur par défaut). */
export function setGoogleTimeoutForTests(ms: number | null): void {
  timeoutOverride = ms
}

/** Remet à zéro configuration, délai ET cache du JWKS. */
export function resetGoogleForTests(): void {
  configOverride = undefined
  timeoutOverride = null
  resetGoogleJwksForTests()
}

export function getGoogleConfig(): GoogleOAuthConfig | null {
  if (configOverride !== undefined) return configOverride
  const env = getEnv()
  if (env.GOOGLE_CLIENT_ID === undefined || env.GOOGLE_CLIENT_SECRET === undefined) return null
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null
}

/** `redirect_uri` unique, dérivée d'`APP_URL` (aucune variable dédiée). */
export function googleRedirectUri(): string {
  return new URL(CALLBACK_PATH, getEnv().APP_URL).href
}

function client(config: GoogleOAuthConfig): Google {
  return new Google(config.clientId, config.clientSecret, googleRedirectUri())
}

/** URL d'autorisation : PKCE S256, `state`, `nonce`, sélecteur de compte ; pas d'`access_type=offline`. */
export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  flow: { state: string; nonce: string; codeVerifier: string },
): URL {
  const url = client(config).createAuthorizationURL(flow.state, flow.codeVerifier, GOOGLE_SCOPES)
  url.searchParams.set('nonce', flow.nonce)
  url.searchParams.set('prompt', 'select_account')
  return url
}

/** Statut HTTP porté par les erreurs de réponse inattendue d'`arctic` (`UnexpectedResponseError` et assimilées). */
function responseStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

function classify(err: unknown): AppError {
  if (err instanceof AppError) return err
  // `invalid_grant` (code rejoué, expiré, vérificateur PKCE faux) et toute autre erreur 4xx : le flux est invalide.
  if (err instanceof OAuth2RequestError) {
    return new AppError('AUTH_SOCIAL_FLOW_INVALID', { reason: 'code_rejected' })
  }
  const status = responseStatus(err)
  if (status !== null && status >= 400 && status < 500) {
    return new AppError('AUTH_SOCIAL_FLOW_INVALID', { reason: 'code_rejected' })
  }
  // Réseau, délai, 5xx : le fournisseur est indisponible. La cause n'est pas attachée (elle peut recopier le code).
  return new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'unavailable' })
}

/**
 * Échange le code d'autorisation contre un `id_token` — UN seul appel, délai borné.
 * Le délai ne peut pas annuler la requête d'`arctic` (pas de signal) : on cesse simplement de l'attendre.
 */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const timeoutMs = timeoutOverride ?? TOKEN_EXCHANGE_TIMEOUT_MS
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'timeout' })),
      timeoutMs,
    )
  })
  const exchange = client(config).validateAuthorizationCode(code, codeVerifier)
  // Si le délai gagne, la requête restée en vol peut encore échouer : jamais de rejet non géré.
  exchange.catch(() => undefined)
  try {
    const tokens = await Promise.race([exchange, timeout])
    return tokens.idToken()
  } catch (err) {
    throw classify(err)
  } finally {
    clearTimeout(timer)
  }
}
