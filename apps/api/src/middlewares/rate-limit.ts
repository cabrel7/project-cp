import { createHash } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import Redis from 'ioredis'
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import type { AppEnv } from '../context.js'
import { getEnv } from '../env.js'
import { getClientIp } from '../lib/client-ip.js'
import { AppError } from '../lib/errors.js'

/** Quota d'un limiteur : `points` requêtes par fenêtre de `duration` secondes. */
export interface LimiterSpec {
  keyPrefix: string
  points: number
  duration: number
}

/** Attente maximale de la connexion Redis avant de basculer sur le limiteur mémoire d'assurance. */
const REDIS_READY_WAIT_MS = 1500
/** Après un échec de connexion, on n'attend plus Redis pendant ce délai (pas de latence ajoutée par requête). */
const REDIS_RETRY_COOLDOWN_MS = 2000

let redisClient: Redis | undefined
let redisUnavailableUntil = 0
let readyWait: Promise<'ready' | 'timeout' | 'failed'> | undefined
const limiters = new Map<string, RateLimiterRedis>()

/** @internal exporté pour les tests (écouteurs, état de connexion). */
export function getRedisClient(): Redis {
  if (redisClient) return redisClient
  const client = new Redis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    // Hors ligne : les commandes échouent tout de suite et rate-limiter-flexible bascule sur l'assurance.
    enableOfflineQueue: false,
    connectTimeout: 1000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  })
  // Une panne Redis ne doit jamais faire tomber le processus : l'assurance mémoire prend le relais.
  client.on('error', () => {})
  redisClient = client
  return client
}

/**
 * Connecte Redis AVANT le premier `consume()`. Avec `lazyConnect` + `enableOfflineQueue: false`, un
 * premier appel sur un client non connecté échoue immédiatement et passe par le limiteur mémoire :
 * le compteur n'est alors jamais écrit dans Redis. En cas de panne (délai ou échec), on n'attend pas :
 * le mode dégradé (limiteur mémoire d'assurance) s'applique.
 */
export async function ensureRedisReady(): Promise<void> {
  if (Date.now() < redisUnavailableUntil) return
  const client = getRedisClient()
  if (client.status === 'ready') return

  // Une seule attente partagée par toutes les requêtes concurrentes ; l'écouteur `ready` est TOUJOURS retiré
  // (sinon chaque requête pendant une panne laisserait un écouteur orphelin : fuite mémoire).
  readyWait ??= waitForReady(client).finally(() => {
    readyWait = undefined
  })
  const outcome = await readyWait
  if (outcome !== 'ready') redisUnavailableUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS
}

function waitForReady(client: Redis): Promise<'ready' | 'timeout' | 'failed'> {
  return new Promise((resolve) => {
    let settled = false
    let listening = false
    const onReady = () => finish('ready')
    const finish = (outcome: 'ready' | 'timeout' | 'failed') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (listening) client.off('ready', onReady)
      resolve(outcome)
    }
    const timer = setTimeout(() => finish('timeout'), REDIS_READY_WAIT_MS)
    const inProgress =
      client.status === 'connecting' ||
      client.status === 'connect' ||
      client.status === 'reconnecting'
    if (inProgress) {
      listening = true
      client.once('ready', onReady)
    } else {
      client.connect().then(
        () => finish('ready'),
        () => finish('failed'),
      )
    }
  })
}

/**
 * Limiteur Redis doté d'un `insuranceLimiter` mémoire de même quota : une panne Redis ne bloque pas
 * tout le monde (et ne désactive pas la limite). Mémorisé par préfixe et quota.
 */
export function getRateLimiter(spec: LimiterSpec): RateLimiterRedis {
  const id = `${spec.keyPrefix}|${spec.points}|${spec.duration}`
  const existing = limiters.get(id)
  if (existing) return existing
  const limiter = new RateLimiterRedis({
    storeClient: getRedisClient(),
    points: spec.points,
    duration: spec.duration,
    keyPrefix: spec.keyPrefix,
    insuranceLimiter: new RateLimiterMemory({ points: spec.points, duration: spec.duration }),
  })
  limiters.set(id, limiter)
  return limiter
}

/**
 * Consomme 1 point. Quota dépassé : 429 `PLATFORM_RATE_LIMIT` avec `Retry-After = ceil(msBeforeNext/1000)`.
 * Toute autre erreur (panne du magasin déjà absorbée par l'assurance) laisse passer la requête.
 */
export async function consumeLimit(spec: LimiterSpec, key: string): Promise<void> {
  await ensureRedisReady()
  try {
    await getRateLimiter(spec).consume(key)
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      throw new AppError('PLATFORM_RATE_LIMIT', undefined, {
        retryAfterSeconds: Math.max(1, Math.ceil(err.msBeforeNext / 1000)),
      })
    }
  }
}

/** Middleware : limite par IP client (`getClientIp`, jamais le X-Forwarded-For brut). IP inconnue : pas de limite. */
export function ipRateLimit(spec: LimiterSpec | (() => LimiterSpec)) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip = getClientIp(c)
    // Un quota fourni par fonction est relu à chaque requête (valeurs injectables, voir auth.phone.config.ts).
    if (ip) await consumeLimit(typeof spec === 'function' ? spec() : spec, ip)
    await next()
  })
}

const AUTH_IP_LIMIT: LimiterSpec = { keyPrefix: 'rl:auth:ip', points: 30, duration: 60 }
const AUTH_EMAIL_LIMIT: LimiterSpec = { keyPrefix: 'rl:auth:email', points: 5, duration: 300 }

export const rateLimitByIp = ipRateLimit(AUTH_IP_LIMIT)

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

export async function checkEmailRateLimit(email: string): Promise<void> {
  await consumeLimit(AUTH_EMAIL_LIMIT, hashEmail(email))
}

export function resetLimiters(): void {
  limiters.clear()
  redisUnavailableUntil = 0
  readyWait = undefined
  redisClient?.disconnect()
  redisClient = undefined
}
