/**
 * P2.3 — revue : sorties des routes de navigation Google (régression, sans base).
 * (1) le cookie de flux est effacé sur TOUTES les sorties du rappel (429, paramètre invalide, erreur imprévue) et une erreur
 *     imprévue d'un flux « link » redirige vers la page de l'intention (pas toujours /auth/login) ;
 * (2) un paramètre répété (`?next=a&next=b`, `?state=a&state=b`) redirige avec FLOW_INVALID, jamais de JSON 422.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../app.js'
import { resetEnvCache } from '../../../env.js'
import { socketEnv, uniqueIp } from './phone-test-utils.js'

const APP = 'https://app.test.example'
const flowMock = vi.hoisted(() => ({ flow: null as unknown }))

vi.mock('../oauth/oauth.flow.js', async (original) => ({
  ...(await original<typeof import('../oauth/oauth.flow.js')>()),
  consumeFlow: vi.fn(async () => flowMock.flow),
}))
vi.mock('../auth.repository.js', async (original) => ({
  ...(await original<typeof import('../auth.repository.js')>()),
  findSessionByTokenHash: vi.fn(async () => {
    throw new TypeError('boom imprévu')
  }),
}))

async function boot() {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('APP_URL', APP)
  vi.stubEnv('LOG_LEVEL', 'fatal')
  resetEnvCache()
  const client = await import('../oauth/google.client.js')
  client.setGoogleOAuthConfigForTests({
    clientId: 'cp-test-1234567890.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-cp-test-secret-0123456789',
  })
  return createApp().app
}

afterEach(async () => {
  ;(await import('../oauth/google.client.js')).resetGoogleForTests()
  vi.unstubAllEnvs()
  resetEnvCache()
  flowMock.flow = null
})

const cleared = (res: Response) => {
  const c = res.headers.getSetCookie().find((h) => h.startsWith('cp_oauth_google='))
  expect(c, 'cp_oauth_google doit être effacé').toBeDefined()
  expect(c).toMatch(/Max-Age=0/i)
  expect(c).toMatch(/Path=\/v1\/auth\/oauth\/google/)
}

describe('rappel Google — cookie de flux effacé sur toutes les sorties', () => {
  it('doit effacer le cookie au 31ᵉ appel d’une même IP (429)', async () => {
    const app = await boot()
    const ip = uniqueIp()
    let last: Response | undefined
    for (let i = 0; i < 31; i++) {
      last = await app.request(
        '/v1/auth/oauth/google/callback?code=x&state=y',
        { headers: { cookie: 'cp_oauth_google=abc' } },
        socketEnv(ip),
      )
    }
    expect(new URL(last?.headers.get('location') ?? '').searchParams.get('error')).toBe(
      'PLATFORM_RATE_LIMIT',
    )
    cleared(last as Response)
  })

  it('doit rediriger vers la page de l’intention « link » et effacer le cookie sur une erreur imprévue', async () => {
    const app = await boot()
    flowMock.flow = {
      state: 'S'.repeat(43),
      nonce: 'n',
      code_verifier: 'v',
      intent: 'link',
      user_id: '1',
      session_id: '1',
      next: '/account/security',
      remember_me: true,
      locale: 'fr',
      created_at: Date.now(),
    }
    const res = await app.request(
      `/v1/auth/oauth/google/callback?code=x&state=${'S'.repeat(43)}`,
      { headers: { cookie: 'cp_oauth_google=abc; cp_session=zzz' } },
      socketEnv(uniqueIp()),
    )
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.pathname).toBe('/account/security')
    expect(loc.searchParams.get('error')).toBe('AUTH_SOCIAL_PROVIDER_UNAVAILABLE')
    cleared(res)
  })
})

describe('paramètres répétés — redirection, jamais de JSON 422', () => {
  it('doit rediriger /start?next=a&next=b vers /auth/login?error=AUTH_SOCIAL_FLOW_INVALID', async () => {
    const app = await boot()
    const res = await app.request(
      '/v1/auth/oauth/google/start?next=a&next=b',
      {},
      socketEnv(uniqueIp()),
    )
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.pathname).toBe('/auth/login')
    expect(loc.searchParams.get('error')).toBe('AUTH_SOCIAL_FLOW_INVALID')
    expect(res.headers.get('content-type') ?? '').not.toContain('json')
  })

  it('doit rediriger /callback?state=a&state=b avec FLOW_INVALID et effacer le cookie de flux', async () => {
    const app = await boot()
    const res = await app.request(
      '/v1/auth/oauth/google/callback?code=x&state=a&state=b',
      { headers: { cookie: 'cp_oauth_google=abc' } },
      socketEnv(uniqueIp()),
    )
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('location') ?? '').searchParams.get('error')).toBe(
      'AUTH_SOCIAL_FLOW_INVALID',
    )
    cleared(res)
  })
})
