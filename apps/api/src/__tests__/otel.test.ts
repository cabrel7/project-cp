import { describe, expect, it } from 'vitest'
import { ignoreIncomingRequest } from '../otel.js'

describe('ignoreIncomingRequest (C14)', () => {
  it('doit ignorer le rappel Google, avec sa requête (code, state)', () => {
    expect(
      ignoreIncomingRequest({ url: '/v1/auth/oauth/google/callback?code=abc&state=def' }),
    ).toBe(true)
    expect(ignoreIncomingRequest({ url: '/v1/auth/oauth/google/callback' })).toBe(true)
  })

  it('ne doit pas ignorer les autres requêtes', () => {
    expect(ignoreIncomingRequest({ url: '/v1/auth/me' })).toBe(false)
    expect(ignoreIncomingRequest({})).toBe(false)
  })
})
