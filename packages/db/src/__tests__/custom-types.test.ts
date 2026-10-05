import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../schema/schema.js'

describe('bytea columns use customType, not text()', () => {
  interface ByteaColumn {
    table: string
    column: string
  }

  const byteaColumns: ByteaColumn[] = []

  for (const [, value] of Object.entries(schema)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    for (const col of config.columns) {
      if (col.columnType === 'PgCustomColumn' && col.getSQLType() === 'bytea') {
        byteaColumns.push({
          table: `${config.schema ?? 'public'}.${config.name}`,
          column: col.name,
        })
      }
    }
  }

  it('finds at least the known bytea columns', () => {
    const keys = byteaColumns.map((c) => `${c.table}.${c.column}`)
    expect(keys).toContain('platform.staff_sessions.token_hash')
    expect(keys).toContain('iam.user_sessions.token_hash')
    expect(keys).toContain('iam.verification_tokens.token_hash')
    expect(keys).toContain('iam.invitations.token_hash')
    expect(byteaColumns.length).toBeGreaterThanOrEqual(10)
  })

  it('known bytea columns are not typed as PgText (regression guard)', () => {
    const knownByteaNames = ['token_hash', 'key_hash', 'content_hash', 'secret_hash', 'webhook_secret']
    const mistyped: string[] = []
    for (const [, value] of Object.entries(schema)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value)
      for (const col of config.columns) {
        if (col.columnType === 'PgText' && knownByteaNames.includes(col.name)) {
          mistyped.push(`${config.schema ?? 'public'}.${config.name}.${col.name}`)
        }
      }
    }
    expect(mistyped).toEqual([])
  })
})
