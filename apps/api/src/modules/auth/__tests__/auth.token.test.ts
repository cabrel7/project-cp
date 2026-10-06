import { describe, expect, it } from 'vitest'
import { generateSessionToken, generateVerificationToken, hashToken } from '../auth.token.js'

describe('generateSessionToken', () => {
  it('returns a 64-char hex token and a 32-byte hash', () => {
    const { token, hash } = generateSessionToken()
    expect(token).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true)
    expect(hash).toBeInstanceOf(Uint8Array)
    expect(hash.length).toBe(32)
  })

  it('generates unique tokens', () => {
    const a = generateSessionToken().token
    const b = generateSessionToken().token
    expect(a).not.toBe(b)
  })
})

describe('generateVerificationToken', () => {
  it('returns a 64-char hex token and a 32-byte hash', () => {
    const { token, hash } = generateVerificationToken()
    expect(token).toHaveLength(64)
    expect(hash.length).toBe(32)
  })
})

describe('hashToken', () => {
  it('produces consistent hashes', () => {
    const h1 = hashToken('abc')
    const h2 = hashToken('abc')
    expect(Buffer.from(h1).toString('hex')).toBe(Buffer.from(h2).toString('hex'))
  })

  it('produces different hashes for different inputs', () => {
    const h1 = hashToken('abc')
    const h2 = hashToken('def')
    expect(Buffer.from(h1).toString('hex')).not.toBe(Buffer.from(h2).toString('hex'))
  })
})
