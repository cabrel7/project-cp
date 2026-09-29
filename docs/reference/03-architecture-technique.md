# Architecture technique

> **Nom de code :** `project-cp` · **Statut :** référence · Date : 29 septembre 2026
> Reprend et met à jour la partie « infrastructure » de la description v1 (archivée) : chaque service, son rôle, sa place, ses liens.

---

## 1. Vue d'ensemble

```
            Clients : dashboard (Nuxt) · admin (Nuxt) · SDK · CLI · Claude / ChatGPT / Cursor (MCP)
                                         │
                                   Nginx (TLS)
          ┌──────────────┬───────────────┼────────────────┬───────────────┐
          ▼              ▼               ▼                ▼               ▼
      web (Nuxt)    admin (Nuxt)   api (Hono)      mcp-runtime (Hono)   auth (OAuth 2.1)
                                         │                │
                        ┌────────────────┼────────────────┤
                        ▼                ▼                ▼
                 worker (jobs)   temporal-worker (agents)  guard (garde-fous)
                        │                │                │
   ─────────────────────┴────────────────┴────────────────┴──────────────────────
   PostgreSQL 18 + pgvector · Redis · ClickHouse · Stockage S3 (SeaweedFS local ou OVH) · Infisical · LiteLLM · Temporal · Langfuse
   Observabilité : OpenTelemetry → Grafana (Prometheus, Loki, Tempo) · GlitchTip (erreurs)
```

- **Monolithe modulaire** : un seul code TypeScript (monorepo), plusieurs **processus** (api, mcp-runtime, worker, temporal-worker). Pas de microservices.
- **Services tiers auto-hébergés** qu'on **branche sans les réécrire** : LiteLLM, Temporal, Infisical, Langfuse, ClickHouse, OPA (embarqué en WebAssembly).
- **Hébergement :** VPS-4 OVH (8 vCores, 24 Go, 200 Go) en Docker Compose, environ 12 à 13 Go de RAM utilisés.

---

## 2. Rôle de chaque service

| Service | Pourquoi | Où il intervient | Liens |
|---|---|---|---|
| **Hono** (API) | Rapide, TypeScript natif, OpenAPI généré depuis Zod → SDK générés | Logique métier, API publique, webhooks | Appelle LiteLLM, Temporal, Postgres, Redis, Infisical ; écrit l'outbox |
| **mcp-runtime** (Hono + SDK MCP) | Un seul service pour tous les serveurs MCP, piloté par configuration | `mcp.<domaine>/{serveur}` | Lit la version active (Redis/Postgres), passe par *guard*, récupère les secrets, appelle les connecteurs |
| **Nuxt** (web + admin) | Framework Vue full-stack, rendu serveur, i18n | Dashboard client, back-office séparé | Appelle uniquement l'API (jamais la base) ; temps réel en SSE |
| **PostgreSQL 18 + pgvector** | Relationnel robuste, RLS, partitions, JSONB, vecteurs | Toutes les données métier | Source de vérité ; les secrets n'y sont jamais |
| **Redis** | Mémoire rapide | Cache des configurations, rate limit, budgets en temps réel, files BullMQ, disjoncteurs, arrêts d'urgence | Invalidé par l'outbox |
| **LiteLLM** | Proxy unifié vers plus de 100 fournisseurs | Tous les appels aux modèles | Clés dans l'environnement ; routage et bascule ; coûts par appel |
| **Vercel AI SDK** | Streaming, outils, sortie structurée | Côté API, par-dessus LiteLLM (compatible OpenAI) | — |
| **Temporal** | Exécution durable des agents (reprise après crash, attente d'approbation, timeouts) | Runs d'agents | Appelle LiteLLM, mcp-runtime, *guard* |
| **Infisical** | Coffre de secrets séparé et chiffré | Identifiants des connecteurs, BYOK, clés fournisseurs | Lu au moment de l'appel, jamais stocké ailleurs |
| **OPA (WebAssembly)** | Politiques déclaratives évaluées **dans le processus**, en quelques millisecondes | Avant chaque appel d'outil | Politiques compilées depuis la base |
| **ClickHouse** | Analytique à grand volume | Historique long des usages, tableaux de bord, marges | Alimenté par l'outbox |
| **Langfuse** | Traces des appels aux modèles, qualité, comparaison de prompts | Équipe interne | Reçoit les traces via OpenTelemetry |
| **Stockage objet S3** : SeaweedFS (auto-hébergé) / OVH Object Storage | Fichiers au format S3 sans dépendre d'un fournisseur (D51, D52). SeaweedFS tourne sur notre serveur en dev **et** en production (défaut, gratuit) ; OVH Object Storage en option. Backend actif choisi dans l'admin, migration des fichiers en tâche de fond | Fichiers, exports, factures PDF | Métadonnées et backend de chaque fichier dans `storage.files` / `storage.backends` ; identifiants dans Infisical |
| **GlitchTip** | Suivi d'erreurs gratuit, compatible SDK Sentry | API, workers, front | — |
| **Grafana + Prometheus + Loki + Tempo** | Métriques, journaux, traces | Supervision et alertes | OpenTelemetry |
| **Nginx** | Reverse proxy, TLS | Entrée unique | — |
| **Stainless / Speakeasy** | Génération des SDK multi-langages | Pipeline de publication | Depuis la spec OpenAPI |

---

## 3. Base de données : migrations et ORM

### 3.1 Le problème
- Le schéma va évoluer (colonnes, tables, index) : il faut appliquer chaque changement **dans l'ordre, une seule fois, sur toutes les bases** (local, staging, production) et pouvoir revenir en arrière.
- Le code TypeScript doit connaître la structure des tables pour que les requêtes soient **typées** : une faute de colonne est détectée à la compilation, pas en production.

### 3.2 La solution retenue

| Rôle | Outil | Pourquoi |
|---|---|---|
| **Source de vérité du schéma** | Fichiers **SQL versionnés** | Notre schéma utilise des fonctions avancées de PostgreSQL (RLS, partitions, contraintes d'exclusion, FK composites, `NULLS NOT DISTINCT`, triggers, HNSW) que les générateurs de migrations des ORM gèrent mal ou pas du tout |
| **Application des migrations** | **dbmate** (gratuit, open source) | Un fichier = `-- migrate:up` + `-- migrate:down` ; table `schema_migrations` ; fonctionne en local, en CI et en production |
| **Contrôle de sécurité des migrations** | **Squawk** (linter gratuit) | Bloque les opérations dangereuses en production : index sans `CONCURRENTLY`, `NOT NULL` ajouté sur une grosse table, verrous longs |
| **Accès aux données typé** | **Drizzle ORM** en **lecture du schéma** | `drizzle-kit pull` lit la base migrée et génère les définitions TypeScript. On ne l'utilise **jamais** pour générer des migrations : une seule source de vérité |

### 3.3 Le flux de travail (pour toi et tes agents)
1. Écrire `db/migrations/20261005120000_ajout_x.sql`, avec les parties `up` et `down`.
2. `dbmate up` en local, puis `squawk` sur le fichier.
3. `drizzle-kit pull` régénère `packages/db/schema.ts`.
4. Commit du SQL **et** du TypeScript régénéré.
5. **CI :**
   - base neuve ;
   - toutes les migrations appliquées ;
   - tests SQL (isolation, intégrité) et tests applicatifs ;
   - `drizzle-kit pull` doit donner exactement le fichier commité, sinon échec ;
   - Squawk sur les nouvelles migrations.

Point de départ : le schéma actuel devient la **migration de base** (`0001_baseline`), et les données de référence deviennent des migrations de données idempotentes.

### 3.4 Utilisation dans le code
- Chaque requête « client » passe par une transaction qui pose le contexte :
  ```ts
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true), set_config('app.user_id', ${userId}, true)`)
    return tx.select().from(servers).where(eq(servers.workspaceId, wsId))
  })
  ```
- Les opérations critiques (réserver et débiter des crédits, numéroter une facture, publier une version MCP) sont des **fonctions transactionnelles testées**, en SQL ou en TypeScript, avec verrouillage explicite.
- Trois connexions : `app_rw` (soumis à la RLS), `app_auth` (résolution des jetons), `app_admin` (back-office et jobs).

**Alternatives écartées :** Prisma (mal adapté aux partitions, à la RLS et aux FK composites, plus lent) ; Kysely (bon, mais écosystème plus petit) ; drizzle-kit en générateur de migrations (double source de vérité).

---

## 4. Bibliothèques

> Principe : **ne jamais réimplémenter ce qui existe et qui est fiable.** Versions stables les plus récentes au moment de l'installation ; chaque choix marqué « POC » est à valider par un petit prototype.

### 4.1 Backend (Hono / Node.js)

| Domaine | Bibliothèque | Usage |
|---|---|---|
| Serveur | `hono`, `@hono/node-server` | API, runtime MCP |
| Validation & contrat | `zod`, `@hono/zod-openapi` | Schémas partagés front/back, spec OpenAPI automatique |
| Doc API | `@scalar/hono-api-reference` | Documentation interactive |
| Base | `drizzle-orm`, `postgres` (postgres.js) | Requêtes typées |
| Migrations | `dbmate`, `squawk` (CLI) | Voir §3 |
| Redis & files | `ioredis`, `bullmq` | Cache, jobs légers (emails, webhooks, agrégats) |
| Rate limit | `rate-limiter-flexible` | Limites par clé, organisation, IP (Redis) |
| Agents | `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow` | Exécution durable |
| Modèles | `ai` (Vercel AI SDK), `@ai-sdk/openai-compatible` | Appels via LiteLLM, streaming, outils |
| MCP | `@modelcontextprotocol/sdk` | Protocole MCP côté serveur (et client pour Bring your own MCP) |
| JSON Schema | `ajv`, `ajv-formats` | Validation des paramètres et sorties d'outils |
| OpenAPI (import client) | `@scalar/openapi-parser` | Lire et normaliser les specs des clients |
| Sécurité SQL | `libpg-query` (Postgres), `node-sql-parser` (MySQL…) | Analyse syntaxique : rejet des DELETE, DDL et requêtes multiples |
| Pilotes clients | `postgres`, `mysql2`, `mssql` | Connecteurs base de données |
| HTTP sortant | `undici` | Appels vers les systèmes clients |
| Résilience | `cockatiel` | Relances, disjoncteur, timeout, cloisonnement |
| Politiques | `@open-policy-agent/opa-wasm` | OPA embarqué (quelques ms) |
| Authentification | `arctic` (connexion Google / GitHub…), `@oslojs/crypto`, `@oslojs/otp` (TOTP), `@simplewebauthn/server`, `@node-rs/argon2`, `jose` | Brique par brique, sur **nos** tables `iam` |
| Serveur OAuth 2.1 | `oidc-provider` (panva) — POC | Enregistrement dynamique, PKCE, indicateur de ressource pour Claude et ChatGPT |
| Secrets | `@infisical/sdk` | Coffre |
| Garde-fous | `@huggingface/transformers` (ONNX, CPU) | Classifieurs locaux (injection, hors sujet) |
| Observabilité | `@opentelemetry/sdk-node`, `@hono/otel`, `pino`, `@sentry/node` (vers GlitchTip), `langfuse` | Traces, journaux, erreurs |
| Analytique | `@clickhouse/client` | Écriture et lecture ClickHouse |
| Fichiers | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Un client S3 par backend (`storage.backends`), liens signés |
| Emails | `nodemailer` (+ gabarits HTML) | Notifications |
| Téléphone | `libphonenumber-js` | Numéros africains, OTP |
| Argent | `dinero.js` | Calculs monétaires sans erreurs d'arrondi |
| Dates | `date-fns`, `@date-fns/tz`, `cron-parser` | Fuseaux, planification |
| Sécurité HTTP | middlewares Hono `secure-headers`, `cors`, `csrf` | En-têtes, CORS |
| Tests | `vitest`, `testcontainers`, `msw` | Tests unitaires, Postgres réel, simulation HTTP |
| Client interne | `@hey-api/openapi-ts` | Client TypeScript typé pour le front, depuis la spec |

### 4.2 Frontend (Nuxt 4 — web et admin)

| Domaine | Bibliothèque | Usage |
|---|---|---|
| Composants | `@nuxt/ui` (Tailwind CSS v4, Reka UI) | Bibliothèque officielle Nuxt. **À confirmer lors du travail UI/UX**, contre shadcn-vue |
| État | `pinia` + `@pinia/colada` | État global et cache des requêtes |
| i18n | `@nuxtjs/i18n` | Français / anglais, formats de nombres et de devises |
| Utilitaires | `@vueuse/nuxt` | Composables |
| Formulaires | validation `zod` partagée avec le back | Mêmes règles des deux côtés |
| Tableaux | `@tanstack/vue-table` | Listes de runs, logs, factures (tri, filtres, colonnes) |
| Graphiques | `echarts` + `vue-echarts` | Tableaux de bord façon Power BI, thème sombre |
| Éditeur visuel | `@vue-flow/core` | Agents, flux, cartographie des outils MCP |
| Éditeur de code | `vue-codemirror` (CodeMirror 6) | Prompts, JSON, requêtes SQL (plus léger que Monaco) |
| Rendu | `@nuxtjs/mdc`, `shiki` | Markdown et code dans le chat |
| Chat en streaming | `@ai-sdk/vue` | Interface de chat |
| Ressources | `@nuxt/icon`, `@nuxt/fonts`, `@nuxt/image` | Icônes, polices, images |
| Sécurité | `nuxt-security` | En-têtes, CSP |
| Temps réel | SSE natif (et WebSocket via Nitro si besoin) | Runs en direct, notifications |
| Site et documentation | `@nuxt/content`, `@nuxtjs/seo` | Docs bilingues, landing |
| Catalogue de composants | Histoire (ou Storybook Vue) | Documentation vivante du design system |
| Tests | `@nuxt/test-utils`, `vitest`, `playwright` | Unitaires, bout en bout |

### 4.3 Outillage commun
- **Monorepo :** `pnpm` workspaces + `turborepo`.
- **Qualité :** TypeScript strict, `biome` (lint + format), `lefthook` (hooks git).
- **Conventions :** commits conventionnels, `changesets` pour versionner les SDK.

---

## 5. Organisation du dépôt

```
project-cp/
├── apps/
│   ├── api/            # Hono : API publique + webhooks
│   ├── mcp-runtime/    # Hono : serveur MCP multi-tenant
│   ├── auth/           # serveur OAuth 2.1 (oidc-provider)
│   ├── worker/         # BullMQ : emails, webhooks sortants, agrégats, partitions, facturation
│   ├── agent-worker/   # worker Temporal (exécution des agents)
│   ├── web/            # Nuxt : dashboard client
│   └── admin/          # Nuxt : back-office
├── packages/
│   ├── db/             # schéma Drizzle généré, client, helpers de transaction et de contexte
│   ├── shared/         # schémas Zod, codes d'erreur, types, constantes
│   ├── guard/          # moteur de garde-fous (détecteurs, pipeline)
│   ├── connectors/     # exécuteurs : http, sql, google, saas, fichiers, mcp externe
│   ├── billing/        # calcul des débits, grand livre, budgets
│   ├── ui/             # design system (composants, tokens)
│   └── sdk-ts/         # SDK TypeScript public
├── db/
│   ├── migrations/     # SQL versionné (dbmate)
│   └── tests/          # tests SQL d'isolation et d'intégrité
├── infra/              # docker-compose, nginx, grafana, config LiteLLM
└── docs/               # documents de référence (miroir du projet)
```
