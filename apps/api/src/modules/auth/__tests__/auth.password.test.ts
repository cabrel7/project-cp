import { describe, expect, it } from 'vitest'
import {
  dummyVerify,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../auth.password.js'

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('Str0ngP@ss')
    expect(hash).toContain('$argon2id$')
    expect(await verifyPassword(hash, 'Str0ngP@ss')).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('Str0ngP@ss')
    expect(await verifyPassword(hash, 'WrongPass1')).toBe(false)
  })
})

describe('dummyVerify', () => {
  it('does not throw', async () => {
    await expect(dummyVerify()).resolves.toBeUndefined()
  })
})

describe('validatePasswordStrength', () => {
  it.each([
    ['ValidPass1', true],
    ['abcdefgH1', true],
    ['short1A', false],
    ['nouppercase1', false],
    ['NOLOWERCASE1', false],
    ['NoDigitsHere', false],
    ['', false],
  ])('%s → %s', (pw, expected) => {
    expect(validatePasswordStrength(pw)).toBe(expected)
  })
})
