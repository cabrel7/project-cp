import { createHash } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import Redis from 'ioredis'
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible'
import type { AppEnv } from '../context.js'
import { getEnv } from '../env.js'
import { getClientIp } from '../lib/client-ip.js'
import { AppError } from '../lib/errors.js'

type Limiter = RateLimiterRedis | RateLimiterMemory

let ipLimiter: Limiter | undefined
let emailLimiter: Limiter | undefined

function getLimiters(): { ip: Limiter; email: Limiter } {
  if (ipLimiter && emailLimiter) return { ip: ipLimiter, email: emailLimiter }

  const env = getEnv()
  try {
    const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    ipLimiter = new RateLimiterRedis({
      storeClient: client,
      points: 30,
      duration: 60,
      keyPrefix: 'rl:auth:ip',
    })
    emailLimiter = new RateLimiterRedis({
      storeClient: client,
      points: 5,
      duration: 300,
      keyPrefix: 'rl:auth:email',
    })
  } catch {
    ipLimiter = new RateLimiterMemory({ points: 30, duration: 60, keyPrefix: 'auth:ip' })
    emailLimiter = new RateLimiterMemory({ points: 5, duration: 300, keyPrefix: 'auth:email' })
  }

  return { ip: ipLimiter, email: emailLimiter }
}

export const rateLimitByIp = createMiddleware<AppEnv>(async (c, next) => {
  const ip = getClientIp(c) ?? '127.0.0.1'
  const { ip: limiter } = getLimiters()
  try {
    await limiter.consume(ip)
  } catch {
    c.header('Retry-After', '60')
    throw new AppError('PLATFORM_RATE_LIMIT')
  }
  await next()
})

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

export async function checkEmailRateLimit(email: string): Promise<void> {
  const { email: limiter } = getLimiters()
  try {
    await limiter.consume(hashEmail(email))
  } catch {
    throw new AppError('PLATFORM_RATE_LIMIT')
  }
}

export function resetLimiters(): void {
  ipLimiter = undefined
  emailLimiter = undefined
}
