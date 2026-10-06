import { isIP } from 'node:net'
import { createMiddleware } from 'hono/factory'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { AppEnv } from '../context.js'
import { AppError } from '../lib/errors.js'

const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  keyPrefix: 'auth',
})

export const rateLimitAuth = createMiddleware<AppEnv>(async (c, next) => {
  // NB : x-forwarded-for n'est fiable que derrière un proxy de confiance qui l'écrase.
  const candidate = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = candidate && isIP(candidate) ? candidate : '127.0.0.1'
  let limited = false
  try {
    await authLimiter.consume(ip)
  } catch {
    limited = true
  }
  if (limited) {
    c.header('Retry-After', '60')
    throw new AppError('PLATFORM_RATE_LIMIT')
  }
  await next()
})
