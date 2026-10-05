import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env.ts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('doit parser les valeurs par défaut', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { getEnv } = await import('../env.js')
    const env = getEnv()
    expect(env.NODE_ENV).toBe('test')
    expect(env.PORT).toBe(4000)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.OTEL_ENABLED).toBe(false)
    expect(env.OTEL_SERVICE_NAME).toBe('cp-api')
  })

  it('doit parser des valeurs personnalisées', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PORT', '3000')
    vi.stubEnv('LOG_LEVEL', 'error')
    vi.stubEnv('OTEL_ENABLED', 'true')
    vi.stubEnv('OTEL_SERVICE_NAME', 'my-api')
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://otel.example.com')
    const { getEnv } = await import('../env.js')
    const env = getEnv()
    expect(env.PORT).toBe(3000)
    expect(env.LOG_LEVEL).toBe('error')
    expect(env.OTEL_ENABLED).toBe(true)
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://otel.example.com')
  })

  it('doit transformer OTEL_ENABLED "1" en true', async () => {
    vi.stubEnv('OTEL_ENABLED', '1')
    const { getEnv } = await import('../env.js')
    expect(getEnv().OTEL_ENABLED).toBe(true)
  })

  it('doit transformer OTEL_ENABLED "0" en false', async () => {
    vi.stubEnv('OTEL_ENABLED', '0')
    const { getEnv } = await import('../env.js')
    expect(getEnv().OTEL_ENABLED).toBe(false)
  })

  it('doit rejeter un LOG_LEVEL invalide', async () => {
    vi.stubEnv('LOG_LEVEL', 'verbose')
    const { getEnv } = await import('../env.js')
    expect(() => getEnv()).toThrow()
  })

  it('doit rejeter un PORT négatif', async () => {
    vi.stubEnv('PORT', '-1')
    const { getEnv } = await import('../env.js')
    expect(() => getEnv()).toThrow()
  })

  it('doit mettre en cache le résultat', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { getEnv } = await import('../env.js')
    const first = getEnv()
    const second = getEnv()
    expect(first).toBe(second)
  })

  it('doit réinitialiser le cache avec resetEnvCache', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { getEnv, resetEnvCache } = await import('../env.js')
    const first = getEnv()
    resetEnvCache()
    vi.stubEnv('PORT', '5000')
    const second = getEnv()
    expect(first).not.toBe(second)
    expect(second.PORT).toBe(5000)
  })
})
