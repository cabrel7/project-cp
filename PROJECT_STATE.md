# STATE — project-cp
Updated: 2026-09-29 22:55 | Session: préparation (aucun code applicatif)

## ✅ Done
- Documentation de référence v2 : `docs/reference/00` à `07` (produit, règles, architecture, schéma, garde-fous, décisions D01-D50, UI/UX).
- Schéma PostgreSQL v1.2 : `db/schema-v1.2/` — 181 tables, RLS, 21 tests passés sur base neuve.
- Design system « project-cp » (tokens, 8 gabarits, 27 composants) : `docs/design-system/`.
- Maquettes de validation (7 pages) : authentification, onboarding, tableau de bord, MCP Builder, studios, admin IA, navigation.
- Kit Claude Code propre au projet : `.claude/` (10 agents, 18 skills `cp-*`, 3 hooks, 5 commandes).
- Plan de construction `docs/reference/08-plan-construction.md` (D50, 🟡 à valider).
- Maquettes dans le dépôt : `docs/maquettes/` (43 captures + sources HTML) ; profil mobile corrigé (3 profils).
- Profils d'onboarding alignés sur D41 : prompt `system.onboarding.copilot` + contrainte `ux.onboarding_progress.profile` (`activity`, `builder`, `enterprise`) ; 21 tests OK.

## 🔄 Active
- Validation du plan 08 (D50) par Dylan.

## 📋 Queue
1. **P0 — Socle** (lots P0.1 à P0.7 : monorepo, infra dev, baseline dbmate, packages/db, shared, api minimal, CI).
2. **P1 — Design system en code** (thème Nuxt UI, spike D27 d'abord) — en parallèle de P2.
3. Chantiers hors code : A. marges et prix (avant fin P3) · B. prompts v2 + évaluations des 14 capacités internes (avant fin P4) · C. POC OAuth 2.1 (lot P2.7) · D. CGU / DPA / confidentialité (avant bêta publique).
Détail, ordre et critères de fin : `docs/reference/08-plan-construction.md`.

## 🏗️ Decisions
- Source unique : `docs/reference/06-journal-decisions.md` (ne pas dupliquer ici).

## ⚠️ Known issues
- D26 : serveur OAuth 2.1 via `oidc-provider` = POC à valider.
- D27 : Nuxt UI à confirmer contre shadcn-vue lors de `packages/ui`.
- Nom définitif du produit non choisi (`brand.name` en paramètre).
- Prix des plans provisoires (D20).
