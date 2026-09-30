import { serve } from '@hono/node-server'
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
  // biome-ignore lint/suspicious/noConsole: pino not yet initialized at bootstrap failure
  console.error('Fatal startup error:', err)
  process.exit(1)
})
