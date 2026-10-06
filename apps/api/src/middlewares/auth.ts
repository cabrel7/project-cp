import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../context.js'
import { getEnv } from '../env.js'
import { AppError } from '../lib/errors.js'
import {
  findSessionByTokenHash,
  findUserById,
  touchSession,
} from '../modules/auth/auth.repository.js'
import { hashToken } from '../modules/auth/auth.token.js'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const env = getEnv()
  const cookieHeader = c.req.header('cookie')
  let rawToken: string | undefined

  if (cookieHeader) {
    const prefix = `${env.SESSION_COOKIE_NAME}=`
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim()
      if (trimmed.startsWith(prefix)) {
        rawToken = trimmed.slice(prefix.length)
        break
      }
    }
  }

  if (!rawToken) {
    const authHeader = c.req.header('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7)
    }
  }

  if (!rawToken) {
    throw new AppError('AUTH_TOKEN_INVALID')
  }

  const hash = hashToken(rawToken)
  const session = await findSessionByTokenHash(hash)

  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
    throw new AppError('AUTH_TOKEN_INVALID')
  }

  const user = await findUserById(session.userId)
  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    throw new AppError('AUTH_TOKEN_INVALID')
  }

  c.set('auth', {
    userId: session.userId,
    userPublicId: user.publicId,
    sessionId: session.id,
    sessionPublicId: session.publicId,
  })

  // Expiration glissante sans jamais raccourcir une session « se souvenir de moi ».
  const slid = Date.now() + env.SESSION_MAX_AGE_SECONDS * 1000
  const newExpiry = new Date(Math.max(slid, new Date(session.expiresAt).getTime()))
  touchSession(session.id, newExpiry).catch(() => {})

  await next()
})
