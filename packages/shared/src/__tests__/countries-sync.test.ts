/**
 * P2.2 — CA-4 : synchronisation `SUPPORTED_PHONE_COUNTRIES` ↔ seed SQL `ref.countries`
 * (le SQL fait foi ; même principe que `errors.test.ts`).
 *
 * Source lue : les `INSERT INTO ref.countries` des migrations dbmate (la baseline porte le seed).
 * Phase RED : le garde du parseur passe déjà (le seed existe) ; la comparaison échoue tant que
 * `../phone.js` est absent (chargement dynamique : un échec par test, pas un échec global).
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(here, '../../../../db/migrations')

interface CountryRow {
  code: string
  currency: string
  language: string
  phonePrefix: string
}

/**
 * Lignes du seed : `('CM', '{"fr":"Cameroun","en":"Cameroon"}', 'XAF', 'fr', '+237'),`
 * Les noms contiennent des apostrophes doublées (`Côte d''Ivoire`) : on ancre sur le code (début) et
 * sur les 3 derniers littéraux (devise, langue, indicatif).
 */
function parseSeedRows(sql: string): CountryRow[] {
  const start = sql.indexOf('INSERT INTO ref.countries')
  if (start === -1) return []
  const end = sql.indexOf('ON CONFLICT', start)
  const rows: CountryRow[] = []
  for (const line of sql.slice(start, end === -1 ? undefined : end).split(/\r?\n/)) {
    const m = line.match(
      /^\s*\('([A-Z]{2})'\s*,\s*'.*'\s*,\s*'([A-Z]{3})'\s*,\s*'([a-z]{2})'\s*,\s*'(\+\d{1,4})'\s*\)\s*,?\s*$/,
    )
    if (!m) continue
    const [, code, currency, language, phonePrefix] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
    ]
    rows.push({ code, currency, language, phonePrefix })
  }
  return rows
}

const seedRows: CountryRow[] = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .flatMap((f) => parseSeedRows(readFileSync(path.join(migrationsDir, f), 'utf8')))

const PHONE_MODULE_PATH = '../phone.js'
const loadPhone = async (): Promise<typeof import('../phone.js')> =>
  (await import(/* @vite-ignore */ PHONE_MODULE_PATH)) as typeof import('../phone.js')

describe('seed SQL ref.countries (garde du parseur)', () => {
  it('doit extraire les 15 pays du seed (sinon le test de synchro ne prouve rien)', () => {
    expect(seedRows).toHaveLength(15)
    expect(new Set(seedRows.map((r) => r.code)).size).toBe(15)
  })

  it('doit avoir un indicatif +NNN et une devise par pays', () => {
    for (const row of seedRows) {
      expect(row.phonePrefix, row.code).toMatch(/^\+\d{1,4}$/)
      expect(row.currency, row.code).toMatch(/^[A-Z]{3}$/)
    }
  })
})

describe('SUPPORTED_PHONE_COUNTRIES ↔ ref.countries (CA-4)', () => {
  it('doit contenir exactement les mêmes codes que le seed SQL ref.countries', async () => {
    const { SUPPORTED_PHONE_COUNTRIES } = await loadPhone()
    expect([...SUPPORTED_PHONE_COUNTRIES].sort()).toEqual(seedRows.map((r) => r.code).sort())
  })

  it('doit signaler précisément les pays manquants ou en trop de chaque côté', async () => {
    const { SUPPORTED_PHONE_COUNTRIES } = await loadPhone()
    const ts = new Set<string>(SUPPORTED_PHONE_COUNTRIES)
    const sql = new Set(seedRows.map((r) => r.code))
    expect({
      missingInTs: [...sql].filter((c) => !ts.has(c)),
      missingInSql: [...ts].filter((c) => !sql.has(c)),
    }).toEqual({ missingInTs: [], missingInSql: [] })
  })

  it('doit normaliser vers l’indicatif du seed SQL pour chaque pays (mobile d’exemple)', async () => {
    const { normalizePhone } = await loadPhone()
    // Un mobile valide par pays du seed : l'indicatif de l'E.164 doit être `phone_prefix` du seed.
    const SAMPLES: Record<string, string> = {
      CM: '690123442',
      CI: '0707123456',
      SN: '771234567',
      FR: '0612345678',
      BE: '0470123456',
      US: '4155552671',
    }
    for (const [country, national] of Object.entries(SAMPLES)) {
      const row = seedRows.find((r) => r.code === country)
      const result = normalizePhone(national, country as 'CM')
      expect(result.ok, `${country} ${national}`).toBe(true)
      if (result.ok) expect(result.e164.startsWith(row?.phonePrefix ?? '?'), country).toBe(true)
    }
  })
})
