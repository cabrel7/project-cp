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

/**
 * P2.2 — CA-33 : SMS_PROVIDER et OTP_PEPPER (spec §3.5).
 * Chaque test fixe explicitement NODE_ENV / SMS_PROVIDER / OTP_PEPPER (valeur `undefined` = variable
 * absente) pour ne dépendre ni de l'environnement du shell (.env.example chargé) ni de la CI.
 */
describe('env.ts — SMS_PROVIDER et OTP_PEPPER (CA-33)', () => {
  const PEPPER_32 = 'p'.repeat(32)
  const PEPPER_31 = 'q'.repeat(31)

  function stub(vars: { NODE_ENV: string; SMS_PROVIDER?: string; OTP_PEPPER?: string }) {
    vi.stubEnv('NODE_ENV', vars.NODE_ENV)
    vi.stubEnv('SMS_PROVIDER', vars.SMS_PROVIDER)
    vi.stubEnv('OTP_PEPPER', vars.OTP_PEPPER)
  }

  async function load() {
    vi.resetModules()
    return (await import('../env.js')) as typeof import('../env.js')
  }

  function thrownBy(fn: () => unknown): Error {
    try {
      fn()
    } catch (err) {
      return err as Error
    }
    throw new Error('getEnv() devait lever une erreur')
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each(['development', 'test'])(
    'doit utiliser SMS_PROVIDER=simulated et un OTP_PEPPER de dev (>= 32 car.) par défaut en %s',
    async (nodeEnv) => {
      stub({ NODE_ENV: nodeEnv })
      const { getEnv } = await load()
      const env = getEnv()
      expect(env.SMS_PROVIDER).toBe('simulated')
      expect(env.OTP_PEPPER.length).toBeGreaterThanOrEqual(32)
    },
  )

  it('doit refuser SMS_PROVIDER=simulated en production, même avec un pepper valide', async () => {
    stub({ NODE_ENV: 'production', SMS_PROVIDER: 'simulated', OTP_PEPPER: PEPPER_32 })
    const { getEnv } = await load()
    expect(() => getEnv()).toThrow()
  })

  it('doit refuser la production sans OTP_PEPPER (pas de valeur de dev par défaut)', async () => {
    stub({ NODE_ENV: 'production', SMS_PROVIDER: 'none' })
    const { getEnv } = await load()
    expect(() => getEnv()).toThrow()
  })

  it('doit refuser en production un OTP_PEPPER de 31 caractères sans jamais citer sa valeur', async () => {
    stub({ NODE_ENV: 'production', SMS_PROVIDER: 'none', OTP_PEPPER: PEPPER_31 })
    const { getEnv } = await load()
    const err = thrownBy(() => getEnv())
    expect(`${err.message}\n${err.stack ?? ''}\n${JSON.stringify(err)}`).not.toContain(PEPPER_31)
  })

  it('doit accepter en production SMS_PROVIDER=none avec un OTP_PEPPER d’exactement 32 caractères', async () => {
    stub({ NODE_ENV: 'production', SMS_PROVIDER: 'none', OTP_PEPPER: PEPPER_32 })
    const { getEnv } = await load()
    const env = getEnv()
    expect(env.SMS_PROVIDER).toBe('none')
    expect(env.OTP_PEPPER).toBe(PEPPER_32)
  })

  it('doit utiliser SMS_PROVIDER=none par défaut en production', async () => {
    stub({ NODE_ENV: 'production', OTP_PEPPER: PEPPER_32 })
    const { getEnv } = await load()
    expect(getEnv().SMS_PROVIDER).toBe('none')
  })

  it('doit refuser un SMS_PROVIDER inconnu', async () => {
    stub({ NODE_ENV: 'development', SMS_PROVIDER: 'twilio' })
    const { getEnv } = await load()
    expect(() => getEnv()).toThrow()
  })

  it('doit refuser un OTP_PEPPER de moins de 32 caractères même hors production', async () => {
    stub({ NODE_ENV: 'development', OTP_PEPPER: PEPPER_31 })
    const { getEnv } = await load()
    expect(() => getEnv()).toThrow()
  })

  it('doit accepter SMS_PROVIDER=none en développement', async () => {
    stub({ NODE_ENV: 'development', SMS_PROVIDER: 'none' })
    const { getEnv } = await load()
    expect(getEnv().SMS_PROVIDER).toBe('none')
  })

  it('ne doit jamais citer la valeur du pepper dans l’erreur « production + simulated »', async () => {
    const secret = 's3cr3t-'.repeat(6)
    stub({ NODE_ENV: 'production', SMS_PROVIDER: 'simulated', OTP_PEPPER: secret })
    const { getEnv } = await load()
    const err = thrownBy(() => getEnv())
    expect(`${err.message}\n${err.stack ?? ''}`).not.toContain(secret)
  })
})
