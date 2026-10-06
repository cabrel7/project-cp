/**
 * P2.2 — CA-37 : journaux sans donnée personnelle (cp-security : redaction pino).
 * 1) unitaire : la configuration `redact` de `createLogger()` masque phone, code, password, token,
 *    cookie et authorization ;
 * 2) intégration (PostgreSQL réel + Redis réel) : sur le parcours complet demande → vérification fausse →
 *    vérification juste → 422 de validation, aucune ligne ne contient le numéro, le code ni le cookie.
 *
 * Le flux pino est capturé en enveloppant `pino` : les options de production (dont `redact`) sont
 * conservées, seul le flux de sortie est remplacé.
 */
import { getPoolRw } from '@cp/db'
import Redis from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import { resetEnvCache } from '../env.js'
import { createLogger } from '../logger.js'
import { resetLimiters } from '../middlewares/rate-limit.js'
import {
  extractCode,
  loadSrc,
  socketEnv,
  uniqueCmPhone,
  uniqueIp,
  wrongCodeFor,
} from '../modules/auth/__tests__/phone-test-utils.js'

const captured = vi.hoisted(() => ({ lines: [] as string[] }))

vi.mock('pino', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pino')>()
  const real = (actual as unknown as { default: typeof actual }).default
  const stream = {
    write: (line: string) => {
      captured.lines.push(line)
    },
  }
  const wrapped = Object.assign(
    (opts?: unknown, dest?: unknown) => real(opts as never, (dest ?? stream) as never),
    real,
  )
  return { ...actual, default: wrapped }
})

vi.mock('../modules/auth/auth.email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  resetTransport: vi.fn(),
}))

const PEPPER = 'l'.repeat(40)
const all = () => captured.lines.join('\n')

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('LOG_LEVEL', 'debug')
  vi.stubEnv('OTP_PEPPER', PEPPER)
  vi.stubEnv('SMS_PROVIDER', 'simulated')
  vi.stubEnv('TRUSTED_PROXY_HOPS', '0')
  resetEnvCache()
})

afterAll(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('configuration redact de createLogger (CA-37, unitaire)', () => {
  beforeEach(() => {
    captured.lines.length = 0
  })

  it('doit masquer phone, code, password et token un niveau sous un objet, sans effacer les autres champs', () => {
    const logger = createLogger()
    logger.info(
      {
        body: {
          phone: '+237690123442',
          code: '270512',
          password: 'Sup3r-secret!',
          token: 'tok-abc',
        },
        status: 422,
      },
      'probe',
    )
    const out = all()
    for (const secret of ['+237690123442', '690123442', '270512', 'Sup3r-secret!', 'tok-abc']) {
      expect(out).not.toContain(secret)
    }
    expect(out).toContain('"status":422')
    expect(out).toContain('probe')
  })

  it('doit masquer req.headers.cookie et req.headers.authorization', () => {
    const logger = createLogger()
    logger.info(
      {
        req: {
          headers: {
            cookie: 'cp_session=SECRETCOOKIE',
            authorization: 'Bearer SECRETBEARER',
            accept: 'x/y',
          },
        },
      },
      'probe',
    )
    const out = all()
    expect(out).not.toContain('SECRETCOOKIE')
    expect(out).not.toContain('SECRETBEARER')
    expect(out).toContain('x/y')
  })
})

const env = (k: string): string | undefined => process.env[k]
async function reachable(): Promise<boolean> {
  if (!env('DATABASE_URL_RW') || !env('DATABASE_URL_AUTH') || !env('DATABASE_URL_ADMIN'))
    return false
  const r = new Redis(env('REDIS_URL') ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  try {
    await getPoolRw()`SELECT 1`
    await r.connect()
    return (await r.ping()) === 'PONG'
  } catch {
    return false
  } finally {
    r.disconnect()
  }
}
const ready = await reachable()
if (env('CP_REQUIRE_INTEGRATION') && !ready) {
  throw new Error('CP_REQUIRE_INTEGRATION est défini mais PostgreSQL et/ou Redis est injoignable')
}

describe.skipIf(!ready)('Journaux sans donnée personnelle (PostgreSQL réel + Redis réel)', () => {
  it('CA-37 : demande, vérification fausse, vérification juste, 422 → aucune ligne ne contient numéro, code ni cookie', async () => {
    resetLimiters()
    captured.lines.length = 0
    const { app } = createApp()
    const sim =
      await loadSrc<typeof import('../modules/auth/sms/sms.simulated.js')>(
        '../sms/sms.simulated.js',
      )
    const p = uniqueCmPhone()
    const ip = uniqueIp()
    const call = (path: string, body: unknown) =>
      app.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
          body: JSON.stringify(body),
        },
        socketEnv(ip),
      )

    const r1 = await call('/v1/auth/phone/request-code', { phone: p.national, country: 'CM' })
    expect(r1.status).toBe(200)
    const mine = sim.getSimulatedOutbox().filter((m) => m.to === p.e164)
    const code = extractCode(mine[mine.length - 1]?.text ?? '')
    expect(
      (await call('/v1/auth/phone/verify-code', { phone: p.national, code: wrongCodeFor(code) }))
        .status,
    ).toBe(422)
    const ok = await call('/v1/auth/phone/verify-code', {
      phone: p.national,
      code,
      full_name: 'Awa Nkeng',
    })
    expect(ok.status).toBe(200)
    expect(
      (await call('/v1/auth/phone/request-code', { phone: '6 90 12 34', country: 'CM' })).status,
    ).toBe(422)
    const cookieValue = (ok.headers.get('set-cookie') ?? '').split(';')[0]?.split('=')[1] ?? ''
    expect(cookieValue.length).toBeGreaterThan(10)

    const out = all()
    expect(out.length).toBeGreaterThan(0) // le flux est bien capturé
    for (const secret of [p.national, p.e164, p.e164.slice(1), code, cookieValue, '6 90 12 34']) {
      expect(out, `fuite de « ${secret} »`).not.toContain(secret)
    }

    // nettoyage (chemin admin, comme les tests d'intégration)
    const { getPoolAdmin } = await import('@cp/db/admin')
    await getPoolAdmin().begin(async (tx) => {
      await tx`SET LOCAL ROLE app_admin`
      const ids = tx`SELECT id FROM iam.users WHERE phone_e164 = ${p.e164}`
      await tx`DELETE FROM iam.verification_tokens WHERE target = ${p.e164}`
      await tx`DELETE FROM iam.user_sessions WHERE user_id IN (${ids})`
      await tx`DELETE FROM iam.memberships WHERE user_id IN (${ids})`
      const orgs = tx`SELECT id FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await tx`DELETE FROM iam.environments WHERE organization_id IN (${orgs})`
      await tx`DELETE FROM iam.workspaces WHERE organization_id IN (${orgs})`
      await tx`DELETE FROM iam.organizations WHERE created_by_user_id IN (${ids})`
      await tx`DELETE FROM iam.users WHERE phone_e164 = ${p.e164}`
    })
  })
})
