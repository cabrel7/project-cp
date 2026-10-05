// Tables PARENTES partitionnées (PARTITION BY RANGE) — déclarées À LA MAIN.
//
// Pourquoi : `drizzle-kit pull` est configuré (drizzle.config.ts, `tablesFilter`) pour exclure les
// partitions enfants (`*_p2*`, `*_default`) afin que le schéma TypeScript ne dépende ni de la
// disposition ni des dates de partitionnement. Ce fichier est conservé par scripts/post-pull.sh
// (qui ne supprime que `*.sql` et `meta/`).
//
// Source de vérité : db/migrations/*_baseline.sql. Ces déclarations sont volontairement minimales
// (colonnes, types, nullabilité, défauts, clé primaire). Les index, FK et CHECK restent dans le SQL.
// Le test src/__tests__/partitioned.test.ts compare ces colonnes à `information_schema.columns`
// et vérifie que l'ensemble couvre exactement les tables partitionnées de la base.
//
// Conventions identiques au schéma généré : bigint en mode "bigint" (invariants 1 et 7),
// timestamptz en mode 'string'.
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  inet,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Schémas locaux (non exportés) : `schema.ts` (généré) exporte déjà les objets pgSchema.
const billing = pgSchema('billing')
const dev = pgSchema('dev')
const usage = pgSchema('usage')
const audit = pgSchema('audit')

/** `bytea` : pas de type natif dans drizzle-orm/pg-core. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
})

const id = () => bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity()
const publicId = () => uuid('public_id').default(sql`uuidv7()`).notNull()
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })
const big = (name: string) => bigint(name, { mode: 'bigint' })

// --------------------------------------------------------------------- billing

/** Grand livre des crédits (AJOUT SEUL). Partition : occurred_at. */
export const creditLedgerInBilling = billing.table(
  'credit_ledger',
  {
    id: id(),
    publicId: publicId(),
    occurredAt: tstz('occurred_at').defaultNow().notNull(),
    organizationId: big('organization_id').notNull(),
    walletId: big('wallet_id').notNull(),
    grantId: big('grant_id'),
    entryType: text('entry_type').notNull(),
    amountMicro: big('amount_micro').notNull(),
    balanceAfterMicro: big('balance_after_micro').notNull(),
    workspaceId: big('workspace_id'),
    environmentId: big('environment_id'),
    projectId: big('project_id'),
    runId: big('run_id'),
    runCreatedAt: tstz('run_created_at'),
    referenceType: text('reference_type'),
    referenceId: big('reference_id'),
    description: jsonb('description'),
    actor: jsonb('actor'),
  },
  (table) => [primaryKey({ columns: [table.id, table.occurredAt], name: 'credit_ledger_pkey' })],
)

// ------------------------------------------------------------------------- dev

/** Événements reçus (webhooks entrants). Partition : received_at. */
export const inboundEventsInDev = dev.table(
  'inbound_events',
  {
    id: id(),
    publicId: publicId(),
    receivedAt: tstz('received_at').defaultNow().notNull(),
    organizationId: big('organization_id').notNull(),
    endpointId: big('endpoint_id').notNull(),
    eventType: text('event_type'),
    dedupeKey: text('dedupe_key'),
    headers: jsonb('headers').default({}).notNull(),
    payload: jsonb('payload').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    status: text('status').default('received').notNull(),
    triggeredRuns: jsonb('triggered_runs').default([]).notNull(),
    error: text('error'),
  },
  (table) => [primaryKey({ columns: [table.id, table.receivedAt], name: 'inbound_events_pkey' })],
)

/** Livraisons de webhooks sortants. Partition : created_at. */
export const webhookDeliveriesInDev = dev.table(
  'webhook_deliveries',
  {
    id: id(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    organizationId: big('organization_id').notNull(),
    subscriptionId: big('subscription_id').notNull(),
    eventPublicId: uuid('event_public_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    attempt: smallint('attempt').default(1).notNull(),
    status: text('status').default('pending').notNull(),
    responseStatus: smallint('response_status'),
    responseSnippet: text('response_snippet'),
    durationMs: integer('duration_ms'),
    nextRetryAt: tstz('next_retry_at'),
    deliveredAt: tstz('delivered_at'),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt], name: 'webhook_deliveries_pkey' }),
  ],
)

// ----------------------------------------------------------------------- usage

/** Un RUN = une exécution complète facturable. Partition : created_at. */
export const runsInUsage = usage.table(
  'runs',
  {
    id: id(),
    publicId: publicId(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    organizationId: big('organization_id').notNull(),
    workspaceId: big('workspace_id').notNull(),
    environmentId: big('environment_id').notNull(),
    projectId: big('project_id'),
    sourceType: text('source_type').notNull(),
    capabilityId: big('capability_id'),
    capabilityVersionId: big('capability_version_id'),
    agentId: big('agent_id'),
    agentVersionId: big('agent_version_id'),
    triggerId: big('trigger_id'),
    conversationId: big('conversation_id'),
    mcpServerId: big('mcp_server_id'),
    apiKeyId: big('api_key_id'),
    mcpAccessTokenId: big('mcp_access_token_id'),
    oauthClientId: big('oauth_client_id'),
    userId: big('user_id'),
    endUserId: big('end_user_id'),
    parentRunId: big('parent_run_id'),
    replayOfRunId: big('replay_of_run_id'),
    status: text('status').default('queued').notNull(),
    routingProfileId: big('routing_profile_id'),
    isByok: boolean('is_byok').default(false).notNull(),
    isSandbox: boolean('is_sandbox').default(false).notNull(),
    iterations: smallint('iterations').default(0).notNull(),
    startedAt: tstz('started_at'),
    completedAt: tstz('completed_at'),
    durationMs: integer('duration_ms'),
    inputTokens: big('input_tokens').default(0n).notNull(),
    outputTokens: big('output_tokens').default(0n).notNull(),
    cachedTokens: big('cached_tokens').default(0n).notNull(),
    llmRequestsCount: integer('llm_requests_count').default(0).notNull(),
    toolCallsCount: integer('tool_calls_count').default(0).notNull(),
    providerCostUsd: numeric('provider_cost_usd', { precision: 18, scale: 10 })
      .default('0')
      .notNull(),
    llmCreditsMicro: big('llm_credits_micro').default(0n).notNull(),
    infraCreditsMicro: big('infra_credits_micro').default(0n).notNull(),
    billingStatus: text('billing_status').default('pending').notNull(),
    input: jsonb('input'),
    output: jsonb('output'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    temporalWorkflowId: text('temporal_workflow_id'),
    traceId: text('trace_id'),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt], name: 'runs_pkey' })],
)

/** Étapes d'un run. Partition : created_at. */
export const runStepsInUsage = usage.table(
  'run_steps',
  {
    id: id(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    runId: big('run_id').notNull(),
    runCreatedAt: tstz('run_created_at').notNull(),
    organizationId: big('organization_id').notNull(),
    seq: integer('seq').notNull(),
    stepType: text('step_type').notNull(),
    status: text('status').notNull(),
    llmRequestId: big('llm_request_id'),
    toolCallId: big('tool_call_id'),
    approvalId: big('approval_id'),
    input: jsonb('input'),
    output: jsonb('output'),
    startedAt: tstz('started_at').defaultNow().notNull(),
    endedAt: tstz('ended_at'),
    creditsMicro: big('credits_micro').default(0n).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt], name: 'run_steps_pkey' })],
)

/** Chaque appel à un fournisseur LLM. Partition : created_at. */
export const llmRequestsInUsage = usage.table(
  'llm_requests',
  {
    id: id(),
    publicId: publicId(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    runId: big('run_id').notNull(),
    runCreatedAt: tstz('run_created_at').notNull(),
    organizationId: big('organization_id').notNull(),
    workspaceId: big('workspace_id').notNull(),
    environmentId: big('environment_id').notNull(),
    modelId: big('model_id').notNull(),
    deploymentId: big('deployment_id').notNull(),
    providerId: big('provider_id').notNull(),
    byokKeyId: big('byok_key_id'),
    routingRuleId: big('routing_rule_id'),
    attempt: smallint('attempt').default(1).notNull(),
    isFallback: boolean('is_fallback').default(false).notNull(),
    routingSource: text('routing_source'),
    fallbackReason: text('fallback_reason'),
    modality: text('modality').default('text').notNull(),
    status: text('status').notNull(),
    httpStatus: smallint('http_status'),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    cachedInputTokens: integer('cached_input_tokens').default(0).notNull(),
    reasoningTokens: integer('reasoning_tokens').default(0).notNull(),
    otherUnits: jsonb('other_units').default({}).notNull(),
    tokensSaved: integer('tokens_saved').default(0).notNull(),
    cacheHit: boolean('cache_hit').default(false).notNull(),
    latencyMs: integer('latency_ms'),
    ttftMs: integer('ttft_ms'),
    providerCostUsd: numeric('provider_cost_usd', { precision: 18, scale: 10 })
      .default('0')
      .notNull(),
    fxRateId: big('fx_rate_id'),
    coefficient: numeric('coefficient', { precision: 6, scale: 4 }),
    creditsMicro: big('credits_micro').default(0n).notNull(),
    providerRequestId: text('provider_request_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt], name: 'llm_requests_pkey' })],
)

/** Chaque appel d'outil MCP. Partition : created_at. */
export const toolCallsInUsage = usage.table(
  'tool_calls',
  {
    id: id(),
    publicId: publicId(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    runId: big('run_id'),
    runCreatedAt: tstz('run_created_at'),
    organizationId: big('organization_id').notNull(),
    workspaceId: big('workspace_id').notNull(),
    environmentId: big('environment_id'),
    mcpServerId: big('mcp_server_id').notNull(),
    serverVersionId: big('server_version_id').notNull(),
    toolId: big('tool_id').notNull(),
    connectorId: big('connector_id'),
    callerType: text('caller_type').notNull(),
    mcpAccessTokenId: big('mcp_access_token_id'),
    oauthClientId: big('oauth_client_id'),
    userId: big('user_id'),
    status: text('status').notNull(),
    inputRedacted: jsonb('input_redacted'),
    outputSummary: jsonb('output_summary'),
    attempts: smallint('attempts').default(1).notNull(),
    latencyMs: integer('latency_ms'),
    approvalId: big('approval_id'),
    policyDecision: jsonb('policy_decision'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    creditsMicro: big('credits_micro').default(0n).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt], name: 'tool_calls_pkey' })],
)

/** Journal des déclenchements de garde-fous. Partition : created_at. */
export const guardrailEventsInUsage = usage.table(
  'guardrail_events',
  {
    id: id(),
    createdAt: tstz('created_at').defaultNow().notNull(),
    organizationId: big('organization_id').notNull(),
    workspaceId: big('workspace_id'),
    runId: big('run_id'),
    runCreatedAt: tstz('run_created_at'),
    llmRequestId: big('llm_request_id'),
    toolCallId: big('tool_call_id'),
    profileId: big('profile_id'),
    ruleId: big('rule_id'),
    detectorKey: text('detector_key').notNull(),
    stage: text('stage').notNull(),
    mode: text('mode').notNull(),
    actionTaken: text('action_taken').notNull(),
    score: numeric('score', { precision: 5, scale: 4 }),
    latencyMs: integer('latency_ms'),
    excerptMasked: text('excerpt_masked'),
    contentHash: bytea('content_hash'),
    details: jsonb('details').default({}).notNull(),
    feedback: text('feedback'),
    feedbackBy: jsonb('feedback_by'),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt], name: 'guardrail_events_pkey' })],
)

// ----------------------------------------------------------------------- audit

/** Journal d'audit IMMUABLE (append-only, triggers dans le SQL). Partition : occurred_at. */
export const eventsInAudit = audit.table(
  'events',
  {
    id: id(),
    publicId: publicId(),
    occurredAt: tstz('occurred_at').defaultNow().notNull(),
    organizationId: big('organization_id'),
    workspaceId: big('workspace_id'),
    environmentId: big('environment_id'),
    actorType: text('actor_type').notNull(),
    actorId: big('actor_id'),
    actorLabel: text('actor_label'),
    impersonationId: big('impersonation_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: big('target_id'),
    targetPublicId: uuid('target_public_id'),
    outcome: text('outcome').default('success').notNull(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    changes: jsonb('changes'),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.occurredAt], name: 'events_pkey' })],
)

/** Les 9 tables parentes partitionnées (clé = schema.table), utilisée par le test de cohérence. */
export const partitionedTables = {
  'billing.credit_ledger': creditLedgerInBilling,
  'dev.inbound_events': inboundEventsInDev,
  'dev.webhook_deliveries': webhookDeliveriesInDev,
  'usage.runs': runsInUsage,
  'usage.run_steps': runStepsInUsage,
  'usage.llm_requests': llmRequestsInUsage,
  'usage.tool_calls': toolCallsInUsage,
  'usage.guardrail_events': guardrailEventsInUsage,
  'audit.events': eventsInAudit,
} as const
