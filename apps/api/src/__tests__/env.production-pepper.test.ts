/**
 * P2.2 — garde de production du pepper OTP (spec CA-33, cp-security « secrets »).
 *
 * `OTP_PEPPER` protège les codes SMS stockés (HMAC) et les clés de limite par numéro. Les valeurs publiées dans le dépôt
 * (valeur de développement de `.env.example`, constante de repli de `env.ts`, valeur de la CI) ne sont plus des secrets :
 * la production ne doit JAMAIS démarrer avec l'une d'elles. Ces tests sont ROUGES tant que `env.ts` ne les refuse pas.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const exampleLine = readFileSync(path.resolve(here, '../../../../.env.example'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('OTP_PEPPER='))
// « OTP_PEPPER=valeur   # [S] commentaire » : la valeur s'arrête au premier espace.
const ENV_EXAMPLE_PEPPER = exampleLine?.slice('OTP_PEPPER='.length).split(/\s/)[0] ?? ''
const DEV_FALLBACK_PEPPER = 'dev-only-otp-pepper-never-use-in-production-0000'
const CI_PEPPER = 'ci-only-otp-pepper-0123456789abcdef-not-a-secret'

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  return import('../env.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('OTP_PEPPER en production — valeurs publiques refusées', () => {
  it('la valeur de .env.example est bien lue et respecte la longueur minimale (précondition du test)', () => {
    expect(ENV_EXAMPLE_PEPPER.length).toBeGreaterThanOrEqual(32)
    expect(ENV_EXAMPLE_PEPPER).toBe(DEV_FALLBACK_PEPPER)
  })

  it.each([
    ['la valeur de .env.example', ENV_EXAMPLE_PEPPER],
    ['la constante de repli de développement de env.ts', DEV_FALLBACK_PEPPER],
    ['la valeur publique de la CI', CI_PEPPER],
  ])(
    '[DÉFAUT OUVERT] doit refuser en production %s, sans jamais citer sa valeur',
    async (_label, pepper) => {
      const { getEnv } = await loadEnv({
        NODE_ENV: 'production',
        SMS_PROVIDER: 'none',
        OTP_PEPPER: pepper,
      })
      let error: Error | undefined
      try {
        getEnv()
      } catch (err) {
        error = err as Error
      }
      expect(error, 'getEnv() devait lever une erreur').toBeDefined()
      expect(`${error?.message}\n${error?.stack ?? ''}\n${JSON.stringify(error)}`).not.toContain(
        pepper,
      )
    },
  )

  it('doit continuer à accepter un secret propre à l’environnement de production', async () => {
    const secret = `prod-${'q7Zr'.repeat(10)}`
    const { getEnv } = await loadEnv({
      NODE_ENV: 'production',
      SMS_PROVIDER: 'none',
      OTP_PEPPER: secret,
    })
    expect(getEnv().OTP_PEPPER).toBe(secret)
  })

  it('hors production, la valeur de développement reste acceptée (développement local et CI)', async () => {
    for (const nodeEnv of ['development', 'test']) {
      const { getEnv } = await loadEnv({ NODE_ENV: nodeEnv, OTP_PEPPER: ENV_EXAMPLE_PEPPER })
      expect(getEnv().OTP_PEPPER).toBe(ENV_EXAMPLE_PEPPER)
      vi.unstubAllEnvs()
    }
  })
})
