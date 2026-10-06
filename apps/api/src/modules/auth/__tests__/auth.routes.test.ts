import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetLimiters } from '../../../middlewares/rate-limit.js'

vi.mock('../../../env.js', () => ({
  getEnv: vi.fn(() => ({
    NODE_ENV: 'test',
    PORT: 4000,
    LOG_LEVEL: 'error',
    APP_URL: 'https://app.example.com',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_FROM: 'noreply@example.com',
    SESSION_COOKIE_NAME: 'cp_session',
    SESSION_MAX_AGE_SECONDS: 3600,
    SESSION_REMEMBER_MAX_AGE_SECONDS: 86400 * 30,
    TRUSTED_PROXY_HOPS: 0,
    REDIS_URL: 'redis://localhost:6379',
    OTEL_ENABLED: false,
    OTEL_SERVICE_NAME: 'cp-api',
  })),
  resetEnvCache: vi.fn(),
}))

vi.mock('../auth.repository.js', () => ({
  findUserByEmail: vi.fn().mockResolvedValue(null),
  createUserWithOrg: vi.fn().mockResolvedValue({
    userId: 1n,
    userPublicId: '01930000-0000-7000-8000-000000000001',
    orgId: 1n,
    orgPublicId: '01930000-0000-7000-8000-000000000002',
  }),
  createVerificationToken: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

vi.mock('../auth.password.js', async () => {
  const actual = await vi.importActual<typeof import('../auth.password.js')>('../auth.password.js')
  return {
    ...actual,
    hashPassword: vi.fn().mockResolvedValue('$argon2id$v=19$m=19456,t=2,p=1$hashed'),
  }
})

describe('auth routes — rate limit & IP', () => {
  beforeEach(() => {
    resetLimiters()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetLimiters()
  })

  it('x-forwarded-for ignoré quand TRUSTED_PROXY_HOPS=0', async () => {
    const { getEnv } = await import('../../../env.js')
    vi.mocked(getEnv).mockReturnValue({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_LEVEL: 'error',
      APP_URL: 'https://app.example.com',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_FROM: 'noreply@example.com',
      SESSION_COOKIE_NAME: 'cp_session',
      SESSION_MAX_AGE_SECONDS: 3600,
      SESSION_REMEMBER_MAX_AGE_SECONDS: 86400 * 30,
      TRUSTED_PROXY_HOPS: 0,
      REDIS_URL: 'redis://invalid:9999',
      OTEL_ENABLED: false,
      OTEL_SERVICE_NAME: 'cp-api',
    } as ReturnType<typeof getEnv>)

    const { createApp } = await import('../../../app.js')
    const { app } = createApp()

    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'StrongP@ss42!',
      }),
    })

    expect(res.status).not.toBe(429)
  })

  it('Redis indisponible — pas de 429 global (insurance limiter)', async () => {
    const { getEnv } = await import('../../../env.js')
    vi.mocked(getEnv).mockReturnValue({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_LEVEL: 'error',
      APP_URL: 'https://app.example.com',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_FROM: 'noreply@example.com',
      SESSION_COOKIE_NAME: 'cp_session',
      SESSION_MAX_AGE_SECONDS: 3600,
      SESSION_REMEMBER_MAX_AGE_SECONDS: 86400 * 30,
      TRUSTED_PROXY_HOPS: 0,
      REDIS_URL: 'redis://invalid:9999',
      OTEL_ENABLED: false,
      OTEL_SERVICE_NAME: 'cp-api',
    } as ReturnType<typeof getEnv>)

    const { createApp } = await import('../../../app.js')
    const { app } = createApp()

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.request('/v1/auth/register', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email: `user${i}@example.com`,
            password: 'StrongP@ss42!',
          }),
        }),
      ),
    )

    const rateLimited = responses.filter((r) => r.status === 429)
    expect(rateLimited).toHaveLength(0)
  })
})
