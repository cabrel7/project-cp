import { createMiddleware } from 'hono/factory'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { AppEnv } from '../context.js'

const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  keyPrefix: 'auth',
})

export const rateLimitAuth = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  try {
    await authLimiter.consume(ip)
    await next()
  } catch {
    c.header('Retry-After', '60')
    return c.json(
      {
        error: {
          code: 'AUTH_TOO_MANY_REQUESTS',
          message: 'Too many requests, please try again later',
        },
      },
      429,
    )
  }
})
