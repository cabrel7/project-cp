import { createMiddleware } from 'hono/factory'
import type pino from 'pino'
import type { AppEnv } from '../context.js'

export function loggerMiddleware(rootLogger: pino.Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const requestId = c.get('requestId')
    const child = rootLogger.child({ requestId })
    c.set('logger', child)
    const start = performance.now()
    await next()
    const duration = Math.round(performance.now() - start)
    child.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration,
      },
      'request completed',
    )
  })
}
