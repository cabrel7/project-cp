import { getTableConfig } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { partitionedTables } from '../schema/partitioned.js'

// Règle testée : les tables parentes partitionnées, déclarées à la main dans schema/partitioned.ts
// (drizzle-kit pull les ignore, cf. tablesFilter), restent alignées sur le SQL versionné.
//
// Intégration : PostgreSQL réel requis, migrations dbmate appliquées.
//   DATABASE_URL (propriétaire) ou DATABASE_URL_ADMIN : lecture de information_schema
//   (information_schema.columns ne liste que les colonnes accessibles au rôle connecté).
// Sans base joignable, toute la suite est sautée (et signalée comme telle par vitest).

const env = (key: string): string | undefined => process.env[key]
const dbUrl = env('DATABASE_URL') ?? env('DATABASE_URL_ADMIN')

async function isReachable(url: string | undefined): Promise<boolean> {
  if (!url) return false
  const probe = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} })
  try {
    await probe`SELECT 1`
    return true
  } catch {
    return false
  } finally {
    await probe.end({ timeout: 1 }).catch(() => {})
  }
}

const hasDb = await isReachable(dbUrl)

interface DbColumn {
  name: string
  dataType: string
  isNullable: boolean
  numericPrecision: number | null
  numericScale: number | null
}

/** `numeric(18, 10)` -> `numeric` : information_schema.data_type n'inclut pas la précision. */
const baseSqlType = (sqlType: string): string => sqlType.replace(/\(.*\)$/, '')

describe.skipIf(!hasDb)('tables partitionnées (partitioned.ts vs information_schema)', () => {
  let sql: postgres.Sql

  beforeAll(() => {
    sql = postgres(dbUrl as string, { max: 1, onnotice: () => {} })
  })

  afterAll(async () => {
    await sql.end({ timeout: 2 })
  })

  async function dbColumns(schemaName: string, tableName: string): Promise<DbColumn[]> {
    const res = await sql<
      {
        name: string
        data_type: string
        is_nullable: string
        numeric_precision: number | null
        numeric_scale: number | null
      }[]
    >`
      SELECT column_name AS name, data_type, is_nullable, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = ${schemaName} AND table_name = ${tableName}
      ORDER BY ordinal_position`
    return res.map((r) => ({
      name: r.name,
      dataType: r.data_type,
      isNullable: r.is_nullable === 'YES',
      numericPrecision: r.numeric_precision,
      numericScale: r.numeric_scale,
    }))
  }

  it('couvre exactement les tables partitionnées de la base (9 parents)', async () => {
    const res = await sql<{ qualified: string }[]>`
      SELECT n.nspname || '.' || c.relname AS qualified
      FROM pg_partitioned_table p
      JOIN pg_class c ON c.oid = p.partrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      ORDER BY 1`
    const inDb = res.map((r) => r.qualified)
    expect(Object.keys(partitionedTables).sort()).toEqual(inDb)
    expect(inDb).toHaveLength(9)
  })

  describe.each(Object.entries(partitionedTables))('%s', (qualified, table) => {
    const cfg = getTableConfig(table)

    it('le nom qualifié correspond à la clé déclarée', () => {
      expect(`${cfg.schema}.${cfg.name}`).toBe(qualified)
    })

    it('colonnes, types, nullabilité et ordre identiques à information_schema', async () => {
      const actual = await dbColumns(cfg.schema as string, cfg.name)
      expect(actual.length).toBeGreaterThan(0)

      const declared = cfg.columns.map((c) => ({
        name: c.name,
        dataType: baseSqlType(c.getSQLType()),
        isNullable: !c.notNull,
      }))
      expect(declared).toEqual(
        actual.map((c) => ({ name: c.name, dataType: c.dataType, isNullable: c.isNullable })),
      )
    })

    it('précision et échelle des numeric identiques', async () => {
      const actual = await dbColumns(cfg.schema as string, cfg.name)
      for (const col of cfg.columns) {
        const match = /^numeric\((\d+), ?(\d+)\)$/.exec(col.getSQLType())
        if (!match) continue
        const dbCol = actual.find((c) => c.name === col.name)
        expect(dbCol?.numericPrecision).toBe(Number(match[1]))
        expect(dbCol?.numericScale).toBe(Number(match[2]))
      }
    })
  })
})
