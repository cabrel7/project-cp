import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { getDbEnv, requireDbUrl } from './env.js'
import { logger } from './logger.js'
import * as schema from './schema/index.js'

// Pools créés paresseusement : importer @cp/db n'ouvre rien et n'exige que les URL réellement utilisées
// (l'api ne doit jamais détenir DATABASE_URL_ADMIN — moindre privilège, invariant 2).

type Sql = postgres.Sql
type Db = ReturnType<typeof drizzle<typeof schema>>

function makePool(url: string, max: number): Sql {
  return postgres(url, { max, onnotice: () => {} })
}

let rw: { pool: Sql; db: Db } | undefined
let auth: { pool: Sql; db: Db } | undefined
let admin: { pool: Sql; db: Db } | undefined

function build(url: string, max: number): { pool: Sql; db: Db } {
  const pool = makePool(url, max)
  return { pool, db: drizzle(pool, { schema, logger: false }) }
}

function getRw() {
  rw ??= build(requireDbUrl('DATABASE_URL_RW'), getDbEnv().DB_POOL_MAX_RW)
  return rw
}
function getAuth() {
  auth ??= build(requireDbUrl('DATABASE_URL_AUTH'), getDbEnv().DB_POOL_MAX_AUTH)
  return auth
}
/** Interne : consommé uniquement par ./admin.ts (point d'entrée restreint `@cp/db/admin`). */
export function getAdminHandle(): { pool: Sql; db: Db } {
  admin ??= build(requireDbUrl('DATABASE_URL_ADMIN'), getDbEnv().DB_POOL_MAX_ADMIN)
  return admin
}

export const getDbRw = (): Db => getRw().db
export const getDbAuth = (): Db => getAuth().db
export const getPoolRw = (): Sql => getRw().pool
export const getPoolAuth = (): Sql => getAuth().pool

export async function closeAllPools(): Promise<void> {
  logger.info('closing database pools')
  const open = [rw, auth, admin].filter((p): p is { pool: Sql; db: Db } => p !== undefined)
  rw = auth = admin = undefined
  const results = await Promise.allSettled(open.map((p) => p.pool.end()))
  for (const r of results) {
    if (r.status === 'rejected') logger.error({ err: r.reason }, 'database pool failed to close')
  }
  logger.info('database pools closed')
}
