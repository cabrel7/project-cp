import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'

// biome-ignore lint/suspicious/noExplicitAny: test assertions on dynamic JSON
type Json = any

describe('GET /openapi.json', () => {
  let app: ReturnType<typeof createApp>['app']

  beforeAll(() => {
    app = createApp().app
  })

  it('doit retourner une spec OpenAPI 3.1 valide', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body: Json = await res.json()
    expect(body.openapi).toBe('3.1.0')
    expect(body.info.title).toBe('project-cp API')
  })
})

describe('GET /docs', () => {
  let app: ReturnType<typeof createApp>['app']

  beforeAll(() => {
    app = createApp().app
  })

  it('doit retourner une page HTML', async () => {
    const res = await app.request('/docs')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})
