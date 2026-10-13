/**
 * P2.3 — CA-22 (partie unitaire) : `LOG_REDACT_PATHS` couvre les données de la connexion Google
 * (id_token, access_token, refresh_token, code_verifier, state, nonce, email, sub) et pino les masque.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '../env.js'
import { createLogger, LOG_REDACT_PATHS } from '../logger.js'

const captured = vi.hoisted(() => ({ lines: [] as string[] }))
vi.mock('pino', async (original) => {
  const actual = await original<typeof import('pino')>()
  const real = (actual as unknown as { default: typeof actual }).default
  const stream = { write: (l: string) => void captured.lines.push(l) }
  return {
    ...actual,
    default: Object.assign(
      (o?: unknown, d?: unknown) => real(o as never, (d ?? stream) as never),
      real,
    ),
  }
})

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('LOG_LEVEL', 'info')
  resetEnvCache()
})
afterAll(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('redaction pino de la connexion Google (CA-22)', () => {
  it.each([
    'id_token',
    'access_token',
    'refresh_token',
    'code_verifier',
    'state',
    'nonce',
    'email',
    'sub',
  ])('LOG_REDACT_PATHS doit contenir *.%s', (field) => {
    expect(LOG_REDACT_PATHS as readonly string[]).toContain(`*.${field}`)
  })

  it('doit masquer ces champs un niveau sous un objet sans effacer les champs publics (event, user, provider)', () => {
    captured.lines.length = 0
    createLogger().info(
      {
        event: 'google_signup',
        user: '0192f1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b',
        provider: 'google',
        body: {
          id_token: 'IDT',
          access_token: 'ACC',
          refresh_token: 'REF',
          code_verifier: 'VER',
          state: 'STA',
          nonce: 'NON',
          email: 'a@gmail.com',
          sub: 'SUB',
        },
      },
      'security_event',
    )
    const line = captured.lines.join('')
    for (const secret of ['IDT', 'ACC', 'REF', 'VER', 'STA', 'NON', 'a@gmail.com', 'SUB'])
      expect(line).not.toContain(secret)
    expect(line).toContain('google_signup')
    expect(line).toContain('0192f1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b')
  })
})
