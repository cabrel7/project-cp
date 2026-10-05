import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'

// biome-ignore lint/suspicious/noExplicitAny: test assertions on dynamic JSON
type Json = any

describe('GET /health', () => {
  let app: ReturnType<typeof createApp>['app']

  beforeAll(() => {
    app = createApp().app
  })

  it('doit retourner 200 avec status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body: Json = await res.json()
    expect(body.status).toBe('ok')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('uptime')
    expect(typeof body.uptime).toBe('number')
    expect(body).toHaveProperty('environment')
  })

  it('doit inclure le header X-Request-Id', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toBeDefined()
  })
})
