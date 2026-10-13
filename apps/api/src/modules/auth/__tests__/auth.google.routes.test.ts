/**
 * P2.3 — routes sans base (`app.request`) : GET /v1/auth/methods (CA-3), démarrage sans configuration (CA-5),
 * liste fermée des routes publiées (spec §3.2 : « aucune route en dehors de cette liste »).
 * Phase RED : routes et coutures `oauth/*` absentes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../app.js'
import { resetEnvCache } from '../../../env.js'
import { loadSrc, socketEnv, uniqueIp } from './phone-test-utils.js'

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
type Json = any
type Client = typeof import('../oauth/google.client.js')
const APP = 'https://app.test.example'

async function seam(): Promise<Client | null> {
  try {
    return await loadSrc<Client>('../oauth/google.client.js')
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') return null
    throw err
  }
}

async function boot(vars: Record<string, string>, configured: boolean) {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('APP_URL', APP)
  vi.stubEnv('SMS_PROVIDER', 'simulated')
  vi.stubEnv('LOG_LEVEL', 'error')
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  resetEnvCache()
  const client = await seam()
  client?.resetGoogleForTests()
  if (configured) {
    client?.setGoogleOAuthConfigForTests({
      clientId: `cp-test-1234567890${'.apps.google'}${'usercontent.com'}`,
      clientSecret: `${'GOC'}${'SPX'}-cp-test-secret-0123456789`,
    })
  }
  return createApp().app
}

afterEach(async () => {
  ;(await seam())?.resetGoogleForTests()
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('GET /v1/auth/methods (CA-3)', () => {
  it('doit répondre 200 {password,phone:true,google:false,passkey:false,apple:false} avec Cache-Control public, max-age=60, sans session', async () => {
    const app = await boot({}, false)
    const res = await app.request('/v1/auth/methods')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      password: true,
      phone: true,
      google: false,
      passkey: false,
      apple: false,
    })
    expect(res.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('doit indiquer google:true quand la configuration Google est injectée', async () => {
    const app = await boot({}, true)
    const body: Json = await (await app.request('/v1/auth/methods')).json()
    expect(body.google).toBe(true)
  })

  it('doit indiquer phone:false quand SMS_PROVIDER=none', async () => {
    const app = await boot({ SMS_PROVIDER: 'none' }, false)
    const body: Json = await (await app.request('/v1/auth/methods')).json()
    expect(body.phone).toBe(false)
    expect(body.password).toBe(true)
  })

  it('doit laisser passkey et apple à false quelle que soit la configuration (aucune variable ne les active)', async () => {
    const vars: Record<string, string> = {}
    for (const prefix of ['', 'AUTH_', 'FEATURE_', 'NUXT_PUBLIC_', 'NEXT_PUBLIC_', 'ENABLE_']) {
      for (const name of [
        'PASSKEY',
        'PASSKEYS',
        'APPLE',
        'APPLE_SIGN_IN',
        'APPLE_CLIENT_ID',
        'PASSKEY_ENABLED',
        'APPLE_ENABLED',
      ]) {
        vars[`${prefix}${name}`] = 'true'
      }
    }
    vars.APPLE_CLIENT_SECRET = 'x'.repeat(32)
    const app = await boot(vars, true)
    const body: Json = await (await app.request('/v1/auth/methods')).json()
    expect(body.passkey).toBe(false)
    expect(body.apple).toBe(false)
    expect(body.google).toBe(true)
  })

  it('ne doit exiger ni session ni Origin (route publique, GET)', async () => {
    const app = await boot({}, false)
    const res = await app.request('/v1/auth/methods', {
      headers: { origin: 'https://evil.example.net' },
    })
    expect(res.status).toBe(200)
  })
})

describe('GET /v1/auth/oauth/google/start sans configuration (CA-5)', () => {
  it('doit rediriger (jamais JSON) vers /auth/login?error=AUTH_SOCIAL_PROVIDER_UNAVAILABLE, sans cookie', async () => {
    const app = await boot({}, false)
    const res = await app.request('/v1/auth/oauth/google/start', {}, socketEnv(uniqueIp()))
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.origin).toBe(APP)
    expect(loc.pathname).toBe('/auth/login')
    expect(loc.searchParams.get('error')).toBe('AUTH_SOCIAL_PROVIDER_UNAVAILABLE')
    expect(res.headers.getSetCookie()).toEqual([])
  })

  it('doit rediriger même pour une requête de rappel sans cookie (FLOW_INVALID), sans appel réseau', async () => {
    const app = await boot({}, true)
    const res = await app.request(
      '/v1/auth/oauth/google/callback?code=x&state=y',
      {},
      socketEnv(uniqueIp()),
    )
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('location') ?? '').searchParams.get('error')).toBe(
      'AUTH_SOCIAL_FLOW_INVALID',
    )
  })
})

describe('contrat OpenAPI : liste fermée des routes (spec §3.2)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    resetEnvCache()
  })

  it('doit publier exactement les routes de P2.3 en plus de celles de P2.1/P2.2, sans route Apple ni DELETE /link/pending', async () => {
    const app = createApp().app
    const spec: Json = await (await app.request('/openapi.json')).json()
    const published = Object.entries(spec.paths as Record<string, Record<string, unknown>>)
      .filter(([p]) => p.startsWith('/v1/auth'))
      .flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`))
      .sort()
    const existing = [
      'POST /v1/auth/register',
      'POST /v1/auth/login',
      'POST /v1/auth/logout',
      'POST /v1/auth/logout-all',
      'GET /v1/auth/sessions',
      'DELETE /v1/auth/sessions/{sessionId}',
      'POST /v1/auth/forgot-password',
      'POST /v1/auth/reset-password',
      'POST /v1/auth/verify-email',
      'POST /v1/auth/resend-verification',
      'POST /v1/auth/phone/request-code',
      'POST /v1/auth/phone/verify-code',
      'GET /v1/auth/me',
    ]
    const added = [
      'GET /v1/auth/methods',
      'GET /v1/auth/oauth/google/start',
      'GET /v1/auth/oauth/google/callback',
      'POST /v1/auth/oauth/google/link',
      'GET /v1/auth/link/pending',
      'POST /v1/auth/link/confirm',
      'DELETE /v1/auth/identities/{provider}',
    ]
    expect(published).toEqual([...existing, ...added].sort())
  })

  it('doit documenter les erreurs de DELETE /identities/{provider} (401, 403, 404, 409, 422, 429) et de POST /link/confirm', async () => {
    const app = createApp().app
    const spec: Json = await (await app.request('/openapi.json')).json()
    const del = spec.paths?.['/v1/auth/identities/{provider}']?.delete?.responses ?? {}
    for (const s of ['204', '401', '403', '404', '409', '422', '429'])
      expect(del, `DELETE ${s}`).toHaveProperty(s)
    const confirm = spec.paths?.['/v1/auth/link/confirm']?.post?.responses ?? {}
    for (const s of ['204', '401', '403', '404', '409', '429'])
      expect(confirm, `confirm ${s}`).toHaveProperty(s)
  })
})
