import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../context.js'
import { getEnv } from '../env.js'
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
    return c.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'Authentication required' } }, 401)
  }

  const hash = hashToken(rawToken)
  const session = await findSessionByTokenHash(hash)

  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
    return c.json(
      { error: { code: 'AUTH_UNAUTHORIZED', message: 'Invalid or expired session' } },
      401,
    )
  }

  const user = await findUserById(session.userId)
  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    return c.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'Account unavailable' } }, 401)
  }

  c.set('auth', {
    userId: session.userId,
    userPublicId: user.publicId,
    sessionId: session.id,
    sessionPublicId: session.publicId,
  })

  const newExpiry = new Date(Date.now() + env.SESSION_MAX_AGE_SECONDS * 1000)
  touchSession(session.id, newExpiry).catch(() => {})

  await next()
})
