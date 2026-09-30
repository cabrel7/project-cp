# STATE — project-cp
Updated: 2026-09-30 | Session: P0 — Socle

## ✅ Done
- Documentation de référence v2 : `docs/reference/00` à `07` (produit, règles, architecture, schéma, garde-fous, décisions D01-D52, UI/UX).
- Schéma PostgreSQL v1.2 : `db/schema-v1.2/` — 183 tables, RLS, 23 contrôles passés sur base neuve (T1-T22).
- Design system « project-cp » (tokens, 8 gabarits, 27 composants) : `docs/design-system/`.
- Maquettes de validation (7 pages) : authentification, onboarding, tableau de bord, MCP Builder, studios, admin IA, navigation.
- Kit Claude Code propre au projet : `.claude/` (10 agents, 18 skills `cp-*`, 3 hooks, 5 commandes).
- Plan de construction `docs/reference/08-plan-construction.md` (D50 ✅).
- Maquettes dans le dépôt : `docs/maquettes/` (43 captures + sources HTML) ; profil mobile corrigé (3 profils).
- Profils d'onboarding alignés sur D41 : prompt `system.onboarding.copilot` + contrainte `ux.onboarding_progress.profile` (`activity`, `builder`, `enterprise`) ; 21 tests OK.
- **P0.1 — Monorepo** : pnpm 10 + turborepo 2.11, tsconfig.base strict (TS 5.9), Biome 2.5, lefthook 2.1, commits conventionnels, changesets, catalog de versions (Nuxt 4.5, Hono 4.13, zod 4, vitest 5, drizzle-orm 0.45), 7 apps + 7 paquets squelettes. 42/42 turbo tasks (build + typecheck + test) vertes.
- **P0.2 — Infra dev** : `infra/docker-compose.dev.yml` (PostgreSQL 18 + pgvector, Redis 8.0 noeviction, SeaweedFS S3 (D51), Mailpit, LiteLLM, Temporal dev-server), `init-dev.sh` (4 rôles + 5 extensions), `.env.example`, scripts `infra:up/down/reset`, ports loopback-only. Mode natif (`dev-native.sh`) : PG + Redis sans Docker pour sessions cloud. Catalog mis à jour (pino 10.3, ioredis 6, bullmq 6.3). 42/42 turbo tasks vertes.
- Stockage basculable (D51 révisée, D52) : `storage.backends` + `storage.files.backend_id` + `storage.backend_migrations` ; SeaweedFS local par défaut, OVH en option ; tests T21-T22 ; D50 validée.
- **P0.3 — Baseline dbmate** : migration 0001 (schema-v1.2 → `db/migrations/`), `db/dbmate.sh` wrapper, `db/tests/` (23 contrôles T1-T22), scripts `db:*`, lefthook squawk exclude baseline. dbmate up 1.5s, 23/23 OK sur base neuve.
- **P0.4 — `packages/db`** : drizzle-kit pull (219 tables, 15 schémas PG), post-pull.sh automatisé (bigint mode, unknown→text, partitions, @ts-nocheck), client postgres.js 3 pools lazy (RW/Auth/Admin), `withOrgContext` RLS (`set_config(..., true)`), helpers UUIDv7 (`generatePublicId`, curseurs), env typé (zod v4), logger pino. 47 tests passés, 21 intégration (RLS) conditionnels. PR #5 squash-merged dans dev.
- **P0.5 — `packages/shared`** : 62 codes d'erreur synchronisés avec les seeds SQL (950+960), schémas zod de base (publicId UUIDv7 strict, pagination, errorResponse, paginated), glossaire Simple/Technique (18 termes × fr/en). 285 tests (285 passés, `doc_url` → `documentation_url` corrigé). Reviewer : 0 CRITICAL, 0 MAJOR ouvert. PR #6 squash-merged dans dev.
- **P0.6 — `apps/api` minimal** : env.ts (zod, invariant 8), pino logger (invariant 10), request-id UUIDv7, OTel conditionnel, `AppError` + format unique (doc 02 §8, details omis sur 5xx, HTTPException 4xx → 422), `/health`, `/openapi.json` (D31), `/docs` (Scalar). `doc_url` → `documentation_url` dans `@cp/shared`. 25 tests (5 fichiers), 28/28 turbo tasks. Reviewer 8/10, 0 CRITICAL/MAJOR ouvert. PR #7 squash-merged dans dev.
- **P0.7 — CI GitHub Actions** : `.github/workflows/ci.yml` (5 jobs : lint Biome, typecheck, test, db avec PostgreSQL 18 service container + dbmate + 23 SQL tests + drizzle drift check + squawk, build). Action composite `.github/actions/setup-pnpm/` (Node 22 + pnpm 10 + cache). 42/42 turbo tasks. Reviewer 8.5/10, 0 CRITICAL/MAJOR ouvert (3 corrigés). PR #8 squash-merged dans dev.

## 🔄 Active
- P1.0 — Spike D27 : comparaison Nuxt UI vs shadcn-vue — verdict PROPOSÉ : Nuxt UI (6/8 vs 4/8). PR #9 ouverte, en attente de validation humaine.

## 📋 Queue
7. **P1 — Design system en code** (thème Nuxt UI, spike D27 d'abord) — en parallèle de P2.
8. Chantiers hors code : A. marges et prix (avant fin P3) · B. prompts v2 + évaluations des 14 capacités internes (avant fin P4) · C. POC OAuth 2.1 (lot P2.7) · D. CGU / DPA / confidentialité (avant bêta publique).
Détail, ordre et critères de fin : `docs/reference/08-plan-construction.md`.

## 🏗️ Decisions
- Source unique : `docs/reference/06-journal-decisions.md` (ne pas dupliquer ici).

## ⚠️ Known issues
- D26 : serveur OAuth 2.1 via `oidc-provider` = POC à valider.
- D27 : Nuxt UI PROPOSÉ (spike P1.0, PR #9) — en attente de validation humaine avant de marquer ✅.
- Nom définitif du produit non choisi (`brand.name` en paramètre).
- Prix des plans provisoires (D20).
- Partitions `usage.runs` pré-créées jusqu'à 2026-12 ; maintenance mensuelle à automatiser (job worker P3).
