---
name: cp-hono
description: Backend Hono de project-cp (apps/api, apps/mcp-runtime, apps/auth) — architecture en couches imposée (routes OpenAPIHono → services → policies → repositories → resources), contexte de requête (org, user, workspace, env), erreurs du catalogue, middlewares (auth, rate limit, idempotence, OTel), config typée, OpenAPI + Scalar. Contrat détaillé → cp-api-contract.
---

# Hono — project-cp

> Hono n'impose aucune architecture : ce skill l'impose. Bibliothèques : `docs/reference/03-architecture-technique.md` §4.1.
> Contrat public (erreurs, pagination, idempotence, ids) : `cp-api-contract`. Données : `cp-database`.

## Structure d'une app Hono
```
apps/api/src/
  index.ts            # serve() @hono/node-server, arrêt propre (SIGTERM : drain + close pools)
  app.ts              # createApp(): OpenAPIHono + middlewares globaux + montage des modules + /openapi.json + /docs (Scalar)
  env.ts              # SEUL lecteur de process.env : schéma zod, parse au démarrage, export `env` typé
  context.ts          # type AppEnv = { Variables: { requestId, logger, auth: AuthContext, … } }
  middlewares/        # request-id, logger, otel, auth, rate-limit, idempotency, feature-gate, error-handler
  modules/<domaine>/  # agents, capabilities, mcp-servers, connectors, runs, billing, keys, webhooks…
    <domaine>.routes.ts       # createRoute() + handlers MINCES
    <domaine>.service.ts      # logique métier — ne connaît pas Hono (pas de `c`)
    <domaine>.policy.ts       # droits : rôle, plan (billing.features), flag, surcharge
    <domaine>.repository.ts   # requêtes Drizzle via withOrgContext
    <domaine>.resource.ts     # mapping sortie : public_id, champs exposés seulement
    <domaine>.schemas.ts      # ré-export/composition des schémas de @cp/shared
  lib/errors.ts       # AppError + helpers
```
`apps/mcp-runtime` suit la même structure (voir `cp-mcp-runtime`) ; `apps/auth` est à part (oidc-provider, voir `cp-auth`).

## Route type (mince, délègue)
```ts
// modules/agents/agents.routes.ts
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { CreateAgentBody, AgentResource, ErrorResponse } from '@cp/shared/schemas'

const createAgent = createRoute({
  method: 'post', path: '/v1/workspaces/{workspaceId}/agents', tags: ['Agents'],
  request: { params: WorkspaceParams, body: { content: { 'application/json': { schema: CreateAgentBody } } } },
  responses: { 201: { content: { 'application/json': { schema: AgentResource } }, description: 'Créé' },
               422: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalide' } },
  middleware: [requireScope('agents:write'), idempotent()] as const,
})

export const agentsRoutes = new OpenAPIHono<AppEnv>().openapi(createAgent, async (c) => {
  const auth = c.get('auth')                                   // org, user, workspace, env, rôle, plan
  const body = c.req.valid('json')                             // validé par zod-openapi
  await agentPolicy.assertCanCreate(auth)                      // flag → plan → surcharge → budget
  const agent = await agentService.create(auth, c.req.valid('param').workspaceId, body)
  return c.json(toAgentResource(agent), 201)
})
```
- Handler : ≤ 15 lignes, aucune logique, aucune requête SQL.
- `defaultHook` global de l'OpenAPIHono : un échec zod → `AppError('PLATFORM_VALIDATION_FAILED', { issues })` (422).

## Contexte d'authentification
`middlewares/auth.ts` résout (connexion `app_auth`) : session cookie (dashboard) · clé API `Authorization: Bearer cp_live_…`
(liée à un environnement, portées, IP/origines) · jeton MCP / OAuth (mcp-runtime). Il pose :
```ts
type AuthContext = { orgId: bigint; userId: bigint | null; workspaceId: bigint | null; environmentId: bigint | null;
  role: Role; planCode: PlanCode; scopes: string[]; actor: 'user' | 'api_key' | 'mcp_client' | 'agent' | 'system' }
```
Les ids internes restent dans le contexte serveur ; les paramètres d'URL sont des `public_id` résolus par le repository.

## Services
- Signature : `service.action(auth: AuthContext, …args)` ; lèvent des `AppError` du catalogue ; ne lisent jamais `env` directement
  (dépendances injectées ou modules importés).
- Transactions : `withOrgContext(auth, async (tx) => …)` de `@cp/db` (pose `app.org_id` / `app.user_id`, RLS).
- Opérations critiques (crédits, publication MCP, numérotation facture) : fonctions transactionnelles de `@cp/db` / `@cp/billing`
  avec verrou explicite — jamais recodées dans un service.
- Effets de bord (emails, webhooks, invalidation cache, ClickHouse) : **outbox** dans la même transaction, traités par `apps/worker`.

## Erreurs
```ts
// lib/errors.ts
export class AppError extends Error {
  constructor(public code: ErrorCode, public details?: Record<string, unknown>, cause?: unknown) { super(code, { cause }) }
}
// middlewares/error-handler.ts — app.onError
// AppError → statut + message i18n depuis platform.error_codes (cache) ; format { error: { code, message, details, request_id, documentation_url } }
// ZodError → 422 ; inconnu → 500 PLATFORM_INTERNAL_ERROR (jamais le message brut), log pino + Sentry(GlitchTip) avec request_id
```
Les codes (`ErrorCode`) sont un enum de `@cp/shared/errors`, synchronisé avec `platform.error_codes` (test qui vérifie l'égalité).

## Middlewares globaux (ordre)
`requestId` → `otel` (@hono/otel) → `logger` (pino, `request_id`, sans PII) → `secureHeaders` → `cors` (origines explicites) →
`emergencyStop` (Redis, `EMERGENCY_STOP_ACTIVE`) → `auth` → `rateLimit` (rate-limiter-flexible Redis, par clé/org/IP, 429 + `Retry-After`) →
`featureGate` si la route en déclare un → routes → `onError`.

## Config
`env.ts` : `z.object({ DATABASE_URL: z.url(), REDIS_URL: z.url(), LITELLM_URL: z.url(), INFISICAL_*: …, NODE_ENV: z.enum([...]) }).parse(process.env)`.
Seul fichier autorisé à lire `process.env` (règle du guard). Les secrets métier (connecteurs, BYOK) viennent d'Infisical au moment de l'appel.

## OpenAPI et SDK
`app.doc31('/openapi.json', { openapi: '3.1.0', info: { title: 'project-cp API', version } })` ; `/docs` via `@scalar/hono-api-reference`.
Script `openapi:emit` écrit `apps/api/openapi.json` (commité) → client front `@hey-api` et SDK (`packages/sdk-ts`, Stainless/Speakeasy).
Toute route publique a `tags`, `summary`, exemples et toutes ses réponses d'erreur documentées.

## Tests
Services : Vitest unitaire (dépendances mockées). Routes : `app.request('/v1/…', { method, headers, body })` avec Postgres Testcontainers
+ MSW pour LiteLLM / systèmes externes. Couvrir 201/200, 401, 403, 404, 409, 422, 429, plan insuffisant, flag coupé, arrêt d'urgence.

## Anti-patterns interdits
Logique ou SQL dans un handler · objet Drizzle renvoyé brut · id bigint exposé · `process.env` hors `env.ts` · `c` passé à un service ·
`try/catch` qui avale une erreur · `app_admin` dans api/mcp-runtime · réponse d'erreur hors format unique · endpoint `/chat/completions` ·
appel externe sans timeout ni cockatiel · effet de bord hors outbox dans une transaction.
