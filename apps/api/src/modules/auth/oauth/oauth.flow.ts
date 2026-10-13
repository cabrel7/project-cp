/**
 * États éphémères de la connexion Google dans Redis (P2.3, spec §2.4) : flux OAuth et liaison en attente.
 *
 * - Clés `auth:oauth:flow:<sha256(cookie)>` et `auth:oauth:link:<sha256(cookie)>`, TTL 600 s : Redis ne stocke que
 *   l'EMPREINTE de la valeur du cookie (lire Redis ne permet pas de forger un cookie).
 * - Flux : usage unique (`GETDEL`). Aucun e-mail dedans. Liaison en attente : contient `sub` et `email` (PII), durée courte,
 *   jamais journalisée ; lue par `GET`, consommée (`GETDEL`) au moment de rattacher.
 * - Client = `getRedisClient()` (celui du limiteur de débit), obtenu à chaque appel. Une panne Redis lève
 *   `AUTH_SOCIAL_PROVIDER_UNAVAILABLE`.
 */
import { createHash, randomBytes } from 'node:crypto'
import { AppError } from '../../../lib/errors.js'
import { ensureRedisReady, getRedisClient } from '../../../middlewares/rate-limit.js'

export const OAUTH_STATE_TTL_SECONDS = 600
const FLOW_PREFIX = 'auth:oauth:flow:'
const LINK_PREFIX = 'auth:oauth:link:'

export interface OauthFlow {
  state: string
  nonce: string
  code_verifier: string
  intent: 'login' | 'link'
  /** Identifiants internes (Redis est interne ; jamais exposés au client). Présents pour l'intention `link`. */
  user_id?: string
  session_id?: string
  next: string
  remember_me: boolean
  locale: 'fr' | 'en'
  created_at: number
}

export interface PendingLink {
  provider: 'google'
  sub: string
  email: string
  created_at: number
}

/** 32 octets aléatoires en base64url (43 caractères) : valeur d'un cookie, d'un `state` ou d'un `nonce`. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

export function fingerprint(cookieValue: string): string {
  return createHash('sha256').update(cookieValue).digest('hex')
}

async function redis() {
  try {
    await ensureRedisReady()
    return getRedisClient()
  } catch {
    throw new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'unavailable' })
  }
}

async function put(prefix: string, cookieValue: string, value: object): Promise<void> {
  const client = await redis()
  try {
    await client.set(
      `${prefix}${fingerprint(cookieValue)}`,
      JSON.stringify(value),
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    )
  } catch {
    throw new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'unavailable' })
  }
}

async function read<T>(
  prefix: string,
  cookieValue: string,
  mode: 'get' | 'getdel',
): Promise<T | null> {
  const client = await redis()
  let raw: string | null
  try {
    const key = `${prefix}${fingerprint(cookieValue)}`
    raw = mode === 'getdel' ? await client.getdel(key) : await client.get(key)
  } catch {
    throw new AppError('AUTH_SOCIAL_PROVIDER_UNAVAILABLE', { reason: 'unavailable' })
  }
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const saveFlow = (cookieValue: string, flow: OauthFlow) =>
  put(FLOW_PREFIX, cookieValue, flow)

/** Usage unique : le flux est supprimé à la lecture (un rappel rejoué trouve `null`). */
export const consumeFlow = (cookieValue: string) =>
  read<OauthFlow>(FLOW_PREFIX, cookieValue, 'getdel')

export const savePendingLink = (cookieValue: string, link: PendingLink) =>
  put(LINK_PREFIX, cookieValue, link)

export const peekPendingLink = (cookieValue: string) =>
  read<PendingLink>(LINK_PREFIX, cookieValue, 'get')

/** Usage unique : consommée au moment de rattacher. */
export const consumePendingLink = (cookieValue: string) =>
  read<PendingLink>(LINK_PREFIX, cookieValue, 'getdel')
