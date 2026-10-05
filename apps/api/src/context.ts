import type { Logger } from './logger.js'

export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
  }
}
