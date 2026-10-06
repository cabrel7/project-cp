import type { Logger } from './logger.js'

export type AuthContext = {
  userId: bigint
  userPublicId: string
  sessionId: bigint
  sessionPublicId: string
}

export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
    auth?: AuthContext
  }
}
