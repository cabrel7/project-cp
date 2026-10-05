import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Règle testée (CLAUDE.md invariant 2, skill cp-database §3) : visibilité par pool de connexion.
//  - cp_rw (app_rw)     : SOUMIS à la RLS — ne voit rien sans app.org_id, voit son organisation avec ;
//  - cp_auth (app_auth) : BYPASSRLS — voit tout sans contexte (résolution des jetons avant l'organisation) ;
//  - cp_admin (app_admin) : BYPASSRLS — voit tout sans contexte (back-office, jobs système).
//
// Piège couvert : BYPASSRLS est un attribut de rôle NON hérité par appartenance (`IN ROLE app_auth`) ;
// poser BYPASSRLS sur le seul rôle NOLOGIN laisse le user LOGIN soumis à la RLS (0 ligne, sans erreur).
//
// Intégration : PostgreSQL réel requis (migrations dbmate appliquées + infra/postgres/init-dev.sh).
//   DATABASE_URL_RW / _AUTH / _ADMIN : obligatoires.
//   DATABASE_URL (propriétaire) ou DATABASE_URL_ADMIN : sert UNIQUEMENT à semer / nettoyer les données.
// Sans base joignable, toute la suite est sautée (et signalée comme telle par vitest).

const env = (key: string): string | undefined => process.env[key]

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

const urlRw = env('DATABASE_URL_RW')
const urlAuth = env('DATABASE_URL_AUTH')
const urlAdmin = env('DATABASE_URL_ADMIN')
const seedUrl = env('DATABASE_URL') ?? urlAdmin
const hasDb =
  Boolean(urlRw && urlAuth && urlAdmin && seedUrl) &&
  (await isReachable(urlRw)) &&
  (await isReachable(urlAuth)) &&
  (await isReachable(urlAdmin))

type RowList = ArrayLike<Record<string, unknown>>
const rows = (res: unknown): Record<string, unknown>[] => Array.from(res as RowList)
const countOf = (res: unknown): unknown => rows(res)[0]?.['n']

describe.skipIf(!hasDb)('visibilité par pool (integration, PostgreSQL réel)', () => {
  let owner: postgres.Sql
  let rw: postgres.Sql
  let auth: postgres.Sql
  let admin: postgres.Sql

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const slug = `pool-vis-${suffix}`
  let orgId = ''
  let userId = ''
  let wsId = ''

  /** Nombre de lignes visibles pour le workspace semé, SANS poser app.org_id. */
  async function visibleWithoutContext(pool: postgres.Sql): Promise<unknown> {
    return countOf(
      await pool`SELECT count(*)::int AS n FROM iam.workspaces WHERE id = ${wsId}::bigint`,
    )
  }

  beforeAll(async () => {
    owner = postgres(seedUrl as string, { max: 1, onnotice: () => {} })
    rw = postgres(urlRw as string, { max: 1, onnotice: () => {} })
    auth = postgres(urlAuth as string, { max: 1, onnotice: () => {} })
    admin = postgres(urlAdmin as string, { max: 1, onnotice: () => {} })

    const [user] = await owner`
      INSERT INTO iam.users (email, full_name)
      VALUES (${`pool-vis-${suffix}@example.test`}, 'Pool Visibility')
      RETURNING id::text AS id`
    userId = String(user?.['id'])

    const [org] = await owner`
      INSERT INTO iam.organizations
        (name, slug, country_code, default_currency, default_locale, data_region_id, created_by_user_id)
      VALUES (${`Org ${slug}`}, ${slug}, 'CM', 'XAF', 'fr',
              (SELECT id FROM ref.data_regions ORDER BY id LIMIT 1), ${userId}::bigint)
      RETURNING id::text AS id`
    orgId = String(org?.['id'])

    const [ws] = await owner`
      INSERT INTO iam.workspaces (organization_id, name, slug)
      VALUES (${orgId}::bigint, ${`WS ${slug}`}, ${`ws-${slug}`})
      RETURNING id::text AS id`
    wsId = String(ws?.['id'])
  })

  afterAll(async () => {
    if (owner) {
      // ON DELETE CASCADE : workspace supprimé avec son organisation.
      if (orgId) await owner`DELETE FROM iam.organizations WHERE id = ${orgId}::bigint`
      if (userId) await owner`DELETE FROM iam.users WHERE id = ${userId}::bigint`
      await owner.end({ timeout: 2 })
    }
    await Promise.all(
      [rw, auth, admin].map((pool) => (pool ? pool.end({ timeout: 2 }) : Promise.resolve())),
    )
  })

  it('doit prouver que la donnée semée existe (test non vide)', async () => {
    const res =
      await owner`SELECT count(*)::int AS n FROM iam.workspaces WHERE id = ${wsId}::bigint`

    expect(countOf(res)).toBe(1)
  })

  describe('attributs des rôles de connexion', () => {
    const attrs = async (pool: postgres.Sql) => {
      const res = await pool`
        SELECT current_user::text AS who, rolbypassrls AS bypass, rolsuper AS super
        FROM pg_roles WHERE rolname = current_user`
      return rows(res)[0]
    }

    it('doit laisser cp_rw soumis à la RLS (ni BYPASSRLS ni superuser)', async () => {
      const row = await attrs(rw)

      expect(row?.['who']).toBe('cp_rw')
      expect(row?.['bypass']).toBe(false)
      expect(row?.['super']).toBe(false)
    })

    it('doit donner BYPASSRLS directement à cp_auth (non hérité de app_auth)', async () => {
      const row = await attrs(auth)

      expect(row?.['who']).toBe('cp_auth')
      expect(row?.['bypass']).toBe(true)
      expect(row?.['super']).toBe(false)
    })

    it('doit donner BYPASSRLS directement à cp_admin (non hérité de app_admin)', async () => {
      const row = await attrs(admin)

      expect(row?.['who']).toBe('cp_admin')
      expect(row?.['bypass']).toBe(true)
      expect(row?.['super']).toBe(false)
    })
  })

  describe('visibilité sans contexte (app.org_id non posé)', () => {
    it('ne doit rien montrer au pool RW : la RLS refuse par défaut', async () => {
      expect(await visibleWithoutContext(rw)).toBe(0)
    })

    it('doit montrer la ligne au pool AUTH (BYPASSRLS)', async () => {
      expect(await visibleWithoutContext(auth)).toBe(1)
    })

    it('doit montrer la ligne au pool ADMIN (BYPASSRLS)', async () => {
      expect(await visibleWithoutContext(admin)).toBe(1)
    })
  })

  describe('pool RW avec contexte', () => {
    it('doit montrer la ligne une fois app.org_id posé pour son organisation', async () => {
      const res = await rw.begin(async (tx) => {
        await tx`SELECT set_config('app.org_id', ${orgId}, true)`
        return tx`SELECT count(*)::int AS n FROM iam.workspaces WHERE id = ${wsId}::bigint`
      })

      expect(countOf(res)).toBe(1)
    })

    it('ne doit rien montrer quand app.org_id désigne une autre organisation', async () => {
      const other = (BigInt(orgId) + 1n).toString()
      const res = await rw.begin(async (tx) => {
        await tx`SELECT set_config('app.org_id', ${other}, true)`
        return tx`SELECT count(*)::int AS n FROM iam.workspaces WHERE id = ${wsId}::bigint`
      })

      expect(countOf(res)).toBe(0)
    })
  })
})
