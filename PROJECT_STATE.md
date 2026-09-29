# STATE — project-cp
Updated: 2026-09-29 | Session: P0 — Socle

## ✅ Done
- Documentation de référence v2 : `docs/reference/00` à `07` (produit, règles, architecture, schéma, garde-fous, décisions D01-D50, UI/UX).
- Schéma PostgreSQL v1.2 : `db/schema-v1.2/` — 181 tables, RLS, 21 tests passés sur base neuve.
- Design system « project-cp » (tokens, 8 gabarits, 27 composants) : `docs/design-system/`.
- Maquettes de validation (7 pages) : authentification, onboarding, tableau de bord, MCP Builder, studios, admin IA, navigation.
- Kit Claude Code propre au projet : `.claude/` (10 agents, 18 skills `cp-*`, 3 hooks, 5 commandes).
- Plan de construction `docs/reference/08-plan-construction.md` (D50, 🟡 à valider).
- Maquettes dans le dépôt : `docs/maquettes/` (43 captures + sources HTML) ; profil mobile corrigé (3 profils).
- Profils d'onboarding alignés sur D41 : prompt `system.onboarding.copilot` + contrainte `ux.onboarding_progress.profile` (`activity`, `builder`, `enterprise`) ; 21 tests OK.
- **P0.1 — Monorepo** : pnpm 10 + turborepo 2.11, tsconfig.base strict (TS 5.9), Biome 2.5, lefthook 2.1, commits conventionnels, changesets, catalog de versions (Nuxt 4.5, Hono 4.13, zod 4, vitest 5, drizzle-orm 0.45), 7 apps + 7 paquets squelettes. 42/42 turbo tasks (build + typecheck + test) vertes.
- **P0.2 — Infra dev** : `infra/docker-compose.dev.yml` (PostgreSQL 18 + pgvector, Redis 7.4 noeviction, SeaweedFS S3 (D51), Mailpit, LiteLLM, Temporal dev-server), `init-dev.sh` (4 rôles + 5 extensions), `.env.example`, scripts `infra:up/down/reset`, ports loopback-only. Mode natif (`dev-native.sh`) : PG + Redis sans Docker pour sessions cloud. Catalog mis à jour (pino 10.3, ioredis 6, bullmq 6.3). 42/42 turbo tasks vertes.

## 🔄 Active
- Validation du plan 08 (D50) par Dylan.

## 📋 Queue
2. **P0.3** — Baseline dbmate (schema-v1.2 → migration 0001).
3. **P0.4** — `packages/db` (drizzle-kit pull, client, withOrgContext).
4. **P0.5** — `packages/shared` (codes d'erreur, schémas zod de base).
5. **P0.6** — `apps/api` minimal (env, pino, request-id, OTel, /health, /openapi.json).
6. **P0.7** — CI GitHub Actions.
7. **P1 — Design system en code** (thème Nuxt UI, spike D27 d'abord) — en parallèle de P2.
8. Chantiers hors code : A. marges et prix (avant fin P3) · B. prompts v2 + évaluations des 14 capacités internes (avant fin P4) · C. POC OAuth 2.1 (lot P2.7) · D. CGU / DPA / confidentialité (avant bêta publique).
Détail, ordre et critères de fin : `docs/reference/08-plan-construction.md`.

## 🏗️ Decisions
- Source unique : `docs/reference/06-journal-decisions.md` (ne pas dupliquer ici).

## ⚠️ Known issues
- D26 : serveur OAuth 2.1 via `oidc-provider` = POC à valider.
- D27 : Nuxt UI à confirmer contre shadcn-vue lors de `packages/ui`.
- Nom définitif du produit non choisi (`brand.name` en paramètre).
- Prix des plans provisoires (D20).
