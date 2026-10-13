import type { Logger } from './logger.js'

export type AuthContext = {
  userId: bigint
  userPublicId: string
  sessionId: bigint
  sessionPublicId: string
  /** Création de la session (ISO) : fraîcheur exigée pour lier/délier (P-1). */
  sessionCreatedAt: string
}

export type AppEnv = {
  Variables: {
    requestId: string
    logger: Logger
    auth?: AuthContext
  }
}
