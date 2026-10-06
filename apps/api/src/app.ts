import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import type { AppEnv } from './context.js'
import { getEnv } from './env.js'
import { AppError } from './lib/errors.js'
import { createLogger } from './logger.js'
import { notFound, onError } from './middlewares/error-handler.js'
import { loggerMiddleware } from './middlewares/logger.js'
import { requestId } from './middlewares/request-id.js'
import { authRoutes } from './modules/auth/auth.routes.js'

export function createApp() {
  const env = getEnv()
  const rootLogger = createLogger()

  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        throw new AppError('PLATFORM_VALIDATION_ERROR', {
          issues: result.error.issues,
        })
      }
    },
  })

  app.use(requestId)
  app.use(loggerMiddleware(rootLogger))

  app.get('/health', (c) => {
    return c.json({
      status: 'ok' as const,
      version: '0.0.0',
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    })
  })

  app.route('/v1/auth', authRoutes)

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'project-cp API',
      version: '0.0.0',
      description: 'API de la plateforme project-cp.',
    },
  })

  app.get(
    '/docs',
    apiReference({
      spec: { url: '/openapi.json' },
      theme: 'kepler',
    }),
  )

  app.onError(onError)
  app.notFound(notFound)

  return { app, logger: rootLogger }
}
