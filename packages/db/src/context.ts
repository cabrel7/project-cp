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

export type OrgContext = { orgId: bigint; userId: bigint | null }

function assertOrgContext(ctx: OrgContext): void {
  if (ctx.orgId === 0n) throw new Error('withOrgContext: orgId 0 refusé (contexte tenant invalide)')
}

/** Interne / tests uniquement : non exporté par l'index principal. */
export async function withOrgContextOn<T>(
  db: ReturnType<typeof getDbRw>,
  ctx: OrgContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertOrgContext(ctx)
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.org_id', ${ctx.orgId.toString()}, true)`)
    if (ctx.userId !== null) {
      await tx.execute(sql`SELECT set_config('app.user_id', ${ctx.userId.toString()}, true)`)
    }
    return fn(tx)
  })
}

export async function withOrgContext<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertOrgContext(ctx) // avant getDbRw() : refus sans toucher à la config ni au pool
  return withOrgContextOn(getDbRw(), ctx, fn)
}
