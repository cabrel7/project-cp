import { z } from 'zod'

// Chaque URL est optionnelle ici : une app ne fournit que les identifiants dont elle a besoin
// (moindre privilège : l'api n'a jamais DATABASE_URL_ADMIN). La présence est vérifiée à
// l'ouverture du pool concerné (requireUrl), pas à l'import.
const dbEnvSchema = z.object({
  DATABASE_URL_RW: z.string().min(1).optional(),
  DATABASE_URL_AUTH: z.string().min(1).optional(),
  DATABASE_URL_ADMIN: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DB_POOL_MAX_RW: z.coerce.number().int().positive().default(10),
  DB_POOL_MAX_AUTH: z.coerce.number().int().positive().default(3),
  DB_POOL_MAX_ADMIN: z.coerce.number().int().positive().default(5),
})

export type DbEnv = z.infer<typeof dbEnvSchema>

let cached: DbEnv | undefined

export function getDbEnv(): DbEnv {
  if (cached) return cached
  cached = dbEnvSchema.parse(process.env)
  return cached
}

/** Retourne l'URL demandée ou lève une erreur sans jamais inclure de valeur secrète. */
export function requireDbUrl(key: 'DATABASE_URL_RW' | 'DATABASE_URL_AUTH' | 'DATABASE_URL_ADMIN'): string {
  const value = getDbEnv()[key]
  if (!value) throw new Error(`${key} is required but not set`)
  return value
}
