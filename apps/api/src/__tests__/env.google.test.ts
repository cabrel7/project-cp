/**
 * P2.3 — CA-2 : configuration Google de l'API (`env.ts`, seul lecteur de `process.env`).
 * Règles (spec §3.5) : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont facultatifs MAIS « les deux ou aucun » ;
 * chaîne vide = absente ; identifiant en `.apps.googleusercontent.com` ; secret de 16 caractères au moins ;
 * en production, Google configuré exige APP_URL en https. Les messages citent le NOM de la variable, jamais sa VALEUR
 * (le secret vient d'Infisical). Pas de GOOGLE_REDIRECT_URI (la `redirect_uri` découle d'APP_URL).
 *
 * Tout test qui simule NODE_ENV=production fournit TOUTES les variables obligatoires en production
 * (ISSUES.log 2026-10-12) ; ce fichier passe aussi en `env -i`.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

// Valeurs fictives assemblées à l'exécution : un littéral entier ressemble à un vrai secret (push protection)
const CLIENT_ID = `cp-test-1234567890-abcdefgh${'.apps.google'}${'usercontent.com'}`
const CLIENT_SECRET = `${'GOC'}${'SPX'}-test-secret-0123456789abcdef`
const PROD_BASE = {
  NODE_ENV: 'production',
  SMS_PROVIDER: 'none',
  APP_URL: 'https://app.example.com',
  TRUSTED_PROXY_HOPS: '1',
  OTP_PEPPER: `prod-${'q7Zr'.repeat(10)}`,
}
const MODES = ['development', 'test', 'production'] as const

/** Variables de base valides pour le mode demandé (production : toutes les variables obligatoires). */
const base = (mode: (typeof MODES)[number]): Record<string, string> =>
  mode === 'production' ? { ...PROD_BASE } : { NODE_ENV: mode }

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules()
  // Aucune variable Google héritée du shell (session : `source .env.example`).
  vi.stubEnv('GOOGLE_CLIENT_ID', undefined)
  vi.stubEnv('GOOGLE_CLIENT_SECRET', undefined)
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  return import('../env.js')
}

function failure(fn: () => unknown): Error | undefined {
  try {
    fn()
  } catch (err) {
    return err as Error
  }
  return undefined
}

/** Texte complet d'une erreur (message, pile, sérialisation) : aucune valeur de variable n'y figure. */
const dump = (e: Error | undefined) =>
  `${e?.message}\n${e?.stack ?? ''}\n${JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}))}`

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — les deux ou aucun (CA-2)', () => {
  it.each(MODES)(
    'doit lever une erreur en %s quand seul GOOGLE_CLIENT_ID est défini, sans citer de valeur',
    async (mode) => {
      const { getEnv } = await loadEnv({ ...base(mode), GOOGLE_CLIENT_ID: CLIENT_ID })
      const error = failure(() => getEnv())
      expect(error, 'getEnv() devait lever une erreur').toBeDefined()
      expect(dump(error)).toMatch(/GOOGLE_CLIENT_(ID|SECRET)/)
      expect(dump(error)).not.toContain(CLIENT_ID)
    },
  )

  it.each(MODES)(
    'doit lever une erreur en %s quand seul GOOGLE_CLIENT_SECRET est défini, sans citer de valeur',
    async (mode) => {
      const { getEnv } = await loadEnv({ ...base(mode), GOOGLE_CLIENT_SECRET: CLIENT_SECRET })
      const error = failure(() => getEnv())
      expect(error, 'getEnv() devait lever une erreur').toBeDefined()
      expect(dump(error)).toMatch(/GOOGLE_CLIENT_(ID|SECRET)/)
      expect(dump(error)).not.toContain(CLIENT_SECRET)
    },
  )

  it.each(MODES)(
    'doit désactiver Google sans erreur en %s quand les deux sont absents',
    async (mode) => {
      const { getEnv } = await loadEnv(base(mode))
      const env = getEnv() as Record<string, unknown>
      expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
      expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined()
    },
  )

  it.each(MODES)(
    'doit traiter deux chaînes vides comme absentes en %s (Google désactivé, pas d’erreur)',
    async (mode) => {
      const { getEnv } = await loadEnv({
        ...base(mode),
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      })
      const env = getEnv() as Record<string, unknown>
      expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
      expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined()
    },
  )

  it('doit lever une erreur quand un seul des deux est vide (chaîne vide = absente = partiel)', async () => {
    const { getEnv } = await loadEnv({
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: '',
    })
    expect(
      failure(() => getEnv()),
      'getEnv() devait lever une erreur',
    ).toBeDefined()
  })

  it.each(MODES)('doit accepter en %s un couple valide', async (mode) => {
    const { getEnv } = await loadEnv({
      ...base(mode),
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    })
    const env = getEnv() as Record<string, unknown>
    expect(env.GOOGLE_CLIENT_ID).toBe(CLIENT_ID)
    expect(env.GOOGLE_CLIENT_SECRET).toBe(CLIENT_SECRET)
  })
})

describe('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — formats (CA-2)', () => {
  it.each([
    ['sans le suffixe .apps.googleusercontent.com', '1234567890-abcdefgh'],
    ['avec un autre domaine', '1234567890-abcdefgh.apps.example.com'],
    ['avec le suffixe en milieu de chaîne', 'x.apps.googleusercontent.com.evil.test'],
  ])('doit refuser un identifiant %s, sans citer sa valeur', async (_label, id) => {
    const { getEnv } = await loadEnv({
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: id,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    })
    const error = failure(() => getEnv())
    expect(error, 'getEnv() devait lever une erreur').toBeDefined()
    expect(dump(error)).toContain('GOOGLE_CLIENT_ID')
    expect(dump(error)).not.toContain(id)
    expect(dump(error)).not.toContain(CLIENT_SECRET)
  })

  it('doit refuser un secret de moins de 16 caractères et accepter 16 caractères exactement', async () => {
    const short = 'x'.repeat(15)
    const { getEnv } = await loadEnv({
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: short,
    })
    const error = failure(() => getEnv())
    expect(error, 'getEnv() devait lever une erreur').toBeDefined()
    expect(dump(error)).toContain('GOOGLE_CLIENT_SECRET')
    expect(dump(error)).not.toContain(short)

    const sixteen = 'y'.repeat(16)
    const ok = await loadEnv({
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: sixteen,
    })
    expect(failure(() => ok.getEnv())).toBeUndefined()
  })
})

describe('APP_URL en production quand Google est configuré (CA-2)', () => {
  it('doit refuser APP_URL en http, sans citer de secret, quand Google est configuré en production', async () => {
    const { getEnv } = await loadEnv({
      ...PROD_BASE,
      APP_URL: 'http://app.example.com',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    })
    const error = failure(() => getEnv())
    expect(error, 'getEnv() devait lever une erreur').toBeDefined()
    expect(dump(error)).toContain('APP_URL')
    expect(dump(error)).not.toContain(CLIENT_SECRET)
    expect(dump(error)).not.toContain(CLIENT_ID)
  })

  it('doit accepter APP_URL en https quand Google est configuré en production', async () => {
    const { getEnv } = await loadEnv({
      ...PROD_BASE,
      APP_URL: 'https://app.example.com',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    })
    expect(failure(() => getEnv())).toBeUndefined()
  })

  it('doit accepter APP_URL en http hors production, Google configuré (développement local)', async () => {
    const { getEnv } = await loadEnv({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    })
    expect(failure(() => getEnv())).toBeUndefined()
  })

  it('ne doit pas exiger https quand Google n’est pas configuré (la règle ne vise que Google)', async () => {
    const { getEnv } = await loadEnv({ ...PROD_BASE, APP_URL: 'http://app.example.com' })
    expect(failure(() => getEnv())).toBeUndefined()
  })
})

describe('.env.example (spec §3.5)', () => {
  const lines = readFileSync(path.resolve(here, '../../../../.env.example'), 'utf8').split('\n')
  /** « NOM=valeur   # commentaire » : la valeur s'arrête au premier blanc. */
  const exampleValue = (name: string): string | undefined => {
    const line = lines.find((l) => l.startsWith(`${name}=`))
    return line === undefined ? undefined : (line.slice(name.length + 1).split(/\s/)[0] ?? '')
  }

  it('doit déclarer GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET, VIDES (aucun secret commité)', () => {
    expect(exampleValue('GOOGLE_CLIENT_ID')).toBe('')
    expect(exampleValue('GOOGLE_CLIENT_SECRET')).toBe('')
  })

  it('doit marquer GOOGLE_CLIENT_SECRET comme secret [S]', () => {
    const line = lines.find((l) => l.startsWith('GOOGLE_CLIENT_SECRET=')) ?? ''
    expect(line).toContain('[S]')
  })

  it('ne doit pas déclarer GOOGLE_REDIRECT_URI (source unique : APP_URL)', () => {
    expect(lines.some((l) => l.startsWith('GOOGLE_REDIRECT_URI'))).toBe(false)
  })
})
