import { createHash } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import Redis from 'ioredis'
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import type { AppEnv } from '../context.js'
import { getEnv } from '../env.js'
import { getClientIp } from '../lib/client-ip.js'
import { AppError } from '../lib/errors.js'

let ipLimiter: RateLimiterRedis | undefined
let emailLimiter: RateLimiterRedis | undefined
let ipInsurance: RateLimiterMemory | undefined
let emailInsurance: RateLimiterMemory | undefined

function getLimiters() {
  if (ipLimiter && emailLimiter && ipInsurance && emailInsurance) {
    return { ip: ipLimiter, email: emailLimiter, ipIns: ipInsurance, emailIns: emailInsurance }
  }

  const env = getEnv()
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  ipInsurance = new RateLimiterMemory({ points: 30, duration: 60 })
  emailInsurance = new RateLimiterMemory({ points: 5, duration: 300 })

  ipLimiter = new RateLimiterRedis({
    storeClient: client,
    points: 30,
    duration: 60,
    keyPrefix: 'rl:auth:ip',
    insuranceLimiter: ipInsurance,
  })
  emailLimiter = new RateLimiterRedis({
    storeClient: client,
    points: 5,
    duration: 300,
    keyPrefix: 'rl:auth:email',
    insuranceLimiter: emailInsurance,
  })

  return { ip: ipLimiter, email: emailLimiter, ipIns: ipInsurance, emailIns: emailInsurance }
}

export const rateLimitByIp = createMiddleware<AppEnv>(async (c, next) => {
  const ip = getClientIp(c)
  if (!ip) {
    await next()
    return
  }
  const { ip: limiter } = getLimiters()
  try {
    await limiter.consume(ip)
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      c.header('Retry-After', '60')
      throw new AppError('PLATFORM_RATE_LIMIT')
    }
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
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      throw new AppError('PLATFORM_RATE_LIMIT')
    }
  }
}

export function resetLimiters(): void {
  ipLimiter = undefined
  emailLimiter = undefined
  ipInsurance = undefined
  emailInsurance = undefined
}
