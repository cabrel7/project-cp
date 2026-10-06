import { errorResponseSchema } from '@cp/shared'
import {
  authResponseSchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meResponseSchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sessionResponseSchema,
  verifyEmailBodySchema,
} from '@cp/shared/auth-schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { csrf } from 'hono/csrf'
import type { AppEnv, AuthContext } from '../../context.js'
import { getEnv } from '../../env.js'
import { requireAuth } from '../../middlewares/auth.js'
import { rateLimitAuth } from '../../middlewares/rate-limit.js'
import * as service from './auth.service.js'

export const authRoutes = new OpenAPIHono<AppEnv>()

authRoutes.use(csrf())

function getAuth(c: { get: (key: 'auth') => AuthContext | undefined }): AuthContext {
  const auth = c.get('auth')
  if (!auth) throw new Error('requireAuth middleware missing')
  return auth
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string | null {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function setSessionCookie(
  c: { header: (name: string, value: string) => void },
  token: string,
  maxAge: number,
) {
  const env = getEnv()
  const secure = env.NODE_ENV === 'production' ? '; Secure' : ''
  c.header(
    'set-cookie',
    `${env.SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  )
}

function clearSessionCookie(c: { header: (name: string, value: string) => void }) {
  const env = getEnv()
  const secure = env.NODE_ENV === 'production' ? '; Secure' : ''
  c.header(
    'set-cookie',
    `${env.SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
  )
}

// ── POST /v1/auth/register ──

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Auth'],
  summary: 'Create a new account',
  request: {
    body: { content: { 'application/json': { schema: registerBodySchema } } },
  },
  responses: {
    201: {
      description: 'Account created',
      content: { 'application/json': { schema: authResponseSchema } },
    },
    409: {
      description: 'Email already in use',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    422: {
      description: 'Password too weak',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/register', rateLimitAuth)
authRoutes.openapi(registerRoute, async (c) => {
  const body = c.req.valid('json')
  const result = await service.register({
    email: body.email,
    password: body.password,
    fullName: body.full_name ?? null,
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  })
  setSessionCookie(c, result.token, result.maxAge)
  return c.json(result.authResponse, 201)
})

// ── POST /v1/auth/login ──

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: 'Log in with email and password',
  request: {
    body: { content: { 'application/json': { schema: loginBodySchema } } },
  },
  responses: {
    200: {
      description: 'Logged in',
      content: { 'application/json': { schema: authResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/login', rateLimitAuth)
authRoutes.openapi(loginRoute, async (c) => {
  const body = c.req.valid('json')
  const result = await service.login({
    email: body.email,
    password: body.password,
    rememberMe: body.remember_me,
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  })
  setSessionCookie(c, result.token, result.maxAge)
  return c.json(result.authResponse, 200)
})

// ── POST /v1/auth/logout ──

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  summary: 'Log out current session',
  responses: {
    204: { description: 'Logged out' },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/logout', requireAuth)
authRoutes.openapi(logoutRoute, async (c) => {
  const auth = getAuth(c)
  await service.logout(auth.sessionId)
  clearSessionCookie(c)
  return c.body(null, 204)
})

// ── POST /v1/auth/logout-all ──

const logoutAllRoute = createRoute({
  method: 'post',
  path: '/logout-all',
  tags: ['Auth'],
  summary: 'Log out all sessions except current',
  responses: {
    204: { description: 'All other sessions revoked' },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/logout-all', requireAuth)
authRoutes.openapi(logoutAllRoute, async (c) => {
  const auth = getAuth(c)
  await service.logoutAll(auth.userId, auth.sessionId)
  return c.body(null, 204)
})

// ── GET /v1/auth/sessions ──

const listSessionsRoute = createRoute({
  method: 'get',
  path: '/sessions',
  tags: ['Auth'],
  summary: 'List active sessions',
  responses: {
    200: {
      description: 'Active sessions',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(sessionResponseSchema) }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/sessions', requireAuth)
authRoutes.openapi(listSessionsRoute, async (c) => {
  const auth = getAuth(c)
  const sessions = await service.listSessions(auth.userId, auth.sessionId)
  return c.json({ data: sessions }, 200)
})

// ── DELETE /v1/auth/sessions/:sessionId ──

const revokeSessionRoute = createRoute({
  method: 'delete',
  path: '/sessions/{sessionId}',
  tags: ['Auth'],
  summary: 'Revoke a specific session',
  request: {
    params: z.object({ sessionId: z.string().uuid() }),
  },
  responses: {
    204: { description: 'Session revoked' },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'Session not found',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.openapi(revokeSessionRoute, async (c) => {
  const auth = getAuth(c)
  const { sessionId } = c.req.valid('param')
  await service.revokeSessionById(auth.userId, sessionId, auth.sessionPublicId)
  return c.body(null, 204)
})

// ── POST /v1/auth/forgot-password ──

const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  tags: ['Auth'],
  summary: 'Request a password reset email',
  request: {
    body: { content: { 'application/json': { schema: forgotPasswordBodySchema } } },
  },
  responses: {
    200: {
      description: 'If the email exists, a reset link was sent',
      content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } },
    },
  },
})

authRoutes.use('/forgot-password', rateLimitAuth)
authRoutes.openapi(forgotPasswordRoute, async (c) => {
  const body = c.req.valid('json')
  await service.forgotPassword({ email: body.email, ip: getClientIp(c) })
  return c.json({ ok: true as const }, 200)
})

// ── POST /v1/auth/reset-password ──

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  tags: ['Auth'],
  summary: 'Reset password using token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: resetPasswordBodySchema.extend({
            revoke_sessions: z.boolean().default(true),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password reset',
      content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } },
    },
    422: {
      description: 'Invalid or expired token, or password too weak',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/reset-password', rateLimitAuth)
authRoutes.openapi(resetPasswordRoute, async (c) => {
  const body = c.req.valid('json')
  await service.resetPassword({
    token: body.token,
    password: body.password,
    revokeOtherSessions: body.revoke_sessions,
  })
  return c.json({ ok: true as const }, 200)
})

// ── POST /v1/auth/verify-email ──

const verifyEmailRoute = createRoute({
  method: 'post',
  path: '/verify-email',
  tags: ['Auth'],
  summary: 'Verify email address',
  request: {
    body: { content: { 'application/json': { schema: verifyEmailBodySchema } } },
  },
  responses: {
    200: {
      description: 'Email verified',
      content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } },
    },
    422: {
      description: 'Invalid or expired token',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/verify-email', rateLimitAuth)
authRoutes.openapi(verifyEmailRoute, async (c) => {
  const body = c.req.valid('json')
  await service.verifyEmail(body.token)
  return c.json({ ok: true as const }, 200)
})

// ── POST /v1/auth/resend-verification ──

const resendVerificationRoute = createRoute({
  method: 'post',
  path: '/resend-verification',
  tags: ['Auth'],
  summary: 'Resend email verification',
  responses: {
    200: {
      description: 'If applicable, verification email resent',
      content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/resend-verification', requireAuth)
authRoutes.openapi(resendVerificationRoute, async (c) => {
  const auth = getAuth(c)
  await service.resendVerification({ userId: auth.userId, ip: getClientIp(c) })
  return c.json({ ok: true as const }, 200)
})

// ── GET /v1/auth/me ──

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Auth'],
  summary: 'Get current user profile',
  responses: {
    200: {
      description: 'Current user',
      content: { 'application/json': { schema: meResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

authRoutes.use('/me', requireAuth)
authRoutes.openapi(meRoute, async (c) => {
  const auth = getAuth(c)
  const user = await service.getMe(auth.userId)
  return c.json(user, 200)
})
