import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ERROR_CODES,
  type ErrorCategory,
  type ErrorCode,
  type ErrorCodeDef,
  getErrorCode,
  isRetryable,
} from '../errors.js'

const CATEGORIES: readonly ErrorCategory[] = [
  'AUTH',
  'BILLING',
  'MCP',
  'AGENT',
  'LLM',
  'MARKET',
  'WEBHOOK',
  'IDEMPOTENCY',
  'PLATFORM',
  'GUARDRAIL',
]

const ALL_CODES = Object.keys(ERROR_CODES) as ErrorCode[]
const ALL_DEFS = Object.values(ERROR_CODES) as ErrorCodeDef[]

describe('ERROR_CODES', () => {
  it('doit contenir exactement 62 codes (57 initiaux + 5 garde-fous)', () => {
    expect(ALL_CODES).toHaveLength(62)
  })

  it('doit avoir des codes tous distincts', () => {
    expect(new Set(ALL_DEFS.map((d) => d.code)).size).toBe(62)
  })

  it.each(ALL_CODES)('doit faire correspondre la clé %s à sa propriété .code', (key) => {
    expect(ERROR_CODES[key].code).toBe(key)
  })

  it.each(ALL_CODES)('doit respecter le format SQL du code %s (CHECK ^[A-Z][A-Z0-9_]+$)', (key) => {
    expect(key).toMatch(/^[A-Z][A-Z0-9_]+$/)
  })

  it('doit contenir les codes critiques de la règle §8/§9 (flag vs plan, arrêt d’urgence, idempotence)', () => {
    for (const code of [
      'PLATFORM_FEATURE_NOT_AVAILABLE',
      'PLATFORM_FEATURE_DISABLED',
      'EMERGENCY_STOP_ACTIVE',
      'IDEMPOTENCY_KEY_REUSED',
      'BILLING_INSUFFICIENT_CREDITS',
      'BILLING_BUDGET_EXCEEDED',
      'AGENT_MAX_ITERATIONS_REACHED',
      'AGENT_NESTING_TOO_DEEP',
      'AGENT_TIMEOUT',
    ]) {
      expect(ERROR_CODES).toHaveProperty(code)
    }
  })

  it('doit distinguer le refus de plan (403) du refus de flag (403) par deux codes différents', () => {
    expect(ERROR_CODES.PLATFORM_FEATURE_NOT_AVAILABLE.code).not.toBe(
      ERROR_CODES.PLATFORM_FEATURE_DISABLED.code,
    )
  })

  it('doit couvrir au moins un code par catégorie déclarée', () => {
    const used = new Set(ALL_DEFS.map((d) => d.category))
    for (const category of CATEGORIES) {
      expect(used.has(category)).toBe(true)
    }
  })

  it('doit utiliser uniquement des catégories valides', () => {
    for (const def of ALL_DEFS) {
      expect(CATEGORIES).toContain(def.category)
    }
  })

  it('doit préfixer chaque code par sa catégorie (sauf EMERGENCY_STOP_ACTIVE, catégorie GUARDRAIL)', () => {
    for (const def of ALL_DEFS) {
      if (def.code === 'EMERGENCY_STOP_ACTIVE') {
        expect(def.category).toBe('GUARDRAIL')
      } else {
        expect(def.code.startsWith(`${def.category}_`)).toBe(true)
      }
    }
  })

  it('doit avoir un statut HTTP entier dans les plages 2xx, 4xx ou 5xx', () => {
    for (const def of ALL_DEFS) {
      expect(Number.isInteger(def.httpStatus)).toBe(true)
      const ok2xx = def.httpStatus >= 200 && def.httpStatus <= 299
      const ok4xx = def.httpStatus >= 400 && def.httpStatus <= 499
      const ok5xx = def.httpStatus >= 500 && def.httpStatus <= 599
      expect(ok2xx || ok4xx || ok5xx, `${def.code} → ${def.httpStatus}`).toBe(true)
    }
  })

  it('doit réserver le 2xx aux seules attentes d’approbation (202)', () => {
    const twoXx = ALL_DEFS.filter((d) => d.httpStatus < 300).map((d) => d.code)
    expect(twoXx.sort()).toEqual(['AGENT_AWAITING_APPROVAL', 'MCP_TOOL_REQUIRES_APPROVAL'])
    for (const code of twoXx) {
      expect(ERROR_CODES[code as ErrorCode].httpStatus).toBe(202)
    }
  })

  it('doit utiliser les statuts de la règle pour les refus clés', () => {
    expect(ERROR_CODES.AUTH_TOKEN_INVALID.httpStatus).toBe(401)
    expect(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS.httpStatus).toBe(403)
    expect(ERROR_CODES.PLATFORM_FEATURE_NOT_AVAILABLE.httpStatus).toBe(403)
    expect(ERROR_CODES.PLATFORM_FEATURE_DISABLED.httpStatus).toBe(403)
    expect(ERROR_CODES.PLATFORM_VALIDATION_ERROR.httpStatus).toBe(422)
    expect(ERROR_CODES.PLATFORM_RATE_LIMIT.httpStatus).toBe(429)
    expect(ERROR_CODES.IDEMPOTENCY_KEY_REUSED.httpStatus).toBe(409)
    expect(ERROR_CODES.BILLING_INSUFFICIENT_CREDITS.httpStatus).toBe(402)
    expect(ERROR_CODES.EMERGENCY_STOP_ACTIVE.httpStatus).toBe(503)
  })

  it('doit avoir des drapeaux booléens isRetryable et refundsCredits', () => {
    for (const def of ALL_DEFS) {
      expect(typeof def.isRetryable).toBe('boolean')
      expect(typeof def.refundsCredits).toBe('boolean')
    }
  })

  it('doit rembourser les crédits uniquement sur les pannes côté plateforme ou fournisseur', () => {
    const refunding = ALL_DEFS.filter((d) => d.refundsCredits)
      .map((d) => d.code)
      .sort()
    expect(refunding).toEqual([
      'LLM_PROVIDER_UNAVAILABLE',
      'MCP_CONNECTOR_TIMEOUT',
      'MCP_CONNECTOR_UNREACHABLE',
      'PLATFORM_INTERNAL_ERROR',
    ])
  })

  it('doit ne jamais rembourser sans que le code soit relançable', () => {
    for (const def of ALL_DEFS.filter((d) => d.refundsCredits)) {
      expect(def.isRetryable, def.code).toBe(true)
    }
  })

  it('doit être typé de sorte que ErrorCode couvre toutes les clés', () => {
    expectTypeOf<ErrorCode>().toEqualTypeOf<keyof typeof ERROR_CODES>()
    expectTypeOf<'PLATFORM_CONFLICT'>().toExtend<ErrorCode>()
    expectTypeOf<'NOT_A_CODE'>().not.toExtend<ErrorCode>()
    expectTypeOf(ERROR_CODES.AUTH_TOKEN_INVALID).toExtend<ErrorCodeDef>()
  })
})

describe('getErrorCode', () => {
  it('doit retourner la définition quand le code est connu', () => {
    const def = getErrorCode('BILLING_INSUFFICIENT_CREDITS')
    expect(def).toBe(ERROR_CODES.BILLING_INSUFFICIENT_CREDITS)
    expect(def).toEqual({
      code: 'BILLING_INSUFFICIENT_CREDITS',
      category: 'BILLING',
      httpStatus: 402,
      isRetryable: false,
      refundsCredits: false,
    })
  })

  it('doit retourner undefined quand le code est inconnu', () => {
    expect(getErrorCode('NOT_A_REAL_CODE')).toBeUndefined()
    expect(getErrorCode('')).toBeUndefined()
    expect(getErrorCode('auth_token_invalid')).toBeUndefined()
  })

  it('doit retourner undefined pour les clés héritées du prototype', () => {
    expect(getErrorCode('toString')).toBeUndefined()
    expect(getErrorCode('constructor')).toBeUndefined()
    expect(getErrorCode('__proto__')).toBeUndefined()
    expect(getErrorCode('hasOwnProperty')).toBeUndefined()
  })
})

describe('isRetryable', () => {
  it.each([
    'BILLING_PAYMENT_PENDING',
    'MCP_CONNECTOR_UNREACHABLE',
    'MCP_CONNECTOR_TIMEOUT',
    'MCP_CIRCUIT_BREAKER_OPEN',
    'MCP_BRIDGE_OFFLINE',
    'AGENT_ALREADY_RUNNING',
    'LLM_PROVIDER_UNAVAILABLE',
    'LLM_PROVIDER_RATE_LIMITED',
    'PLATFORM_RATE_LIMIT',
    'PLATFORM_MAINTENANCE',
    'PLATFORM_INTERNAL_ERROR',
  ] as const)('doit retourner true pour le code relançable %s', (code) => {
    expect(isRetryable(code)).toBe(true)
  })

  it.each([
    'AUTH_TOKEN_INVALID',
    'BILLING_INSUFFICIENT_CREDITS',
    'MCP_TOOL_INPUT_INVALID',
    'AGENT_TIMEOUT',
    'PLATFORM_FEATURE_NOT_AVAILABLE',
    'PLATFORM_VALIDATION_ERROR',
    'IDEMPOTENCY_KEY_REUSED',
    'GUARDRAIL_ACTION_BLOCKED',
    'EMERGENCY_STOP_ACTIVE',
  ] as const)('doit retourner false pour le code non relançable %s', (code) => {
    expect(isRetryable(code)).toBe(false)
  })

  it('doit être cohérent avec la définition pour les 62 codes', () => {
    for (const code of ALL_CODES) {
      expect(isRetryable(code)).toBe(ERROR_CODES[code].isRetryable)
    }
  })
})

/**
 * Synchronisation avec le SQL (le SQL fait foi) : `platform.error_codes` est alimentée
 * par deux seeds. Toute dérive entre l'énumération TypeScript et ces seeds est une erreur.
 */
describe('synchronisation ERROR_CODES ↔ seeds SQL platform.error_codes', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(here, '../../../..')
  const seed950 = path.join(repoRoot, 'db/schema-v1.2/950_seed_reference.sql')
  const seed960 = path.join(repoRoot, 'db/schema-v1.2/960_seed_ai_system.sql')

  interface SqlRow {
    code: string
    category: string
    httpStatus: number
    isRetryable: boolean
    refundsCredits: boolean
  }

  /** Isole le bloc `INSERT INTO platform.error_codes … ON CONFLICT` d'un seed. */
  function extractBlock(sql: string): string[] {
    const start = sql.indexOf('INSERT INTO platform.error_codes')
    if (start === -1) throw new Error('bloc INSERT INTO platform.error_codes introuvable')
    const end = sql.indexOf('ON CONFLICT', start)
    if (end === -1) throw new Error('ON CONFLICT introuvable après le bloc error_codes')
    return sql.slice(start, end).split(/\r?\n/)
  }

  /**
   * 950 : ('CODE',status,'fr','en',retryable,refunds) — catégorie = split_part(code,'_',1).
   * Les messages contiennent virgules et apostrophes doublées : on ancre sur le début
   * (code, statut) et sur la fin (deux booléens) de la ligne.
   */
  function parse950(sql: string): SqlRow[] {
    const rows: SqlRow[] = []
    for (const line of extractBlock(sql)) {
      const m = line.match(
        /^\s*\('([A-Z][A-Z0-9_]+)'\s*,\s*(\d+)\s*,.*,\s*(true|false)\s*,\s*(true|false)\s*\)\s*,?\s*$/,
      )
      if (!m) continue
      const [, code, status, rt, rf] = m as unknown as [string, string, string, string, string]
      rows.push({
        code,
        category: code.split('_')[0] as string,
        httpStatus: Number(status),
        isRetryable: rt === 'true',
        refundsCredits: rf === 'true',
      })
    }
    return rows
  }

  /** 960 : ('CODE', status, 'fr', 'en') — catégorie GUARDRAIL, retryable=false, refunds=false. */
  function parse960(sql: string): SqlRow[] {
    const rows: SqlRow[] = []
    for (const line of extractBlock(sql)) {
      const m = line.match(/^\s*\('([A-Z][A-Z0-9_]+)'\s*,\s*(\d+)\s*,.*\)\s*,?\s*$/)
      if (!m) continue
      const [, code, status] = m as unknown as [string, string, string]
      rows.push({
        code,
        category: 'GUARDRAIL',
        httpStatus: Number(status),
        isRetryable: false,
        refundsCredits: false,
      })
    }
    return rows
  }

  const rows950 = parse950(readFileSync(seed950, 'utf8'))
  const rows960 = parse960(readFileSync(seed960, 'utf8'))
  const sqlRows = [...rows950, ...rows960]

  it('doit extraire les 57 codes du seed 950 et les 5 codes du seed 960 (garde du parseur)', () => {
    expect(rows950).toHaveLength(57)
    expect(rows960).toHaveLength(5)
  })

  it('doit n’avoir aucun code défini dans les deux seeds', () => {
    const codes = sqlRows.map((r) => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('doit avoir exactement le même ensemble de codes que Object.keys(ERROR_CODES)', () => {
    const sqlCodes = sqlRows.map((r) => r.code).sort()
    const tsCodes = Object.keys(ERROR_CODES).sort()
    expect(sqlCodes).toEqual(tsCodes)
  })

  it('doit signaler précisément les codes manquants ou en trop de chaque côté', () => {
    const sqlCodes = new Set(sqlRows.map((r) => r.code))
    const tsCodes = new Set(Object.keys(ERROR_CODES))
    const missingInTs = [...sqlCodes].filter((c) => !tsCodes.has(c))
    const missingInSql = [...tsCodes].filter((c) => !sqlCodes.has(c))
    expect({ missingInTs, missingInSql }).toEqual({ missingInTs: [], missingInSql: [] })
  })

  it('doit avoir le même statut HTTP que le SQL pour chaque code', () => {
    for (const row of sqlRows) {
      const def = getErrorCode(row.code)
      expect(def?.httpStatus, row.code).toBe(row.httpStatus)
    }
  })

  it('doit avoir la même catégorie que le SQL pour chaque code', () => {
    for (const row of sqlRows) {
      const def = getErrorCode(row.code)
      expect(def?.category, row.code).toBe(row.category)
    }
  })

  it('doit avoir le même drapeau is_retryable que le SQL pour chaque code', () => {
    for (const row of sqlRows) {
      const def = getErrorCode(row.code)
      expect(def?.isRetryable, row.code).toBe(row.isRetryable)
    }
  })

  it('doit avoir le même drapeau refunds_credits que le SQL pour chaque code', () => {
    for (const row of sqlRows) {
      const def = getErrorCode(row.code)
      expect(def?.refundsCredits, row.code).toBe(row.refundsCredits)
    }
  })
})
