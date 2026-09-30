import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'

// biome-ignore lint/suspicious/noExplicitAny: test assertions on dynamic JSON
type Json = any

const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('X-Request-Id middleware', () => {
  let app: ReturnType<typeof createApp>['app']

  beforeAll(() => {
    app = createApp().app
  })

  it("doit générer un UUIDv7 quand aucun header n'est fourni", async () => {
    const res = await app.request('/health')
    const id = res.headers.get('x-request-id')
    expect(id).toBeDefined()
    expect(id).toMatch(UUIDV7_RE)
  })

  it('doit conserver un X-Request-Id UUIDv7 valide entrant', async () => {
    const incomingId = '018f3e5a-7b2c-7d4e-8a1f-3c5d7e9f1a2b'
    const res = await app.request('/health', {
      headers: { 'x-request-id': incomingId },
    })
    expect(res.headers.get('x-request-id')).toBe(incomingId)
  })

  it('doit rejeter un request id invalide et en générer un nouveau', async () => {
    const res = await app.request('/health', {
      headers: { 'x-request-id': 'not-a-uuid' },
    })
    const id = res.headers.get('x-request-id')
    expect(id).not.toBe('not-a-uuid')
    expect(id).toMatch(UUIDV7_RE)
  })

  it('doit rejeter un UUIDv4 (pas v7)', async () => {
    const v4 = '550e8400-e29b-41d4-a716-446655440000'
    const res = await app.request('/health', {
      headers: { 'x-request-id': v4 },
    })
    expect(res.headers.get('x-request-id')).not.toBe(v4)
  })

  it("doit inclure request_id dans les réponses d'erreur", async () => {
    const res = await app.request('/nonexistent')
    const body: Json = await res.json()
    const headerRequestId = res.headers.get('x-request-id')
    expect(body.error.request_id).toBe(headerRequestId)
  })
})
