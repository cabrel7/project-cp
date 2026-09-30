import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

// Règle (CLAUDE.md invariant 8) : la config passe par le module d'environnement typé, validé par zod.
// getDbEnv() met son résultat en cache au niveau du module → chaque test recharge le module.

const VALID = {
  DATABASE_URL_RW: 'postgres://rw@localhost/db',
  DATABASE_URL_AUTH: 'postgres://auth@localhost/db',
  DATABASE_URL_ADMIN: 'postgres://admin@localhost/db',
} as const

const ALL_KEYS = [
  'DATABASE_URL_RW',
  'DATABASE_URL_AUTH',
  'DATABASE_URL_ADMIN',
  'NODE_ENV',
  'LOG_LEVEL',
  'DB_POOL_MAX_RW',
  'DB_POOL_MAX_AUTH',
  'DB_POOL_MAX_ADMIN',
] as const

/** Environnement hermétique : toutes les clés lues par env.ts sont d'abord supprimées, puis `env` appliqué. */
function setEnv(env: Record<string, string | undefined>) {
  for (const key of ALL_KEYS) vi.stubEnv(key, undefined)
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

async function loadGetDbEnv(env: Record<string, string | undefined>) {
  setEnv(env)
  const mod = await import('../env.js')
  return mod.getDbEnv
}

function zodIssuePaths(error: unknown): string[] {
  expect(error).toBeInstanceOf(ZodError)
  return (error as ZodError).issues.map((issue) => issue.path.join('.'))
}

describe('getDbEnv', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('nominal', () => {
    it('doit parser les variables valides et conserver les URLs telles quelles', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID })

      const env = getDbEnv()

      expect(env.DATABASE_URL_RW).toBe(VALID.DATABASE_URL_RW)
      expect(env.DATABASE_URL_AUTH).toBe(VALID.DATABASE_URL_AUTH)
      expect(env.DATABASE_URL_ADMIN).toBe(VALID.DATABASE_URL_ADMIN)
    })

    it('doit appliquer les valeurs par défaut (development, info, pools 10/3/5)', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID })

      const env = getDbEnv()

      expect(env.NODE_ENV).toBe('development')
      expect(env.LOG_LEVEL).toBe('info')
      expect(env.DB_POOL_MAX_RW).toBe(10)
      expect(env.DB_POOL_MAX_AUTH).toBe(3)
      expect(env.DB_POOL_MAX_ADMIN).toBe(5)
    })

    it('doit convertir les tailles de pool fournies en chaînes en nombres', async () => {
      const getDbEnv = await loadGetDbEnv({
        ...VALID,
        DB_POOL_MAX_RW: '20',
        DB_POOL_MAX_AUTH: '4',
        DB_POOL_MAX_ADMIN: '7',
      })

      const env = getDbEnv()

      expect(env.DB_POOL_MAX_RW).toBe(20)
      expect(env.DB_POOL_MAX_AUTH).toBe(4)
      expect(env.DB_POOL_MAX_ADMIN).toBe(7)
      expect(typeof env.DB_POOL_MAX_RW).toBe('number')
    })

    it.each(['development', 'production', 'test'] as const)(
      'doit accepter NODE_ENV=%s',
      async (nodeEnv) => {
        const getDbEnv = await loadGetDbEnv({ ...VALID, NODE_ENV: nodeEnv })

        expect(getDbEnv().NODE_ENV).toBe(nodeEnv)
      },
    )

    it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const)(
      'doit accepter LOG_LEVEL=%s',
      async (level) => {
        const getDbEnv = await loadGetDbEnv({ ...VALID, LOG_LEVEL: level })

        expect(getDbEnv().LOG_LEVEL).toBe(level)
      },
    )

    it('doit ignorer les variables inconnues de l environnement', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID, SOMETHING_ELSE: 'x' })

      const env = getDbEnv()

      expect(env).not.toHaveProperty('SOMETHING_ELSE')
    })
  })

  describe('URL absentes (moindre privilège : chaque app ne fournit que ses URL)', () => {
    it('ne doit pas lever à la lecture quand aucune URL n est définie', async () => {
      const getDbEnv = await loadGetDbEnv({})

      expect(getDbEnv().DATABASE_URL_ADMIN).toBeUndefined()
    })

    it.each(['DATABASE_URL_RW', 'DATABASE_URL_AUTH', 'DATABASE_URL_ADMIN'] as const)(
      'requireDbUrl doit lever une erreur désignant %s sans valeur secrète quand elle manque',
      async (missing) => {
        const env: Record<string, string | undefined> = { ...VALID }
        delete env[missing]
        setEnv(env)
        const mod = await import('../env.js')

        expect(() => mod.requireDbUrl(missing)).toThrow(`${missing} is required`)
      },
    )

    it('requireDbUrl doit retourner l URL quand elle est définie', async () => {
      setEnv({ ...VALID })
      const mod = await import('../env.js')

      expect(mod.requireDbUrl('DATABASE_URL_RW')).toBe(VALID.DATABASE_URL_RW)
    })
  })

  describe('valeurs invalides', () => {
    it.each(['0', '-1', '1.5', 'abc', ''])(
      'doit rejeter DB_POOL_MAX_RW=%j (entier strictement positif requis)',
      async (value) => {
        const getDbEnv = await loadGetDbEnv({ ...VALID, DB_POOL_MAX_RW: value })

        expect(() => getDbEnv()).toThrow(ZodError)
      },
    )

    it.each(['DB_POOL_MAX_AUTH', 'DB_POOL_MAX_ADMIN'] as const)(
      'doit rejeter %s=0',
      async (key) => {
        const getDbEnv = await loadGetDbEnv({ ...VALID, [key]: '0' })

        expect(zodIssuePaths(catchError(getDbEnv))).toEqual([key])
      },
    )

    it('doit rejeter un NODE_ENV hors énumération', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID, NODE_ENV: 'staging' })

      expect(zodIssuePaths(catchError(getDbEnv))).toEqual(['NODE_ENV'])
    })

    it('doit rejeter un LOG_LEVEL hors énumération', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID, LOG_LEVEL: 'verbose' })

      expect(zodIssuePaths(catchError(getDbEnv))).toEqual(['LOG_LEVEL'])
    })

    it('ne doit pas divulguer les mots de passe des URLs dans le message d erreur', async () => {
      const getDbEnv = await loadGetDbEnv({
        DATABASE_URL_RW: 'postgres://cp_rw:S3cr3tP4ss@localhost/db',
        DATABASE_URL_AUTH: 'postgres://cp_auth:S3cr3tP4ss@localhost/db',
        DATABASE_URL_ADMIN: 'postgres://cp_admin:S3cr3tP4ss@localhost/db',
        DB_POOL_MAX_RW: 'abc',
      })

      const error = catchError(getDbEnv)

      expect(error).toBeInstanceOf(ZodError)
      expect(String((error as ZodError).message)).not.toContain('S3cr3tP4ss')
      expect(JSON.stringify((error as ZodError).issues)).not.toContain('S3cr3tP4ss')
    })
  })

  describe('cache', () => {
    it('doit retourner le même objet aux appels suivants, même si l environnement change', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID })

      const first = getDbEnv()
      vi.stubEnv('DATABASE_URL_RW', 'postgres://autre@localhost/autre')
      vi.stubEnv('DB_POOL_MAX_RW', '99')
      const second = getDbEnv()

      expect(second).toBe(first)
      expect(second.DATABASE_URL_RW).toBe(VALID.DATABASE_URL_RW)
      expect(second.DB_POOL_MAX_RW).toBe(10)
    })

    it('ne doit pas mettre en cache un échec de validation (rechargement possible après correction)', async () => {
      const getDbEnv = await loadGetDbEnv({ ...VALID, DB_POOL_MAX_RW: 'abc' })
      expect(() => getDbEnv()).toThrow(ZodError)

      vi.stubEnv('DB_POOL_MAX_RW', '10')

      expect(getDbEnv().DATABASE_URL_RW).toBe(VALID.DATABASE_URL_RW)
    })

    it('doit repartir d un cache vide après vi.resetModules()', async () => {
      const first = (await loadGetDbEnv({ ...VALID }))()

      vi.resetModules()
      const second = (await loadGetDbEnv({ ...VALID, DB_POOL_MAX_RW: '42' }))()

      expect(first.DB_POOL_MAX_RW).toBe(10)
      expect(second.DB_POOL_MAX_RW).toBe(42)
    })
  })

  // Conception : DATABASE_URL_* est validé par z.string() : une chaîne vide (variable exportée mais
  // non renseignée, cas fréquent en CI/Docker) passe la validation et échoue plus tard, à la première
  // requête, avec un message peu clair. À activer quand le schéma exigera une URL postgres non vide.
  it.todo('doit rejeter une DATABASE_URL_* vide ou qui n est pas une URL postgres')
})

function catchError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error('la fonction aurait dû lever une erreur')
}
