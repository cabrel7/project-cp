import { hash, verify } from '@node-rs/argon2'

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  return verify(storedHash, password, ARGON2_OPTIONS)
}

export async function dummyVerify(): Promise<void> {
  const dummy =
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  await verify(dummy, 'dummy-password', ARGON2_OPTIONS).catch(() => {})
}

const MIN_LENGTH = 8
const HAS_UPPER = /[A-Z]/
const HAS_LOWER = /[a-z]/
const HAS_DIGIT = /\d/

export function validatePasswordStrength(password: string): boolean {
  return (
    password.length >= MIN_LENGTH &&
    HAS_UPPER.test(password) &&
    HAS_LOWER.test(password) &&
    HAS_DIGIT.test(password)
  )
}
