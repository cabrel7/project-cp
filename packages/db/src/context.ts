import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'
import { getDbRw } from './client.js'
import type * as schema from './schema/index.js'

export type Tx = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

export async function withOrgContextOn<T>(
  db: ReturnType<typeof getDbRw>,
  orgId: bigint,
  userId: bigint,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.org_id', ${orgId.toString()}, true)`)
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId.toString()}, true)`)
    return fn(tx)
  })
}

export async function withOrgContext<T>(
  orgId: bigint,
  userId: bigint,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return withOrgContextOn(getDbRw(), orgId, userId, fn)
}
