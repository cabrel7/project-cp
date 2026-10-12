import { serve } from '@hono/node-server'
import pino from 'pino'
import { createApp } from './app.js'
import { getEnv } from './env.js'
import { initOtel } from './otel.js'

async function main() {
  await initOtel()

  const env = getEnv()
  const { app, logger } = createApp()

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, 'api server started')
  })

  const shutdown = () => {
    logger.info('shutting down')
    server.close(() => {
      logger.info('server closed')
      process.exit(0)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  // Logger minimal sans getEnv() : la validation de l'environnement peut être la cause de l'échec.
  // Les messages de env.ts ne contiennent aucune valeur (secrets).
  pino({ name: 'api' }).fatal({ err }, 'Fatal startup error')
  process.exit(1)
})
