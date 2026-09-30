import { uuidv7 } from 'uuidv7'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function generatePublicId(): string {
  return uuidv7()
}

function assertUuid(publicId: string): void {
  if (!UUID_RE.test(publicId)) throw new TypeError('invalid public id')
}

export function extractTimestamp(publicId: string): Date {
  assertUuid(publicId)
  const hex = publicId.replace(/-/g, '').slice(0, 12)
  return new Date(Number.parseInt(hex, 16))
}

export function encodeCursor(publicId: string): string {
  assertUuid(publicId)
  return Buffer.from(publicId.replace(/-/g, ''), 'hex').toString('base64url')
}

/** Décode un curseur opaque ; lève TypeError si le curseur n'est pas un encodage valide (→ 400 côté API). */
export function decodeCursor(cursor: string): string {
  const bytes = Buffer.from(cursor, 'base64url')
  if (bytes.length !== 16 || bytes.toString('base64url') !== cursor) {
    throw new TypeError('invalid cursor')
  }
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
