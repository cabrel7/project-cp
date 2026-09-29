# project-cp

Plateforme qui rend n'importe quel système compatible avec l'IA (connecteurs + MCP Builder, AI Runtime, agents, SDK, Marketplace). Produit du Groupe ELS. Nom provisoire : toujours écrire `project-cp`.

## Fichiers de référence (lire AVANT de coder)
- `PROJECT_STATE.md` → où on en est (injecté au démarrage).
- `PROJECT_CONTEXT.md` → résumé métier + carte de la documentation (à la demande).
- `docs/reference/00-index.md` → index. Priorité en cas de contradiction : 06 (décisions) > 02 (règles) > 01 (produit) > 03/04/05 ; pour les données, **le SQL fait foi**.
- `docs/reference/08-plan-construction.md` → phases, lots et critères de fin : l'architect y lit le périmètre de chaque lot.
- `docs/design-system/` → tokens, patterns (8 gabarits), 27 composants, glossaire Simple/Technique.
- `db/schema-v1.2/` → schéma validé (23 contrôles), à convertir en migration de base dbmate.

## Stack
TypeScript strict partout · pnpm + turborepo · Biome · Hono (api, mcp-runtime) · Nuxt 4 + Nuxt UI + Tailwind v4 (web, admin) · PostgreSQL 18 + pgvector · dbmate + Squawk · Drizzle (lecture seule du schéma) · Redis/BullMQ · Temporal · LiteLLM + Vercel AI SDK · Vitest, Testcontainers, MSW, Playwright.

## Organisation
`apps/{api,mcp-runtime,auth,worker,agent-worker,web,admin}` · `packages/{db,shared,guard,connectors,billing,ui,sdk-ts}` · `db/{migrations,tests}` · `infra/` · `docs/`.
Skills du projet : `.claude/skills/cp-*` (préfixe `cp-`). Agents : `.claude/agents/`. Commandes : `/feature` · `/status` · `/audit-rules` · `/guard` · `/setup`. Guide du kit : `.claude/README.md` ; correspondance des docs : `docs/README.md`.
Session cloud : Chromium préinstallé → ne jamais lancer `playwright install`.

## INVARIANTS (vérifiés par hook — `.claude/guard-rules.tsv`)
1. IDs hybrides : `bigint` interne, **UUIDv7 `public_id` seul exposé** (API, URL, SDK, logs clients).
2. Multi-tenant : toute table métier a `organization_id` + RLS ; toute requête client passe par la transaction de contexte (`app.org_id`, `app.user_id`).
3. Schéma = SQL versionné (dbmate). **Jamais** `drizzle-kit generate/push/migrate`, seulement `pull`.
4. **Aucun endpoint compatible OpenAI** ; l'IA passe par les capacités (`ai.run`) et le routage (profils Flash/Smart/Max).
5. Prompts système **uniquement en base** (`ai.capability_versions`), jamais en dur dans le code.
6. Toute action réelle d'un modèle passe par des contrôles déterministes (policy, bornes, approbation) ; suppression et financier = approbation obligatoire.
7. Argent : micro-crédits en `bigint`, jamais de flottant ; grand livre en ajout seul.
8. Secrets : coffre (Infisical) uniquement ; config via le module d'environnement typé, jamais `process.env` éparpillé.
9. UI : tokens du design system uniquement (aucune couleur en dur) ; tous les textes via i18n FR/EN ; libellés selon le glossaire Simple/Technique.
10. Pas de `console.log` : logger `pino`.

## Façon de travailler
Feature = `/feature` : architect → database → backend → frontend → tester → reviewer (+ ux-reviewer, e2e-tester). Tout agent **conteste** un brief bancal avant d'exécuter. Toute affirmation « ça marche » est accompagnée de la sortie brute des commandes.

## État du projet
Après chaque modification significative → mettre à jour `PROJECT_STATE.md` (✅ Done · 🔄 Active · 📋 Queue · 🏗️ Decisions · ⚠️ Known issues). Toute nouvelle décision → `docs/reference/06-journal-decisions.md` d'abord.
