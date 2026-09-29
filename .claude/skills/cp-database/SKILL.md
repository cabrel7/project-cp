---
name: cp-database
description: Base de données project-cp — PostgreSQL 18 + pgvector, SQL versionné dbmate (source de vérité), Squawk, Drizzle en lecture (pull), identifiants hybrides bigint/UUIDv7, multi-tenant RLS + FK composites, rôles app_rw/app_auth/app_admin/app_readonly, transaction de contexte, partitions mensuelles, triggers d'immutabilité, tests SQL. Lire avant toute migration ou requête.
---

# PostgreSQL — project-cp

> Sources : `docs/reference/04-schema-donnees.md` (conventions §2, index §5, partitions §6, sécurité §7) ·
> `docs/reference/03-architecture-technique.md` §3 (migrations, flux, usage dans le code) ·
> SQL validé : `db/schema-v1.2/*.sql` (183 tables, 23 contrôles T1-T22) → deviendra `db/migrations/0001_baseline.sql`.
> **Le SQL fait foi** sur toute doc.

## 1. Flux de travail (toujours dans cet ordre)
1. `db/migrations/AAAAMMJJHHMMSS_description.sql` avec `-- migrate:up` et `-- migrate:down`.
2. `dbmate up` (base locale/test) → `dbmate rollback` → `dbmate up` (prouve le down).
3. `squawk db/migrations/<fichier>.sql`.
4. `pnpm --filter @cp/db db:pull` (`drizzle-kit pull`) → `packages/db/src/schema/` régénéré.
5. Tests SQL (`db/tests/`) + tests applicatifs. Commit SQL + TS ensemble.
CI : base neuve, toutes les migrations, tests SQL, pull identique au commit, squawk.
**Jamais** `drizzle-kit generate | push | migrate` (bloqué par le guard et par `permissions.ask`).

## 2. Conventions de table
```sql
CREATE TABLE agent.agents (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint NOT NULL REFERENCES iam.organizations(id),
  workspace_id    bigint NOT NULL,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','error','archived')),
  description     jsonb CHECK (description IS NULL OR util.is_i18n(description)),
  lock_version    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),                                   -- cible des FK composites
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id)
);
CREATE TRIGGER touch BEFORE UPDATE ON agent.agents FOR EACH ROW EXECUTE FUNCTION util.touch_updated_at();
CREATE TRIGGER lockv BEFORE UPDATE ON agent.agents FOR EACH ROW EXECUTE FUNCTION util.bump_lock_version();
```
- Statuts en `text` + `CHECK` (pas d'enum PG) ; i18n en `jsonb` validé par `util.is_i18n` ; `timestamptz` toujours.
- Schémas par domaine : `ref, iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance, platform, audit`.
- Unicité avec NULL : `UNIQUE NULLS NOT DISTINCT` ; périodes sans chevauchement : contrainte d'exclusion (`btree_gist`).

## 3. Multi-tenant (non négociable)
- Toute table client porte `organization_id` ; liens internes par **FK composites `(x_id, organization_id)`** → rattacher un objet d'une autre organisation est impossible.
- RLS : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policies pour `app_rw` sur `organization_id = util.current_org_id()`
  (catalogues partagés : lecture `organization_id IS NULL OR = util.current_org_id()`). Modèle dans `900_security.sql`.
- Contexte posé par l'application à chaque transaction :
```ts
// packages/db/src/context.ts
export async function withOrgContext<T>(ctx: { orgId: bigint; userId: bigint | null }, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId.toString()}, true),
                                set_config('app.user_id', ${ctx.userId?.toString() ?? ''}, true)`)
    return fn(tx)
  })
}
```
- Rôles / connexions : `app_rw` (API, mcp-runtime, workers client — soumis à la RLS) · `app_auth` (résolution des jetons avant
  que l'organisation soit connue — BYPASSRLS, droits minimes) · `app_admin` (back-office, jobs système — BYPASSRLS, jamais dans api/mcp-runtime) ·
  `app_readonly` (analytique). Chaque app ouvre seulement les pools dont elle a besoin.
- Organisation système = id 0 (IA interne) : invisible des clients (test T16).

## 4. Requêtes Drizzle
- Schéma TS généré par pull (jamais édité). Requêtes typées `tx.select().from(t).where(eq(...))` ; SQL brut seulement via `sql\`\`` paramétré dans `packages/db`.
- Résolution public → interne dans le repository : `where(eq(agents.publicId, id))` sous RLS → 404 si absent (y compris autre organisation).
- Verrou optimiste : `update … where id = $1 and lock_version = $2` → 0 ligne = 409 conflit.
- Pas de N+1 : jointures ou `inArray` ; pagination curseur `(created_at, public_id)` avec index correspondant.
- `bigint` ↔ JS : mode `bigint` dans Drizzle pour ids et µcr ; jamais converti en `number`.

## 5. Opérations critiques = fonctions transactionnelles testées
Réservation / régularisation de crédits, écriture au grand livre, numérotation de facture sans trou, publication d'une version MCP,
bascule d'une capacité en production : fonction unique (SQL `plpgsql` ou TS dans `@cp/db` / `@cp/billing`) avec `SELECT … FOR UPDATE`
ou verrou consultatif (`pg_advisory_xact_lock`), jamais dupliquée dans un service.

## 6. Immutabilité et intégrité (triggers existants à respecter)
- Grand livre, audit, événements : **ajout seul** (`util.forbid_mutation`) ; correction = écriture inverse.
- Version MCP publiée figée (`util.protect_server_snapshot`), version de capacité verrouillée (`util.protect_locked_capability_version`),
  capacité scellée Marketplace (`ai.protect_sealed_capability`, contournement seulement `SET LOCAL app.market_sync='on'` par la synchro).
- Suppression et financier ⇒ approbation (contrainte), connecteur SQL sans DELETE (contrainte) : ne jamais affaiblir une contrainte testée.

## 7. Partitions et rétention
Tables à fort volume partitionnées par mois (`usage.runs`, `usage.llm_requests`, `audit.events`, `billing` événements, `dev` livraisons,
garde-fous…) : `util.ensure_monthly_partitions(parent, mois_avant, mois_après)` appelée par un job (`apps/worker`, connexion `app_admin`) ;
purge = `DETACH` + `DROP` de partitions selon la rétention (04 §6), jamais `DELETE` massif.

## 8. Migrations sûres en production (Squawk)
- Index sur table existante : `CREATE INDEX CONCURRENTLY` dans un fichier `-- migrate:up transaction:false`.
- `NOT NULL` sur grosse table : colonne nullable → backfill par lots → `CHECK (...) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL`.
- Pas de renommage direct d'une colonne utilisée : ajout → double écriture → bascule → suppression (plusieurs déploiements).
- `lock_timeout` court (`SET lock_timeout = '3s'`) en tête des migrations qui prennent un verrou.
- Données de référence : migrations de données idempotentes (`INSERT … ON CONFLICT … DO UPDATE`).

## 9. Tests SQL (db/tests)
Scénario type : créer 2 organisations, poser le contexte de A (`SET LOCAL ROLE app_rw; SELECT set_config('app.org_id', …)`),
vérifier qu'aucune ligne de B n'est visible / modifiable, qu'une FK composite croisée échoue, que les triggers refusent la mutation.
Référence : `db/schema-v1.2/tests/001_smoke_tests.sql` (T01-T21). Chaque nouvelle règle `[DB]` de 02 = un test.

## Anti-patterns interdits
Migration sans `down` · `drizzle-kit generate/push` · table client sans `organization_id`/RLS · FK simple vers une table tenant ·
`app_admin` côté client · filtre `organization_id` « à la main » à la place de la RLS · `DELETE` sur ledger/audit · flottant pour l'argent ·
`CREATE INDEX` non concurrent sur table existante · enum Postgres pour un statut · SQL concaténé.
