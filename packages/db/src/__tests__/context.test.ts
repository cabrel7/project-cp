import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../schema/index.js'

// Règles testées (CLAUDE.md invariant 2, docs/reference/02-regles-metier.md) :
//  - toute requête client passe par la transaction de contexte (app.org_id, app.user_id) ;
//  - RLS : une organisation ne voit ni ne modifie jamais les données d'une autre.
//
// Intégration : PostgreSQL réel requis (migrations dbmate appliquées, rôle applicatif SOUMIS à la RLS).
//   DATABASE_URL_RW / _AUTH / _ADMIN : obligatoires (lus par client.ts à l'import).
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

const requiredUrls = ['DATABASE_URL_RW', 'DATABASE_URL_AUTH', 'DATABASE_URL_ADMIN'].map(env)
const seedUrl = env('DATABASE_URL') ?? env('DATABASE_URL_ADMIN')
const hasDb = requiredUrls.every(Boolean) && (await isReachable(env('DATABASE_URL_RW')))

type RowList = ArrayLike<Record<string, unknown>>
const rows = (res: unknown): Record<string, unknown>[] => Array.from(res as RowList)
const setting = (res: unknown, column = 'v'): unknown => rows(res)[0]?.[column]
const isEmptySetting = (v: unknown) => v === null || v === undefined || v === ''

describe.skipIf(!hasDb)('withOrgContext (integration, PostgreSQL réel)', () => {
  let ctx: typeof import('../context.js')
  let client: typeof import('../client.js')
  let owner: postgres.Sql
  /** Connexion UNIQUE : force la réutilisation de la même session PG entre deux transactions. */
  let single: postgres.Sql
  let singleDb: Parameters<(typeof import('../context.js'))['withOrgContextOn']>[0]

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  let orgA = 0n
  let orgB = 0n
  let userA = 0n
  let userB = 0n
  let wsA = 0n
  let wsB = 0n

  async function insertOrg(slug: string, userId: bigint): Promise<bigint> {
    const [row] = await owner`
      INSERT INTO iam.organizations
        (name, slug, country_code, default_currency, default_locale, data_region_id, created_by_user_id)
      VALUES (${`Org ${slug}`}, ${slug}, 'CM', 'XAF', 'fr',
              (SELECT id FROM ref.data_regions ORDER BY id LIMIT 1), ${userId.toString()})
      RETURNING id::text AS id`
    return BigInt(row?.['id'] as string)
  }

  async function insertUser(tag: string): Promise<bigint> {
    const [row] = await owner`
      INSERT INTO iam.users (email, full_name)
      VALUES (${`ctx-${tag}-${suffix}@example.test`}, ${`User ${tag}`})
      RETURNING id::text AS id`
    return BigInt(row?.['id'] as string)
  }

  async function insertWorkspace(orgId: bigint, slug: string): Promise<bigint> {
    const [row] = await owner`
      INSERT INTO iam.workspaces (organization_id, name, slug)
      VALUES (${orgId.toString()}, ${`WS ${slug}`}, ${slug})
      RETURNING id::text AS id`
    return BigInt(row?.['id'] as string)
  }

  beforeAll(async () => {
    client = await import('../client.js')
    ctx = await import('../context.js')

    owner = postgres(seedUrl as string, { max: 1, onnotice: () => {} })
    single = postgres(env('DATABASE_URL_RW') as string, { max: 1, onnotice: () => {} })
    singleDb = drizzle(single, { schema, logger: false })

    userA = await insertUser('a')
    userB = await insertUser('b')
    orgA = await insertOrg(`ctx-a-${suffix}`, userA)
    orgB = await insertOrg(`ctx-b-${suffix}`, userB)
    wsA = await insertWorkspace(orgA, `ws-a-${suffix}`)
    wsB = await insertWorkspace(orgB, `ws-b-${suffix}`)
  })

  afterAll(async () => {
    if (owner) {
      // ON DELETE CASCADE : workspaces supprimés avec leur organisation.
      await owner`DELETE FROM iam.organizations WHERE id IN (${orgA.toString()}, ${orgB.toString()})`
      await owner`DELETE FROM iam.users WHERE id IN (${userA.toString()}, ${userB.toString()})`
      await owner.end({ timeout: 2 })
    }
    if (single) await single.end({ timeout: 2 })
    if (client) await client.closeAllPools()
  })

  it('doit utiliser un rôle applicatif soumis à la RLS (garde-fou : sinon les tests d isolation sont vides)', async () => {
    const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
      tx.execute(sql`SELECT rolbypassrls AS v, rolsuper AS s FROM pg_roles WHERE rolname = current_user`),
    )

    expect(setting(res)).toBe(false)
    expect(setting(res, 's')).toBe(false)
  })

  describe('pose du contexte', () => {
    it('doit poser app.org_id et app.user_id dans la transaction', async () => {
      const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(
          sql`SELECT current_setting('app.org_id', true) AS org, current_setting('app.user_id', true) AS usr`,
        ),
      )

      expect(setting(res, 'org')).toBe(orgA.toString())
      expect(setting(res, 'usr')).toBe(userA.toString())
    })

    it('doit exposer le contexte aux fonctions SQL util.current_org_id() / util.current_user_id()', async () => {
      const res = await ctx.withOrgContext({ orgId: orgB, userId: userB }, (tx) =>
        tx.execute(
          sql`SELECT util.current_org_id()::text AS org, util.current_user_id()::text AS usr`,
        ),
      )

      expect(setting(res, 'org')).toBe(orgB.toString())
      expect(setting(res, 'usr')).toBe(userB.toString())
    })

    it('doit retourner la valeur de la fonction passée', async () => {
      const value = await ctx.withOrgContext({ orgId: orgA, userId: userA }, async () => 'résultat')

      expect(value).toBe('résultat')
    })

    it('doit conserver exactement un identifiant bigint au-delà de 2^53', async () => {
      const big = 9007199254740993n // Number.MAX_SAFE_INTEGER + 2 : un Number l'arrondirait
      const res = await ctx.withOrgContext({ orgId: big, userId: big }, (tx) =>
        tx.execute(sql`SELECT util.current_org_id()::text AS v`),
      )

      expect(setting(res)).toBe(big.toString())
    })

    it('doit accepter la borne haute bigint PostgreSQL (2^63 - 1)', async () => {
      const max = 9223372036854775807n
      const res = await ctx.withOrgContext({ orgId: max, userId: 1n }, (tx) =>
        tx.execute(sql`SELECT util.current_org_id()::text AS v`),
      )

      expect(setting(res)).toBe(max.toString())
    })
  })

  describe('portée transactionnelle', () => {
    it('ne doit plus exposer le contexte après la transaction (même connexion réutilisée)', async () => {
      await ctx.withOrgContextOn(singleDb, { orgId: orgA, userId: userA }, async () => undefined)

      const res = await singleDb.execute(
        sql`SELECT current_setting('app.org_id', true) AS org, current_setting('app.user_id', true) AS usr,
                   util.current_org_id() AS fn_org`,
      )

      expect(isEmptySetting(setting(res, 'org'))).toBe(true)
      expect(isEmptySetting(setting(res, 'usr'))).toBe(true)
      expect(setting(res, 'fn_org')).toBeNull()
    })

    it('ne doit pas propager le contexte d une organisation à la transaction suivante (même connexion)', async () => {
      await ctx.withOrgContextOn(singleDb, { orgId: orgA, userId: userA }, async () => undefined)

      const res = await ctx.withOrgContextOn(singleDb, { orgId: orgB, userId: userB }, (tx) =>
        tx.execute(sql`SELECT util.current_org_id()::text AS org, util.current_user_id()::text AS usr`),
      )

      expect(setting(res, 'org')).toBe(orgB.toString())
      expect(setting(res, 'usr')).toBe(userB.toString())
    })

    it('ne doit rien voir hors contexte : aucune ligne tenant sans app.org_id (refus par défaut)', async () => {
      const res = await client.getDbRw().execute(sql`SELECT count(*)::int AS v FROM iam.workspaces`)

      expect(setting(res)).toBe(0)
    })

    it('ne doit pas mélanger les contextes de transactions concurrentes (pool partagé)', async () => {
      const orgs = [orgA, orgB]
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, i) => {
          const org = orgs[i % 2] as bigint
          return ctx.withOrgContext({ orgId: org, userId: org + 1n }, async (tx) => {
            await tx.execute(sql`SELECT pg_sleep(0.01)`) // force l'entrelacement des transactions
            const res = await tx.execute(
              sql`SELECT util.current_org_id()::text AS org, util.current_user_id()::text AS usr`,
            )
            return { expectedOrg: org.toString(), expectedUser: (org + 1n).toString(), res }
          })
        }),
      )

      for (const r of results) {
        expect(setting(r.res, 'org')).toBe(r.expectedOrg)
        expect(setting(r.res, 'usr')).toBe(r.expectedUser)
      }
    })
  })

  describe('erreurs et annulation', () => {
    it('doit propager l erreur de la fonction et annuler les écritures de la transaction', async () => {
      const slug = `rollback-${suffix}`

      await expect(
        ctx.withOrgContext({ orgId: orgA, userId: userA }, async (tx) => {
          await tx.execute(
            sql`INSERT INTO iam.workspaces (organization_id, name, slug) VALUES (${orgA.toString()}::bigint, 'RB', ${slug})`,
          )
          throw new Error('échec métier')
        }),
      ).rejects.toThrow('échec métier')

      const [row] = await owner`SELECT count(*)::int AS n FROM iam.workspaces WHERE slug = ${slug}`
      expect(row?.['n']).toBe(0)
    })

    it('doit valider les écritures quand la fonction réussit', async () => {
      const slug = `commit-${suffix}`

      await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(
          sql`INSERT INTO iam.workspaces (organization_id, name, slug) VALUES (${orgA.toString()}::bigint, 'OK', ${slug})`,
        ),
      )

      const [row] = await owner`SELECT count(*)::int AS n FROM iam.workspaces WHERE slug = ${slug}`
      expect(row?.['n']).toBe(1)
    })

    it('doit remettre la connexion en état sain après une erreur (le contexte ne fuit pas)', async () => {
      await expect(
        ctx.withOrgContextOn(singleDb, { orgId: orgA, userId: userA }, async () => {
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')

      const res = await singleDb.execute(sql`SELECT util.current_org_id() AS v`)
      expect(setting(res)).toBeNull()
    })
  })

  describe('isolation multi-tenant (RLS réelle)', () => {
    it('doit prouver que les données des deux organisations existent (test non vide)', async () => {
      const [row] = await owner`
        SELECT count(*)::int AS n FROM iam.workspaces WHERE id IN (${wsA.toString()}, ${wsB.toString()})`

      expect(row?.['n']).toBe(2)
    })

    it('ne doit montrer à l organisation A que ses propres workspaces', async () => {
      const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(
          sql`SELECT id::text AS id, organization_id::text AS org FROM iam.workspaces
              WHERE slug LIKE ${`%-${suffix}`}`,
        ),
      )

      const list = rows(res)
      expect(list.map((r) => r['id'])).toContain(wsA.toString())
      expect(list.map((r) => r['id'])).not.toContain(wsB.toString())
      expect(list.every((r) => r['org'] === orgA.toString())).toBe(true)
    })

    it('ne doit montrer à l organisation B que ses propres workspaces (symétrie)', async () => {
      const res = await ctx.withOrgContext({ orgId: orgB, userId: userB }, (tx) =>
        tx.execute(sql`SELECT id::text AS id FROM iam.workspaces WHERE slug LIKE ${`%-${suffix}`}`),
      )

      const ids = rows(res).map((r) => r['id'])
      expect(ids).toContain(wsB.toString())
      expect(ids).not.toContain(wsA.toString())
    })

    it('doit répondre comme si la ligne n existait pas quand A cible directement un id de B', async () => {
      const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(sql`SELECT id FROM iam.workspaces WHERE id = ${wsB.toString()}::bigint`),
      )

      expect(rows(res)).toHaveLength(0)
    })

    it('ne doit modifier aucune ligne de B depuis le contexte de A (UPDATE)', async () => {
      const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(
          sql`UPDATE iam.workspaces SET name = 'piraté' WHERE id = ${wsB.toString()}::bigint RETURNING id`,
        ),
      )

      expect(rows(res)).toHaveLength(0)
      const [row] = await owner`SELECT name FROM iam.workspaces WHERE id = ${wsB.toString()}`
      expect(row?.['name']).not.toBe('piraté')
    })

    it('ne doit supprimer aucune ligne de B depuis le contexte de A (DELETE)', async () => {
      const res = await ctx.withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
        tx.execute(sql`DELETE FROM iam.workspaces WHERE id = ${wsB.toString()}::bigint RETURNING id`),
      )

      expect(rows(res)).toHaveLength(0)
      const [row] = await owner`SELECT count(*)::int AS n FROM iam.workspaces WHERE id = ${wsB.toString()}`
      expect(row?.['n']).toBe(1)
    })

    it('doit refuser (42501) d insérer une ligne rattachée à B depuis le contexte de A', async () => {
      const error = await ctx
        .withOrgContext({ orgId: orgA, userId: userA }, (tx) =>
          tx.execute(
            sql`INSERT INTO iam.workspaces (organization_id, name, slug)
                VALUES (${orgB.toString()}::bigint, 'intrus', ${`intrus-${suffix}`})`,
          ),
        )
        .then(
          () => undefined,
          (e: unknown) => e,
        )

      expect(error).toBeDefined()
      // drizzle enveloppe l'erreur postgres dans `cause`
      const code =
        (error as { code?: string; cause?: { code?: string } }).cause?.code ??
        (error as { code?: string }).code
      expect(code).toBe('42501')
      const [row] = await owner`SELECT count(*)::int AS n FROM iam.workspaces WHERE slug = ${`intrus-${suffix}`}`
      expect(row?.['n']).toBe(0)
    })

    it('doit borner à la transaction toute réécriture locale de app.org_id', async () => {
      // Limite connue d'une RLS basée sur un GUC : le SQL libre pourrait réécrire le contexte. Le
      // garde-fou est l'absence de SQL libre côté client ; ici on vérifie que l'effet ne survit pas.
      await ctx.withOrgContextOn(singleDb, { orgId: orgA, userId: userA }, (tx) =>
        tx.execute(sql`SELECT set_config('app.org_id', ${orgB.toString()}, true)`),
      )

      const res = await ctx.withOrgContextOn(singleDb, { orgId: orgA, userId: userA }, (tx) =>
        tx.execute(sql`SELECT util.current_org_id()::text AS v`),
      )
      expect(setting(res)).toBe(orgA.toString())
    })
  })
})

describe('withOrgContext (garde, sans base)', () => {
  it('doit refuser orgId 0n avant toute connexion', async () => {
    const { withOrgContext } = await import('../context.js')

    await expect(withOrgContext({ orgId: 0n, userId: 1n }, async () => 'x')).rejects.toThrow(
      /orgId 0/,
    )
  })
})
