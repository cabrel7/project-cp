---
name: cp-monorepo
description: Organisation du monorepo project-cp — pnpm workspaces + turborepo, paquets @cp/*, TypeScript strict partagé, Biome, lefthook, changesets, commits conventionnels, scripts standard par paquet. Lire avant de créer un paquet/une app, d'ajouter une dépendance ou de toucher à la CI.
---

# Monorepo — project-cp

> Source : `docs/reference/03-architecture-technique.md` §4.3 et §5.

## Arborescence
```
apps/{api,mcp-runtime,auth,worker,agent-worker,web,admin}
packages/{db,shared,guard,connectors,billing,ui,sdk-ts}
db/{migrations,tests}   infra/   docs/   .claude/
pnpm-workspace.yaml  turbo.json  biome.json  lefthook.yml  tsconfig.base.json  .changeset/
```
Noms de paquets : `@cp/<nom>` (ex. `@cp/db`, `@cp/shared`) ; apps : `@cp/api`, `@cp/web`… Seul `@cp/sdk-ts` est publié (nom public à définir avec la marque).

## Règles de dépendances (sens unique)
- `apps/*` → `packages/*` ; jamais l'inverse ; jamais `apps/x` → `apps/y`.
- `@cp/shared` ne dépend de rien d'interne (schémas zod, codes d'erreur, types, constantes) — importable front ET back.
- `@cp/db` : schéma Drizzle (pull), client, `withOrgContext`, fonctions transactionnelles. Jamais importé par web/admin.
- `@cp/billing`, `@cp/guard`, `@cp/connectors` : logique serveur, sans Hono (testables seuls).
- `@cp/ui` : layer Nuxt (thème + composants) pour web et admin.
- Dépendances communes épinglées via `catalog:` dans `pnpm-workspace.yaml` (une seule version de zod, drizzle, vue…).
- Ajout de dépendance : vérifier d'abord la liste de 03 §4 (ne jamais réimplémenter ce qui existe) ; version stable la plus récente ; `pnpm --filter <pkg> add`.

## Scripts standard (chaque paquet)
`dev` · `build` · `typecheck` (`tsc --noEmit` / `nuxi typecheck`) · `test` (`vitest run`) · `lint` (`biome check .`).
Racine : `pnpm turbo run <tâche>` ; ciblé : `pnpm turbo run test --filter=@cp/api` ; depuis un changement : `--filter=...[origin/main]`.
`turbo.json` : `build` dépend de `^build`, sorties `dist/**`, `.output/**` ; `test` et `typecheck` en cache.

## TypeScript
`tsconfig.base.json` : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler`,
`target: ES2023`. Pas de `any` (guard), pas de `@ts-ignore` (→ `@ts-expect-error` + raison). Node 22 LTS minimum.

## Biome
Lint + format uniques (pas d'ESLint/Prettier). Règles : `noExplicitAny: error`, `noConsole: error` (sauf scripts), imports triés.
`pnpm biome check --write` avant commit (lefthook le fait sur les fichiers indexés).

## lefthook
- `pre-commit` : biome sur les fichiers indexés ; squawk sur `db/migrations/*.sql` indexés.
- `commit-msg` : commits conventionnels (`feat(api): …`, `fix(web): …`, `chore(db): …`).
- `pre-push` : `turbo run typecheck test --filter=...[origin/main]`.

## Changesets
Uniquement pour `@cp/sdk-ts` (et futurs SDK) : `pnpm changeset` à chaque changement public ; publication par la CI (jamais à la main).

## Nouveau paquet / app — checklist
- [ ] `package.json` (`name: @cp/x`, `type: module`, `exports`, scripts standard)
- [ ] `tsconfig.json` qui étend la base ; `vitest.config.ts`
- [ ] Ajouté à `turbo.json` si tâche spécifique
- [ ] Mentionné dans `CLAUDE.md` / `docs/reference/03` §5 s'il change l'organisation (décision au journal 06 d'abord)
