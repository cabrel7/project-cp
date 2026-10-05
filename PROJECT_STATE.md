# STATE — project-cp
Updated: 2026-09-30 | Session: P1 — Design system en code

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
- **P1.0 — Spike D27** : comparaison Nuxt UI vs shadcn-vue — 3 composants témoins (Button, DataTable, Stepper) en clair/sombre/mobile, captures Playwright, code Vue SFC comparatif. Verdict : **Nuxt UI** (6/8 vs 4/8). D27 ✅ validée. PR #9 squash-merged dans dev.

- **P1.1 — Thème Nuxt UI** : `packages/ui` layer Nuxt (tokens.json → tokens.css → `@theme static` Tailwind v4 → app.config.ts Nuxt UI). 39 couleurs sémantiques, 7 échelles Nuxt UI (primary/secondary/success/warning/error/info/warm) interpolées OKLCH, typographie 12 styles (3 familles @fontsource : Plus Jakarta Sans, Geist, Geist Mono), ombres, espacement 4px, rayons, tailles de contrôle, z-index, points de rupture, focus-ring. Pont `--ui-*` pour Nuxt UI. Mode sombre `.dark` + `useColorMode`. Icônes Lucide embarquées localement. Page de démo (palette 31 pastilles, boutons, typographie, icônes, interrupteur sombre). 160 tests (7 fichiers) passés, 42/42 turbo tasks. Reviewer : 2 MAJOR corrigés (`@theme static`, alias `warm`). Branche `p1/01-theme-nuxt-ui`.

- **P1.2 — 27 composants design system** (`packages/ui`) : 3 sous-lots. P1.2a (10 atomes + infra : Button, TextField, Select, Switch, StatusBadge, Skeleton, Alert, Tabs, RiskTag, useCpToast). P1.2b (11 molécules : ConfirmDialog, DataTable, EmptyState, FilterBar, PageHeader, StatTile, CreditMeter, Stepper, Timeline, SecretField, CodeBlock, useCpCopy). P1.2c (6 organismes : AppShell, ModeToggle, ChatMessage, Chart/ECharts, ApprovalCard, PlanGate, useCpMode, cpChart utils). Infra : `@nuxtjs/i18n` (D53), préfixe `Cp` (D54), tests `@vue/test-utils` + `happy-dom` (D55), echarts + vue-echarts. 408 tests (35 fichiers), typecheck propre. Reviewer P1.2b 8.5/10 (3 MAJOR corrigés), reviewer P1.2c 8.5/10 (4 MAJOR corrigés), UX 6.5/10 (3 CRITICAL corrigés — hauteurs contrôles, hover AA, polices titres). Branche `p1/02-components-p12a`.

- **P1.3 — AppShell + navigations définitives** (`packages/ui`) : AppShell refactorisé (skip link, tiroir animé 250ms, scrim, inert, matchMedia resize, tabs mobile), AdminShell (nav compacte sm, arrêt d'urgence, timer, 2FA, tiroir), SidebarNav réutilisable (groupes, badges, liens externes safeHref, tailles md/sm), OrgSelector, useClientNav (19 items Simple/Technique, docsUrl), useAdminNav (19 items). i18n fr/en (~80 clés cp.nav.*, cp.adminNav.*, cp.admin.*). Thème : @utility z-sticky/z-drawer/z-modal/z-toast, --max-width-*. 497 tests (40 fichiers). Reviewer 8/10 (5 MAJOR corrigés : safeHref, noopener noreferrer, invisible drawer, 2FA sr-only, computed import). UX reviewer : C1 z-index corrigé, M1/M2/M6/M7 corrigés. Branche `claude/jolly-johnson-qbhlwb`.

- **P1.4 — Gabarits G1-G8** (`packages/ui`) : 8 composants CpLayout* de présentation pure (LayoutList, LayoutDetail, LayoutWizard, LayoutDashboard, LayoutSettings, LayoutConversation, LayoutEditor, LayoutAuth). 11 clés i18n `cp.layout.*` (fr/en). UTextarea stub ajouté. 572 tests (48 fichiers). Reviewer 8.5/10 (3 MAJOR corrigés : `<main>` imbriqué → `<div>`/`<section>`, slot default dupliqué, import CpPageHeader manquant). UX 7.0/10 (2 CRITICAL corrigés : G6 role="log" + z-sticky + aria-label textarea, G8 min-h-dvh + shadow-sm). Branche `claude/jolly-johnson-qbhlwb`.

## 🔄 Active
- Aucun lot en cours.

## 📋 Queue
7. **P1 — Design system en code** (P1.1 ✅, P1.2 ✅, P1.3 ✅, P1.4 ✅, prochains lots P1.5+) — en parallèle de P2.
8. Chantiers hors code : A. marges et prix (avant fin P3) · B. prompts v2 + évaluations des 14 capacités internes (avant fin P4) · C. POC OAuth 2.1 (lot P2.7) · D. CGU / DPA / confidentialité (avant bêta publique).
Détail, ordre et critères de fin : `docs/reference/08-plan-construction.md`.

## 🏗️ Decisions
- Source unique : `docs/reference/06-journal-decisions.md` (ne pas dupliquer ici).

## ⚠️ Known issues
- D26 : serveur OAuth 2.1 via `oidc-provider` = POC à valider.
- D27 : Nuxt UI ✅ validée — responsive mobile-first vérifié P1.1 (grilles 2→4→6 colonnes, min-h-11 tactile).
- P1.1 : i18n FR/EN non encore appliqué sur la page de démo (texte français en dur — DETTE, lot ultérieur). Contraste pastilles chart décoratifs limité à 2.0:1 (couleur = information, label secondaire).
- P1.2 — UX MAJOR restants (non bloquants) : ApprovalCard « Refuser » devrait être secondary ; ChatMessage disclaimer par défaut activé ; Alert devrait lire useCpMode au lieu de prop ; DataTable manque mobile cards, alignement montants, colonnes technicalOnly ; ConfirmDialog saisie confirmation ; Chart reduced-motion, formats localisés, > 6 séries ; PlanGate aperçu grisé + slot ; TextField/Select role="alert" sur erreur, props form ; persistance useCpMode via API.
- P1.4 — UX MAJOR/MINOR restants (non bloquants) : G7 palette/propriétés hidden sous lg (tiroir ou vue liste forcée) ; G1/G2/G4 pas de prop error/empty (états délégués à l'appelant) ; G1 double rendu desktop/mobile-cards ; G3 sticky footer sans safe-area-inset-bottom, boutons < 48px mobile, pas d'indicateur brouillon, details open non contrôlé ; G5 sections v-show pas v-if, danger non trié en dernier ; G2 tabs sans tabpanel/aria-controls, aside sans aria-label ; G6 Enter sans isComposing (IME), h2 sans h1, pas de défilement auto ; G4 pas de slot filtres de période ; G8 min-h-dvh dans slot AppShell (OK hors shell).
- P1.3 — UX MINOR/deferred : SidebarNav en `<button>` sans `<ul>/<li>` (pas de NuxtLink ni regroupement ARIA) ; OrgSelector sans `aria-haspopup` ni workspace ; topbar admin peut déborder à 360px (minuteur à masquer sous sm) ; topbar client serrée à 360px ; tabbar hors inert derrière tiroir, pas de safe-area-inset-bottom, badge text-[10px] → text-caption ; badges sans plafond 99+ ; skip link sans tabindex="-1" (Safari) ; pas de transition hover/active 150ms sur items nav ; piège focus incomplet (input/select/textarea) ; logique tiroir dupliquée → extraire useDrawer ; « AI Access/Functions » → minuscule en EN ; icône admin compliance book-copy → scroll-text ; CpNavItem manque champ `locked` pour PlanGate ; pas de maquette mobile navigation (trou design).
- Nom définitif du produit non choisi (`brand.name` en paramètre).
- Prix des plans provisoires (D20).
- Partitions `usage.runs` pré-créées jusqu'à 2026-12 ; maintenance mensuelle à automatiser (job worker P3).
