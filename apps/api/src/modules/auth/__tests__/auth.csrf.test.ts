/**
 * Contrôle CSRF des routes d'authentification (P2.2, défauts D5/D6) : origines autorisées = origine de l'API
 * + APP_URL ; rejet en 403 `AUTH_INSUFFICIENT_PERMISSIONS` au format d'erreur unique, sans fuite.
 * Sans cookie de session, une requête qui franchit le contrôle CSRF s'arrête en 401 (requireAuth) : c'est la
 * preuve qu'elle n'a pas été bloquée en amont.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../env.js', () => ({
  getEnv: vi.fn(() => ({
    NODE_ENV: 'test',
    PORT: 4000,
    LOG_LEVEL: 'error',
    APP_URL: 'https://app.example.com',
    SESSION_COOKIE_NAME: 'cp_session',
    SESSION_MAX_AGE_SECONDS: 3600,
    SESSION_REMEMBER_MAX_AGE_SECONDS: 86400 * 30,
    TRUSTED_PROXY_HOPS: 0,
    REDIS_URL: 'redis://localhost:6379',
    OTEL_ENABLED: false,
    OTEL_SERVICE_NAME: 'cp-api',
  })),
  resetEnvCache: vi.fn(),
}))

// biome-ignore lint/suspicious/noExplicitAny: assertions sur du JSON dynamique
type Json = any

async function post(headers: Record<string, string>, body?: string) {
  const { createApp } = await import('../../../app.js')
  const { app } = createApp()
  const res = await app.request('http://api.example.com/v1/auth/logout', {
    method: 'POST',
    headers,
    ...(body === undefined ? {} : { body }),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as Json }
}

describe('csrf des routes /v1/auth', () => {
  it('doit laisser passer un POST sans Content-Type depuis l’origine APP_URL', async () => {
    const r = await post({ origin: 'https://app.example.com' })
    expect(r.status).toBe(401)
  })

  it('doit laisser passer un POST sans Content-Type depuis l’origine de l’API', async () => {
    const r = await post({ origin: 'http://api.example.com' })
    expect(r.status).toBe(401)
  })

  it('doit refuser en 403 AUTH_INSUFFICIENT_PERMISSIONS une origine étrangère, sans fuite', async () => {
    const r = await post({ origin: 'https://evil.example.net' })
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS')
    expect(r.json.error.request_id).toBeTruthy()
    const raw = JSON.stringify(r.json)
    expect(raw).not.toContain('evil.example.net')
    expect(raw).not.toContain('app.example.com')
    expect(raw).not.toMatch(/csrf|origin/i)
  })

  it('doit refuser en 403 un POST sans Content-Type ni Origin ni Sec-Fetch-Site', async () => {
    const r = await post({})
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS')
  })

  it('doit refuser en 403 un POST same-site (Sec-Fetch-Site) d’une origine non listée', async () => {
    const r = await post({ origin: 'https://evil.example.net', 'sec-fetch-site': 'same-site' })
    expect(r.status).toBe(403)
  })

  it('ne doit pas contrôler un POST JSON : comportement inchangé même avec une origine étrangère', async () => {
    const r = await post(
      { origin: 'https://evil.example.net', 'content-type': 'application/json' },
      '{}',
    )
    expect(r.status).toBe(401)
  })
})
