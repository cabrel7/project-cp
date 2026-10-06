import { sha256 } from '@oslojs/crypto/sha2'

export function generateSessionToken(): { token: string; hash: Uint8Array } {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Buffer.from(bytes).toString('hex')
  return { token, hash: hashToken(token) }
}

export function generateVerificationToken(): { token: string; hash: Uint8Array } {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Buffer.from(bytes).toString('hex')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): Uint8Array {
  return sha256(new TextEncoder().encode(token))
}
