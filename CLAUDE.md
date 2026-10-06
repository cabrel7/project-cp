# project-cp

Plateforme qui rend n'importe quel système compatible avec l'IA (connecteurs + MCP Builder, AI Runtime, agents, SDK, Marketplace). Produit du Groupe ELS. Nom provisoire : toujours écrire `project-cp`.

## Fichiers de référence (lire AVANT de coder)
- `PROJECT_STATE.md` → où on en est (injecté au démarrage).
- `PROJECT_CONTEXT.md` → résumé métier + carte de la documentation (à la demande).
- `docs/reference/00-index.md` → index. Priorité en cas de contradiction : 06 (décisions) > 02 (règles) > 01 (produit) > 03/04/05 ; pour les données, **le SQL fait foi**.
- `docs/reference/08-plan-construction.md` → phases, lots et critères de fin : l'architect y lit le périmètre de chaque lot.
- `docs/design-system/` → tokens, patterns (8 gabarits), 27 composants, glossaire Simple/Technique.
- `db/migrations/` → schéma versionné (dbmate, source de vérité) ; `db/schema-v1.2/` = référence d'origine.

## Stack
TypeScript strict partout · pnpm + turborepo · Biome · Hono (api, mcp-runtime) · Nuxt 4 + Nuxt UI + Tailwind v4 (web, admin) · PostgreSQL 18 + pgvector · dbmate + Squawk · Drizzle (lecture seule du schéma) · Redis/BullMQ · Temporal · LiteLLM + Vercel AI SDK · Vitest, Testcontainers, MSW, Playwright.

## Organisation
`apps/{api,mcp-runtime,auth,worker,agent-worker,web,admin}` · `packages/{db,shared,guard,connectors,billing,ui,sdk-ts}` · `db/{migrations,tests}` · `infra/` · `docs/`.
Skills du projet : `.claude/skills/cp-*` (préfixe `cp-`). Agents : `.claude/agents/`. Commandes : `/feature` · `/status` · `/audit-rules` · `/guard` · `/setup` · `/retrospective`. Guide du kit : `.claude/README.md` ; correspondance des docs : `docs/README.md`.
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

## PROTOCOLE DE TRAVAIL (v5 — s'applique à TOUTE demande, en local comme en cloud)
1. **Classer** : *triviale* (question, doc, fix d'une ligne évident, renommage) → exécution directe.
   Tout le reste (code de `apps/`, `packages/`, `db/`, CI) = **feature** → pipeline ci-dessous, **même sans `/feature`**.
2. **Tier** (`PROJECT_CONTEXT.md`) : `tier_domaine: critique` · `tier_codebase: actif`. Rigueur maximale :
   reviewer en opus, sévérité CRITICAL+MAJOR corrigés, tests de régression, E2E sur chaque parcours touché.
3. **Agents IMPÉRATIFS** (jamais « si besoin ») : la session principale ORCHESTRE et ne code pas une feature elle-même.
   architect → (database) → tester RED → backend/database GREEN → frontend → tester → reviewer
   (+ regression-checker si l'existant change, + ux-reviewer et e2e-tester s'il y a de l'interface).
4. **Skills IMPÉRATIFS** : chaque agent lit ses skills `cp-*` (préchargés + Read explicite) AVANT d'agir, plus le
   skill du domaine (auth, billing, ai-runtime…). Livrable sans ligne `Skills lus : …` = rejeté.
5. **Cycle adapté par couche** :
   - backend / logique / base → **TDD** : critères `CA-n` (Étant donné / Quand / Alors) de l'architect → tests RED
     (vus échouer) → code GREEN → refactor ; > 3 cycles sans succès → retour à l'architect.
   - interface → pas de test d'abord : lire 2-3 composants existants similaires + contrat zod + maquette → coder →
     tests composant → ux-reviewer → planche de comparaison aux maquettes.
6. **Preuves** : toute affirmation « ça marche » est accompagnée de la sortie brute. **Un test sauté n'est pas réussi** :
   compte rendu `passés / échoués / sautés` + raison de chaque saut. Les tests PostgreSQL/Redis se lancent dans la
   session (`pnpm infra:up`, mode natif sans Docker) ET existent dans la CI. Jamais « exécuté en CI » sans l'avoir vérifié.
7. **Finale** : `PROJECT_STATE.md` à jour ; chaque erreur évitable de la session → une ligne dans `ISSUES.log`
   (`date | agent | symptôme | cause | règle proposée`) ; `/retrospective` transforme les répétitions en guard-rules ou skills.
Tout agent **conteste** un brief bancal avant d'exécuter (arbitrage : 06 > 02 > 01 > 03/04/05 ; SQL pour les données).

## État du projet
Après chaque modification significative → mettre à jour `PROJECT_STATE.md` (✅ Done · 🔄 Active · 📋 Queue · 🏗️ Decisions · ⚠️ Known issues). Toute nouvelle décision → `docs/reference/06-journal-decisions.md` d'abord.
