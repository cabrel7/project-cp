---
name: cp-devops
description: Infrastructure et déploiement de project-cp — Docker Compose sur VPS-4 OVH (budget mémoire), Nginx/TLS, services auto-hébergés (PostgreSQL 18, Redis, LiteLLM, Temporal, Infisical, Langfuse, ClickHouse, SeaweedFS, Grafana/Loki/Tempo/Prometheus, GlitchTip), CI GitHub Actions, migrations dbmate en déploiement, sauvegardes, sessions Claude Code cloud.
---

# DevOps — project-cp

> Sources : `docs/reference/03-architecture-technique.md` §1-§3 · `docs/reference/01-specification-produit.md` §8 (infrastructure), §10 (déploiement progressif).

## Cible
VPS-4 OVH : 8 vCores, 24 Go RAM, 200 Go ; Docker Compose ; ≈ 12-13 Go de RAM utilisés au total → **limites mémoire obligatoires** par service.
Stockage objet (D51, D52) : SeaweedFS auto-hébergé (dev et prod, défaut) ; OVH Object Storage en option, basculable depuis l'admin. MinIO abandonné.

## `infra/`
```
infra/
  docker-compose.yml          # prod : images épinglées (tag@sha256), healthchecks, mem_limit, restart: unless-stopped, réseaux internes
  docker-compose.dev.yml      # dev : ports exposés, volumes, SeaweedFS, Mailpit ; sans Docker : infra/scripts/dev-native.sh (PG 18 + Redis)
  nginx/                      # api., mcp., auth., app., admin. + TLS (certbot) + en-têtes sécurité ; nginx -t avant reload
  litellm/config.yaml         # déploiements de modèles (noms alignés sur ai.model_deployments), sans clé en clair (env Infisical)
  temporal/                   # dynamic config, namespace
  grafana/ prometheus/ loki/ tempo/   # tableaux de bord et alertes
  scripts/                    # backup.sh, restore.sh, deploy.sh
```
Services applicatifs : `api`, `mcp-runtime`, `auth`, `worker`, `agent-worker`, `web`, `admin` (images construites par la CI, une par app).

## Secrets
Infisical auto-hébergé : les conteneurs reçoivent leurs variables au démarrage (`infisical run --` ou agent Infisical) ; rien dans `docker-compose.yml`
ni dans le dépôt ; `.env.example` documente chaque variable (description, sensible oui/non).

## Déploiement (ordre)
1. CI verte sur `main` (voir ci-dessous) → images poussées (registre GHCR).
2. Sauvegarde Postgres à chaud vérifiée.
3. `dbmate --wait --no-dump-schema up` (connexion propriétaire des migrations, pas `app_*`) — migrations rétro-compatibles (expand → contract).
4. `docker compose pull && docker compose up -d --no-deps <service>` service par service ; healthcheck `/health` ; workers Temporal : arrêt propre (drain).
5. Vérification (santé, erreurs GlitchTip, latence) ; retour arrière = image précédente (les migrations expand restent compatibles).
Déploiement progressif fonctionnel via feature flags (`platform.feature_flags`), pas via l'infra.

## CI (GitHub Actions)
`pnpm install --frozen-lockfile` → `biome ci` → `turbo typecheck` → `turbo test` (Postgres/Redis en services) → base neuve + toutes les migrations +
`db/tests` → `drizzle-kit pull` et `git diff --exit-code` → `squawk` sur les migrations modifiées → build → Playwright (Chromium de l'image CI) →
images. Cache pnpm + turbo.

## Sauvegardes et exploitation
pgBackRest (ou `pg_dump` quotidien + archivage WAL) chiffré, copie hors site, **restauration testée mensuellement** ; partitions créées par job
(`util.ensure_monthly_partitions`) ; rétention par détachement de partitions ; alertes : disque > 80 %, RAM, erreurs 5xx, latence p95, file BullMQ,
workflows Temporal en échec, crédits de l'organisation 0.

## Sessions Claude Code cloud
- `.claude/scripts/setup-cloud.sh` (idempotent ; `--quick` au démarrage via le hook) : jq, pnpm, ffmpeg, dbmate, squawk, `pnpm install`.
- Chromium préinstallé `/opt/pw-browsers` : **jamais** `playwright install`.
- Réseau sortant limité aux registres (npm, apt, GitHub) : pas d'accès aux services de prod ; pas de Docker en général → Testcontainers
  indisponible (utiliser `DATABASE_URL_TEST` ou laisser la CI exécuter).

## Anti-patterns
Service sans limite mémoire · image `:latest` · secret dans un fichier versionné · `nginx restart` · migration destructive dans le même
déploiement que le code qui cesse de l'utiliser · sauvegarde jamais restaurée · `playwright install` en cloud.
