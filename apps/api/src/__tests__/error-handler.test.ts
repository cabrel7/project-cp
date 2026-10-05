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
    app.get('/test/http-401', () => {
      throw new HTTPException(401, { message: 'Unauthorized' })
    })
    app.get('/test/http-404', () => {
      throw new HTTPException(404, { message: 'Not found' })
    })
    app.get('/test/http-429', () => {
      throw new HTTPException(429, { message: 'Too many requests' })
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
    expect(body.error.documentation_url).toContain('/errors/auth_token_invalid')
    expect(body.error.details).toEqual({ reason: 'expired' })
  })

  it('doit retourner 500 pour les erreurs inconnues sans fuiter les détails', async () => {
    const res = await app.request('/test/unknown-error')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_INTERNAL_ERROR')
    expect(body.error.message).not.toContain('unexpected internal details')
    expect(body.error.request_id).toBeDefined()
    expect(body.error.documentation_url).toContain('/errors/platform_internal_error')
    expect(body.error.details).toEqual({})
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
    expect(body.error.documentation_url).toContain('/errors/platform_resource_not_found')
    expect(body.error.details).toEqual({})
  })

  it('doit logger en error pour les AppError 5xx', async () => {
    const res = await app.request('/test/server-error')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_INTERNAL_ERROR')
  })

  it('doit retourner details vide sur une erreur 5xx sans details', async () => {
    const res = await app.request('/test/server-error')
    const body: Json = await res.json()
    expect(body.error.details).toEqual({})
  })

  it('ne doit pas exposer details internes sur une erreur 5xx', async () => {
    const res = await app.request('/test/server-details')
    expect(res.status).toBe(500)
    const body: Json = await res.json()
    expect(body.error.details).toEqual({})
  })

  it('doit mapper HTTPException 401 vers AUTH_TOKEN_INVALID', async () => {
    const res = await app.request('/test/http-401')
    expect(res.status).toBe(401)
    const body: Json = await res.json()
    expect(body.error.code).toBe('AUTH_TOKEN_INVALID')
    expect(body.error.details).toEqual({})
  })

  it('doit mapper HTTPException 404 vers PLATFORM_RESOURCE_NOT_FOUND', async () => {
    const res = await app.request('/test/http-404')
    expect(res.status).toBe(404)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_RESOURCE_NOT_FOUND')
    expect(body.error.details).toEqual({})
  })

  it('doit mapper HTTPException 429 vers PLATFORM_RATE_LIMIT', async () => {
    const res = await app.request('/test/http-429')
    expect(res.status).toBe(429)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_RATE_LIMIT')
    expect(body.error.details).toEqual({})
  })

  it('doit renvoyer 4xx (pas 500) sur JSON malformé', async () => {
    const res = await app.request('/test/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    })
    expect(res.status).toBe(400)
    const body: Json = await res.json()
    expect(body.error.code).toBe('PLATFORM_VALIDATION_ERROR')
    expect(body.error.details).toEqual({})
  })
})
