---
name: cp-testing
description: Stratégie de tests de project-cp — Vitest (unitaires, services, composables), Testcontainers Postgres (RLS réelle), MSW (LiteLLM, systèmes externes, agrégateurs), tests SQL, @nuxt/test-utils, @temporalio/testing, fixtures multi-organisations, preuve d'exécution. E2E → cp-playwright.
---

# Tests — project-cp

> Règle d'or : un test vérifie une **règle** de `docs/reference/02-regles-metier.md` (ou une décision de 06), pas un détail d'implémentation.

## Pyramide
| Niveau | Outil | Où | Quoi |
|---|---|---|---|
| Unitaire | Vitest | `packages/*/src/**/*.test.ts`, services | logique pure, calculs (crédits en bigint), résolution du routage, détecteurs |
| Intégration API | Vitest + `app.request()` + Testcontainers Postgres + Redis | `apps/api/test/` | routes complètes sous RLS, erreurs du catalogue, idempotence |
| SQL | psql / Vitest + Testcontainers | `db/tests/*.sql` | isolation RLS, FK composites, triggers, contraintes (T01…T21 et suivants) |
| Front | `@nuxt/test-utils` + MSW | `apps/web/test/` | composants et composables : loading / empty / error / succès, mode Technique |
| Workflows | `@temporalio/testing` | `apps/agent-worker/test/` | approbations, limites, annulation (temps sauté) |
| E2E | Playwright | `apps/*/e2e/` | parcours critiques (skill `cp-playwright`) |

## Conventions
- `describe('<unité>')` + `it('doit <résultat> quand <condition>')` ; structure AAA ; un comportement par test.
- Fixtures : `createOrg()`, `createWorkspace()`, `createApiKey()`, `withAuth(org, role, plan)` dans `packages/testing` (ou `test/fixtures`) ;
  **toujours deux organisations** dans les tests d'intégration pour prouver l'isolation.
- Données déterministes : UUIDv7 et horloge contrôlés (`vi.useFakeTimers`, `vi.setSystemTime`) ; aucun appel réseau réel (MSW `onUnhandledRequest: 'error'`).
- LiteLLM simulé par MSW : succès, streaming, 429, 5xx, timeout, contexte trop long, usage (tokens) pour vérifier les coûts.
- Testcontainers : image `postgres:18` + pgvector, migrations dbmate appliquées une fois par worker Vitest (`globalSetup`), transaction annulée
  ou base recréée par fichier. Connexion `app_rw` + contexte, jamais superutilisateur pour les tests d'isolation.

## Cas à couvrir systématiquement (project-cp)
- 401 / 403 / 404 inter-organisations (jamais 403 qui révèle l'existence) / 409 `lock_version` / 422 / 429 `Retry-After`.
- Ordre des refus : flag (`PLATFORM_FEATURE_DISABLED`) → plan (`PLATFORM_FEATURE_NOT_AVAILABLE`) → surcharge → budget / crédits.
- Arrêt d'urgence (`EMERGENCY_STOP_ACTIVE`) au démarrage ET en cours de run.
- Idempotence : même clé + même corps = même réponse ; corps différent = `IDEMPOTENCY_KEY_REUSED`.
- Argent : réservation concurrente, régularisation, remboursement selon le code, grand livre immuable.
- IA : jamais de bascule vers un profil plus cher, `routing_source` / `fallback_reason` enregistrés.
- Actions : suppression / financier ⇒ approbation, même si la policy dit « autoriser ».
- Sandbox : portefeuille test, outils simulés, aucun effet réel.

## Commandes
```bash
pnpm --filter @cp/api exec vitest run src/modules/agents          # ciblé
pnpm --filter @cp/api exec vitest related --run <fichiers>        # ce que lance le gate SubagentStop
pnpm turbo run test --filter=...[origin/main]                     # paquets impactés
pnpm --filter @cp/api exec vitest run --coverage
```
Session cloud sans Docker : Testcontainers indisponible → utiliser `DATABASE_URL_TEST` si fourni, sinon marquer ces tests « CI seulement »
(`describe.skipIf(!hasDocker)`) et le DIRE dans le livrable.

## Preuve
Tout test livré s'accompagne de la **sortie brute** d'exécution. Un vert non montré n'existe pas ; un test sauté est signalé.

## Couverture cible
`packages/billing`, `packages/guard`, `packages/db` (fonctions transactionnelles) ≥ 90 % · services ≥ 85 % · routes ≥ 80 % · composants ≥ 70 %
(nominal + erreur obligatoires). La couverture ne remplace pas les cas de la liste ci-dessus.
