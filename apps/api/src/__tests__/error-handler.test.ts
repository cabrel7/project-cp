import { HTTPException } from 'hono/http-exception'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { AppError } from '../lib/errors.js'

// biome-ignore lint/suspicious/noExplicitAny: test assertions on dynamic JSON
type Json = any

describe("onError (gestionnaire d'erreurs global)", () => {
  let app: ReturnType<typeof createApp>['app']

  beforeAll(() => {
    const created = createApp()
    app = created.app

    app.get('/test/app-error', () => {
      throw new AppError('AUTH_TOKEN_INVALID', { reason: 'expired' })
    })
    app.get('/test/unknown-error', () => {
      throw new Error('unexpected internal details')
    })
    app.get('/test/validation-error', () => {
      throw new AppError('PLATFORM_VALIDATION_ERROR', {
        issues: [{ path: ['name'], message: 'required' }],
      })
    })
    app.get('/test/server-details', () => {
      throw new AppError('PLATFORM_INTERNAL_ERROR', { sql: 'SELECT secret' })
    })
    app.post('/test/json', () => {
      throw new HTTPException(400, { message: 'Malformed JSON' })
    })
    app.get('/test/server-error', () => {
      throw new AppError('PLATFORM_INTERNAL_ERROR')
    })
  })

  it('doit formater AppError au format unique', async () => {
    const res = await app.request('/test/app-error')
    expect(res.status).toBe(401)
    const body: Json = await res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('AUTH_TOKEN_INVALID')
    expect(body.error.request_id).toBeDefined()
    expect(body.error.documentation_url).toContain('AUTH_TOKEN_INVALID')
    expect(body.error.details).toEqual({ reason: 'expired' })
  })

  it('doit retourner 500 pour les erreurs inconnues sans fuiter les détails', async () => {
    const res = await app.request('/test/unknown-error')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_INTERNAL_ERROR')
    expect(body.error.message).not.toContain('unexpected internal details')
    expect(body.error.request_id).toBeDefined()
    expect(body.error.documentation_url).toContain('PLATFORM_INTERNAL_ERROR')
  })

  it('doit retourner 422 pour les erreurs de validation avec issues', async () => {
    const res = await app.request('/test/validation-error')
    expect(res.status).toBe(422)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(body.error.details.issues).toBeDefined()
  })

  it('doit retourner 404 pour les routes inexistantes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_RESOURCE_NOT_FOUND')
    expect(body.error.request_id).toBeDefined()
    expect(body.error.documentation_url).toContain('PLATFORM_RESOURCE_NOT_FOUND')
  })

  it('doit logger en error pour les AppError 5xx', async () => {
    const res = await app.request('/test/server-error')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_INTERNAL_ERROR')
  })

  it('ne doit pas inclure de details quand ils sont absents', async () => {
    const res = await app.request('/test/server-error')
    const body: Json = await res.json()
    expect(body.error).not.toHaveProperty('details')
  })

  it('ne doit pas exposer details sur une erreur 5xx', async () => {
    const res = await app.request('/test/server-details')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.details).toBeUndefined()
  })

  it('doit renvoyer 4xx (pas 500) sur JSON malformé', async () => {
    const res = await app.request('/test/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    })
    expect(res.status).toBe(422)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_VALIDATION_ERROR')
  })
})
