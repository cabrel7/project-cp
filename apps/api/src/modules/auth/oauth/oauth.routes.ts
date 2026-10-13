import { errorResponseSchema } from '@cp/shared'
import {
  authMethodsResponseSchema,
  identityParamsSchema,
  linkPendingResponseSchema,
  oauthCallbackQuerySchema,
  oauthLinkBodySchema,
  oauthLinkResponseSchema,
} from '@cp/shared/auth-social-schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv, AuthContext } from '../../../context.js'
import { getEnv } from '../../../env.js'
import { getClientIp, ipRateLimitKey } from '../../../lib/client-ip.js'
import { requireAuth } from '../../../middlewares/auth.js'
import { consumeLimit, type LimiterSpec } from '../../../middlewares/rate-limit.js'
import { getAuthMethods } from '../auth.methods.js'
import { redirectError, redirectInvalid, redirectTo, setCookieHeader } from './oauth.redirect.js'
import * as service from './oauth.service.js'

/** Navigation : valeurs hors énumération tolérées (jamais de 422 JSON) ; le service les normalise. */
const startQuery = z.object({
  next: z.string().optional(),
  remember_me: z.string().optional(),
  locale: z.string().optional(),
})

export const oauthRoutes = new OpenAPIHono<AppEnv>()

const FLOW_COOKIE = 'cp_oauth_google'
const LINK_COOKIE = 'cp_link'
const FLOW_PATH = '/v1/auth/oauth/google'
const LINK_PATH = '/v1/auth/link'
const START_IP_LIMIT: LimiterSpec = {
  keyPrefix: 'rl:auth:social:start:ip',
  points: 30,
  duration: 60,
}
const CALLBACK_IP_LIMIT: LimiterSpec = {
  keyPrefix: 'rl:auth:social:cb:ip',
  points: 30,
  duration: 60,
}

const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorResponseSchema } },
})
const redirectResponse = { 302: { description: 'Redirection (jamais de JSON)' } }

function auth(c: Context<AppEnv>): AuthContext {
  const a = c.get('auth')
  if (!a) throw new Error('requireAuth middleware missing')
  return a
}

const ipKey = (c: Context<AppEnv>) => {
  const ip = getClientIp(c)
  return ip ? ipRateLimitKey(ip) : null
}

const clearFlowCookie = (c: Context<AppEnv>) => setCookieHeader(c, FLOW_COOKIE, '', FLOW_PATH, 0)

async function limitIp(c: Context<AppEnv>, spec: LimiterSpec): Promise<void> {
  const key = ipKey(c)
  if (key) await consumeLimit(spec, key)
}

// ── GET /methods ──

oauthRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/methods',
    tags: ['Auth'],
    summary: 'Sign-in methods offered',
    responses: {
      200: {
        description: 'Methods',
        content: {
          'application/json': {
            schema: authMethodsResponseSchema,
            example: { password: true, phone: true, google: true, passkey: false, apple: false },
          },
        },
      },
    },
  }),
  (c) => c.json(getAuthMethods(), 200, { 'Cache-Control': 'public, max-age=60' }),
)

// ── GET /oauth/google/start ──

oauthRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/oauth/google/start',
    tags: ['Auth'],
    summary: 'Start Google sign-in (redirects to Google)',
    request: { query: startQuery },
    responses: redirectResponse,
  }),
  async (c) => {
    const q = c.req.valid('query')
    return redirectError(c, '/auth/login', async () => {
      await limitIp(c, START_IP_LIMIT)
      const { url, cookie } = await service.startGoogleLogin({
        next: q.next,
        rememberMe: q.remember_me,
        locale: q.locale,
      })
      setCookieHeader(c, FLOW_COOKIE, cookie, FLOW_PATH, 600)
      return c.redirect(url, 302)
    })
  },
  (result, c) => (result.success ? undefined : redirectInvalid(c)),
)

// ── GET /oauth/google/callback ──

oauthRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/oauth/google/callback',
    tags: ['Auth'],
    summary: 'Google redirect target (sign in, sign up, or pending link)',
    request: { query: oauthCallbackQuerySchema },
    responses: redirectResponse,
  }),
  async (c) => {
    const q = c.req.valid('query')
    const clearFlow = () => clearFlowCookie(c)
    return redirectError(
      c,
      '/auth/login',
      async () => {
        await limitIp(c, CALLBACK_IP_LIMIT)
        const outcome = await service.handleGoogleCallback({
          flowCookie: getCookie(c, FLOW_COOKIE),
          sessionToken: getCookie(c, getEnv().SESSION_COOKIE_NAME),
          code: q.code,
          state: q.state,
          error: q.error,
          ip: getClientIp(c),
          userAgent: c.req.header('user-agent') ?? null,
        })
        setCookieHeader(c, FLOW_COOKIE, '', FLOW_PATH, 0)
        return redirectTo(c, outcome, LINK_COOKIE, LINK_PATH)
      },
      clearFlow,
    )
  },
  (result, c) => (result.success ? undefined : redirectInvalid(c, () => clearFlowCookie(c))),
)

// ── POST /oauth/google/link ──

oauthRoutes.use('/oauth/google/link', requireAuth)
oauthRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/oauth/google/link',
    tags: ['Auth'],
    summary: 'Link Google to the signed-in account',
    request: { body: { content: { 'application/json': { schema: oauthLinkBodySchema } } } },
    responses: {
      200: {
        description: 'Authorization URL',
        content: { 'application/json': { schema: oauthLinkResponseSchema } },
      },
      401: err('Not authenticated'),
      403: err('AUTH_ACCOUNT_NOT_VERIFIED or AUTH_REAUTH_REQUIRED'),
      409: err('AUTH_IDENTITY_ALREADY_LINKED'),
      429: err('Too many requests (Retry-After header)'),
      503: err('AUTH_SOCIAL_PROVIDER_UNAVAILABLE'),
    },
  }),
  async (c) => {
    const { url, cookie } = await service.startGoogleLink(auth(c), c.req.valid('json').next)
    setCookieHeader(c, FLOW_COOKIE, cookie, FLOW_PATH, 600)
    return c.json({ authorization_url: url }, 200)
  },
)

// ── GET /link/pending, POST /link/confirm ──

oauthRoutes.use('/link/*', requireAuth)
oauthRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/link/pending',
    tags: ['Auth'],
    summary: 'Pending Google link for the signed-in account',
    responses: {
      200: {
        description: 'Pending link',
        content: { 'application/json': { schema: linkPendingResponseSchema } },
      },
      401: err('Not authenticated'),
      404: err('No pending link'),
    },
  }),
  async (c) => c.json(await service.getPendingLink(auth(c), getCookie(c, LINK_COOKIE)), 200),
)

oauthRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/link/confirm',
    tags: ['Auth'],
    summary: 'Confirm the pending Google link',
    responses: {
      204: { description: 'Linked' },
      401: err('Not authenticated'),
      403: err('AUTH_ACCOUNT_NOT_VERIFIED or AUTH_REAUTH_REQUIRED (login_before_link)'),
      404: err('No pending link'),
      409: err('AUTH_IDENTITY_ALREADY_LINKED'),
      429: err('Too many requests (Retry-After header)'),
    },
  }),
  async (c) => {
    await service.confirmPendingLink(auth(c), getCookie(c, LINK_COOKIE))
    setCookieHeader(c, LINK_COOKIE, '', LINK_PATH, 0)
    return c.body(null, 204)
  },
)

// ── DELETE /identities/{provider} ──

oauthRoutes.use('/identities/*', requireAuth)
oauthRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/identities/{provider}',
    tags: ['Auth'],
    summary: 'Unlink a social sign-in method',
    request: { params: identityParamsSchema },
    responses: {
      204: { description: 'Unlinked' },
      401: err('Not authenticated'),
      403: err('AUTH_REAUTH_REQUIRED'),
      404: err('No such identity'),
      409: err('AUTH_LAST_SIGN_IN_METHOD'),
      422: err('Unsupported provider'),
      429: err('Too many requests (Retry-After header)'),
    },
  }),
  async (c) => {
    await service.unlinkGoogle(auth(c))
    return c.body(null, 204)
  },
)
