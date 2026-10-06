# Kit Claude Code — project-cp

Kit **propre au dépôt** : agents, skills, hooks et commandes versionnés avec le code. Il fonctionne seul en session
**cloud** (Claude Code sur le web : pas de `~/.claude`) et cohabite avec le **système global v4** en local, sans le modifier.

## Installation
Décompresser l'archive **à la racine du dépôt** (le dossier qui contiendra `apps/`, `packages/`…), puis commiter.
Aucun script d'installation, rien d'écrit dans `~/.claude`.
```
<racine>/
  CLAUDE.md  PROJECT_CONTEXT.md  PROJECT_STATE.md  .claudeignore  .gitignore
  docs/{README.md, maquettes.md, reference/, design-system/}
  db/schema-v1.2/
  .claude/{settings.json, guard-rules.tsv, agents/, skills/, hooks/, commands/, scripts/}
```
Si le dépôt a déjà un `.gitignore`, fusionner à la main.

## Contenu
| Type | Éléments |
|---|---|
| Agents (10) | `architect` (opus, lecture seule) · `database` · `backend` · `frontend` · `tester` · `reviewer` · `devops` · `e2e-tester` · `regression-checker` · `ux-reviewer` |
| Skills (18, préfixe `cp-`) | `cp-ui-ux` · `cp-nuxt` · `cp-hono` · `cp-api-contract` · `cp-monorepo` · `cp-database` · `cp-ai-runtime` · `cp-guardrails` · `cp-mcp-runtime` · `cp-agents-temporal` · `cp-billing` · `cp-auth` · `cp-testing` · `cp-playwright` · `cp-ffmpeg` · `cp-security` · `cp-performance` · `cp-devops` |
| Hooks (3) | `cp-guard-pretool.sh` (PreToolUse, bloque les violations de `guard-rules.tsv`) · `cp-subagent-test-gate.sh` (SubagentStop : biome + vitest related par paquet, **tests sautés bloquants**, squawk + dbmate pour les migrations) · `cp-session-start.sh` (état du projet + outillage ; prépare la session cloud) |
| Commandes (6) | `/feature` · `/status` · `/audit-rules` · `/guard` · `/setup` · `/retrospective` |
| Règles | `guard-rules.tsv` : 16 invariants bloquants (secrets, `any`, Options API, `process.env`, endpoint OpenAI, prompt en dur, couleur en dur, drizzle-kit, `sql.raw`, `app_admin`, flottants en facturation, `console.*`, fetch dans un composant, bigint exposé, id interne exposé, DELETE/DDL dans un connecteur SQL) |

## Cohabitation avec le système global v4 (local)
- **Agents** : même nom qu'un agent global → la version du projet est prioritaire dans ce dépôt.
- **Skills** : préfixe `cp-` → aucune collision avec `ui-ux`, `vue3`, `nitro`… du système global (qui restent disponibles).
- **Hooks** : le hook global `guard-pretool.sh` lit déjà `.claude/guard-rules.tsv` du projet ; `cp-guard-pretool.sh` détecte sa présence
  dans `~/.claude/settings.json` et se retire (pas de double contrôle). Idem pour l'injection de `PROJECT_STATE.md` au démarrage.
  Le gate global (`frontend/`, `backend/`) ne trouve rien dans ce monorepo ; le gate `cp-` fait le travail.
- **Permissions** : `permissions.ask` du projet s'ajoute à celle du global.

## Session cloud
- `cp-session-start.sh` détecte `CLAUDE_CODE_REMOTE=true` et lance `.claude/scripts/setup-cloud.sh --quick` (jq, pnpm, ffmpeg, `pnpm install`).
- Chromium est préinstallé (`/opt/pw-browsers`) : **ne jamais lancer `playwright install`**.
- `/setup` fait la préparation complète (dbmate, squawk, psql).
- Pas de Docker en général : Testcontainers se replie sur `DATABASE_URL_TEST` ou reste en CI.

## Protocole v5 (2026-10-06)
Repris du système global v5 **à la main** (pas de `--sync`, qui écraserait les agents et `/feature` propres au projet) :
- `CLAUDE.md` § PROTOCOLE DE TRAVAIL : classification, tier (`PROJECT_CONTEXT.md` : critique / actif), agents et skills
  impératifs, TDD backend/base (critères `CA-n` → RED → GREEN), UI par exemples + maquettes, preuves, finale.
- Agents : plus de `isolation: worktree` ; `skills:` préchargés + **ÉTAPE 0** (Read obligatoire, livrable commençant par
  `Skills lus : …`) ; reviewer en opus avec contrôles de process ; tester/backend/database avec le cycle TDD.
- Boucle d'apprentissage : `ISSUES.log` (versionné) + `/retrospective`.

## Non testé à ce jour (à vérifier au premier usage)
- Mode « kit dans le dépôt » en local à côté du système v4 (détection et retrait des hooks en double).
Retours → adapter le système global plus tard (mode projet + cloud), sans toucher à ce kit entre-temps.
