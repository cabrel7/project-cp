-- =============================================================================
-- 075_usage.sql — Cœur de la traçabilité : runs, étapes, requêtes LLM,
-- appels d'outils, agrégats journaliers.
-- Chaîne garantie : organisation -> workspace -> environnement -> projet -> run
--                   -> requête fournisseur / appel d'outil.
-- Tables partitionnées par mois ; rétention détaillée en Postgres (ex. 90 j,
-- selon plan) puis agrégats + copie longue durée dans ClickHouse.
-- Recherche par public_id (UUIDv7) : uuid_extract_timestamp(public_id) donne
-- l'instant de création -> filtrer created_at sur une fenêtre pour élaguer
-- les partitions (voir usage.find_run).
-- =============================================================================

-- Un RUN = une exécution complète facturable (appel SDK ai.run, message de chat,
-- exécution d'agent, appel MCP externe groupé, évaluation...)
CREATE TABLE usage.runs (
  id                    bigint GENERATED ALWAYS AS IDENTITY,
  public_id             uuid        NOT NULL DEFAULT uuidv7(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  organization_id       bigint      NOT NULL,
  workspace_id          bigint      NOT NULL,
  environment_id        bigint      NOT NULL,
  project_id            bigint,
  source_type           text        NOT NULL CHECK (source_type IN
                        ('sdk','chat','agent','mcp_external','playground','eval','system')),
  -- origine (au plus une selon la source)
  capability_id         bigint,
  capability_version_id bigint,
  agent_id              bigint,
  agent_version_id      bigint,
  trigger_id            bigint,
  conversation_id       bigint,
  mcp_server_id         bigint,
  api_key_id            bigint,
  mcp_access_token_id   bigint,
  oauth_client_id       bigint,
  user_id               bigint,               -- utilisateur de la plateforme à l'origine
  end_user_id           bigint,               -- utilisateur final de l'app cliente
  parent_run_id         bigint,               -- appels imbriqués (profondeur max 5)
  replay_of_run_id      bigint,               -- "rejouer un run"
  -- exécution
  status                text        NOT NULL DEFAULT 'queued' CHECK (status IN
                        ('queued','running','awaiting_approval','completed','failed','timeout',
                         'cancelled','budget_exceeded')),
  routing_profile_id    bigint,
  is_byok               boolean     NOT NULL DEFAULT false,
  is_sandbox            boolean     NOT NULL DEFAULT false,
  iterations            smallint    NOT NULL DEFAULT 0,
  started_at            timestamptz,
  completed_at          timestamptz,
  duration_ms           integer,
  -- consommation (dénormalisée pour les tableaux de bord)
  input_tokens          bigint      NOT NULL DEFAULT 0,
  output_tokens         bigint      NOT NULL DEFAULT 0,
  cached_tokens         bigint      NOT NULL DEFAULT 0,
  llm_requests_count    integer     NOT NULL DEFAULT 0,
  tool_calls_count      integer     NOT NULL DEFAULT 0,
  provider_cost_usd     numeric(18,10) NOT NULL DEFAULT 0,   -- notre coût réel
  llm_credits_micro     bigint      NOT NULL DEFAULT 0,
  infra_credits_micro   bigint      NOT NULL DEFAULT 0,
  billing_status        text        NOT NULL DEFAULT 'pending' CHECK (billing_status IN
                        ('pending','reserved','settled','refunded','not_billable')),
  -- résultat
  input                 jsonb,                  -- masqué / tronqué selon la politique de rétention
  output                jsonb,
  error_code            text,                   -- ex: AGENT_TIMEOUT (catalogue platform.error_codes)
  error_message         text,
  temporal_workflow_id  text,
  trace_id              text,                   -- OpenTelemetry / Langfuse
  metadata              jsonb       NOT NULL DEFAULT '{}',   -- étiquettes libres du développeur
  PRIMARY KEY (id, created_at),
  UNIQUE (public_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX runs_org_time_idx     ON usage.runs (organization_id, created_at DESC);
CREATE INDEX runs_ws_env_time_idx  ON usage.runs (workspace_id, environment_id, created_at DESC);
CREATE INDEX runs_project_idx      ON usage.runs (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX runs_agent_idx        ON usage.runs (agent_id, created_at DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX runs_capability_idx   ON usage.runs (capability_id, created_at DESC) WHERE capability_id IS NOT NULL;
CREATE INDEX runs_api_key_idx      ON usage.runs (api_key_id, created_at DESC) WHERE api_key_id IS NOT NULL;
CREATE INDEX runs_end_user_idx     ON usage.runs (end_user_id, created_at DESC) WHERE end_user_id IS NOT NULL;
CREATE INDEX runs_conversation_idx ON usage.runs (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX runs_parent_idx       ON usage.runs (parent_run_id) WHERE parent_run_id IS NOT NULL;
CREATE INDEX runs_active_idx       ON usage.runs (status, created_at) WHERE status IN ('queued','running','awaiting_approval');
CREATE INDEX runs_unbilled_idx     ON usage.runs (billing_status, created_at) WHERE billing_status IN ('pending','reserved');
CREATE INDEX runs_errors_idx       ON usage.runs (organization_id, error_code, created_at DESC) WHERE error_code IS NOT NULL;

-- Étapes d'un run (fil d'exécution affiché en temps réel)
CREATE TABLE usage.run_steps (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  run_id           bigint      NOT NULL,
  run_created_at   timestamptz NOT NULL,
  organization_id  bigint      NOT NULL,
  seq              integer     NOT NULL,
  step_type        text        NOT NULL CHECK (step_type IN
                   ('llm_call','tool_call','capability_call','approval','memory_read','memory_write','notification',
                    'routing','guardrail','sub_run','error','final')),
  status           text        NOT NULL CHECK (status IN ('started','succeeded','failed','skipped','waiting')),
  llm_request_id   bigint,
  tool_call_id     bigint,
  approval_id      bigint,
  input            jsonb,
  output           jsonb,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  credits_micro    bigint      NOT NULL DEFAULT 0,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE UNIQUE INDEX run_steps_seq_uq ON usage.run_steps (run_id, seq, created_at);
CREATE INDEX run_steps_org_idx       ON usage.run_steps (organization_id, created_at DESC);

-- Chaque appel à un fournisseur (y compris tentatives et bascules)
CREATE TABLE usage.llm_requests (
  id                   bigint GENERATED ALWAYS AS IDENTITY,
  public_id            uuid        NOT NULL DEFAULT uuidv7(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  run_id               bigint      NOT NULL,
  run_created_at       timestamptz NOT NULL,
  organization_id      bigint      NOT NULL,
  workspace_id         bigint      NOT NULL,
  environment_id       bigint      NOT NULL,
  model_id             bigint      NOT NULL,
  deployment_id        bigint      NOT NULL,
  provider_id          bigint      NOT NULL,
  byok_key_id          bigint,
  routing_rule_id      bigint,
  attempt              smallint    NOT NULL DEFAULT 1,
  is_fallback          boolean     NOT NULL DEFAULT false,
  routing_source       text        CHECK (routing_source IN ('model_override','capability','agent','workspace','organization','plan')),
  fallback_reason      text        CHECK (fallback_reason IN ('unavailable','timeout','rate_limited','provider_error','circuit_open','context_too_long')),
  modality             text        NOT NULL DEFAULT 'text' CHECK (modality IN
                       ('text','embedding','vision','audio_transcription','tts','image_generation','video')),
  status               text        NOT NULL CHECK (status IN ('succeeded','failed','rate_limited','filtered','timeout','cancelled')),
  http_status          smallint,
  input_tokens         integer     NOT NULL DEFAULT 0,
  output_tokens        integer     NOT NULL DEFAULT 0,
  cached_input_tokens  integer     NOT NULL DEFAULT 0,
  reasoning_tokens     integer     NOT NULL DEFAULT 0,
  other_units          jsonb       NOT NULL DEFAULT '{}',   -- {"image_output":2,"audio_input_second":31.5}
  tokens_saved         integer     NOT NULL DEFAULT 0,      -- optimisation du contexte
  cache_hit            boolean     NOT NULL DEFAULT false,  -- cache sémantique
  latency_ms           integer,
  ttft_ms              integer,                             -- délai premier token
  provider_cost_usd    numeric(18,10) NOT NULL DEFAULT 0,
  fx_rate_id           bigint,                              -- taux de change appliqué
  coefficient          numeric(6,4),                        -- coefficient du plan appliqué
  credits_micro        bigint      NOT NULL DEFAULT 0,      -- 0 si BYOK
  provider_request_id  text,
  error_code           text,
  error_message        text,
  PRIMARY KEY (id, created_at),
  UNIQUE (public_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX llm_requests_run_idx      ON usage.llm_requests (run_id);
CREATE INDEX llm_requests_org_idx      ON usage.llm_requests (organization_id, created_at DESC);
CREATE INDEX llm_requests_model_idx    ON usage.llm_requests (model_id, created_at DESC);          -- marge par modèle (admin)
CREATE INDEX llm_requests_deploy_idx   ON usage.llm_requests (deployment_id, created_at DESC);     -- santé fournisseur
CREATE INDEX llm_requests_errors_idx   ON usage.llm_requests (provider_id, created_at DESC) WHERE status <> 'succeeded';

-- Chaque appel d'outil MCP (agent interne, client MCP externe, SDK)
CREATE TABLE usage.tool_calls (
  id                  bigint GENERATED ALWAYS AS IDENTITY,
  public_id           uuid        NOT NULL DEFAULT uuidv7(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  run_id              bigint,
  run_created_at      timestamptz,
  organization_id     bigint      NOT NULL,
  workspace_id        bigint      NOT NULL,
  environment_id      bigint,
  mcp_server_id       bigint      NOT NULL,
  server_version_id   bigint      NOT NULL,
  tool_id             bigint      NOT NULL,
  connector_id        bigint,
  caller_type         text        NOT NULL CHECK (caller_type IN ('agent','external_mcp_client','sdk','playground','validation')),
  mcp_access_token_id bigint,
  oauth_client_id     bigint,
  user_id             bigint,
  status              text        NOT NULL CHECK (status IN
                      ('succeeded','failed','denied','approval_pending','approved','rejected',
                       'timeout','circuit_open','invalid_input','simulated')),
  input_redacted      jsonb,                          -- paramètres masqués (jamais de secret)
  output_summary      jsonb,
  attempts            smallint    NOT NULL DEFAULT 1,
  latency_ms          integer,
  approval_id         bigint,
  policy_decision     jsonb,                          -- règle appliquée (audit)
  error_code          text,
  error_message       text,
  credits_micro       bigint      NOT NULL DEFAULT 0,
  PRIMARY KEY (id, created_at),
  UNIQUE (public_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX tool_calls_run_idx     ON usage.tool_calls (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX tool_calls_server_idx  ON usage.tool_calls (mcp_server_id, created_at DESC);
CREATE INDEX tool_calls_tool_idx    ON usage.tool_calls (tool_id, created_at DESC);
CREATE INDEX tool_calls_org_idx     ON usage.tool_calls (organization_id, created_at DESC);
CREATE INDEX tool_calls_token_idx   ON usage.tool_calls (mcp_access_token_id, created_at DESC) WHERE mcp_access_token_id IS NOT NULL;
CREATE INDEX tool_calls_errors_idx  ON usage.tool_calls (tool_id, created_at DESC) WHERE status IN ('failed','timeout','circuit_open');

-- Agrégats journaliers (tableaux de bord rapides, ventilation "pourquoi 37 420 crédits ?")
CREATE TABLE usage.daily_rollups (
  day                  date        NOT NULL,
  organization_id      bigint      NOT NULL,
  workspace_id         bigint      NOT NULL,
  environment_id       bigint      NOT NULL,
  project_id           bigint,
  source_type          text        NOT NULL,
  agent_id             bigint,
  capability_id        bigint,
  api_key_id           bigint,
  model_id             bigint,
  runs_count           integer     NOT NULL DEFAULT 0,
  failed_runs_count    integer     NOT NULL DEFAULT 0,
  llm_requests_count   integer     NOT NULL DEFAULT 0,
  tool_calls_count     integer     NOT NULL DEFAULT 0,
  input_tokens         bigint      NOT NULL DEFAULT 0,
  output_tokens        bigint      NOT NULL DEFAULT 0,
  tokens_saved         bigint      NOT NULL DEFAULT 0,
  provider_cost_usd    numeric(18,6) NOT NULL DEFAULT 0,
  llm_credits_micro    bigint      NOT NULL DEFAULT 0,
  infra_credits_micro  bigint      NOT NULL DEFAULT 0,
  avg_latency_ms       integer,
  p95_latency_ms       integer,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX daily_rollups_dims_uq ON usage.daily_rollups
  (day, organization_id, workspace_id, environment_id, project_id, source_type, agent_id, capability_id, api_key_id, model_id)
  NULLS NOT DISTINCT;
CREATE INDEX daily_rollups_org_day_idx  ON usage.daily_rollups (organization_id, day DESC);
CREATE INDEX daily_rollups_ws_day_idx   ON usage.daily_rollups (workspace_id, day DESC);
CREATE INDEX daily_rollups_model_idx    ON usage.daily_rollups (model_id, day DESC);        -- marges (admin)

-- Recherche d'un run par identifiant public avec élagage des partitions
CREATE OR REPLACE FUNCTION usage.find_run(p_public_id uuid)
RETURNS SETOF usage.runs
LANGUAGE sql STABLE AS $$
  SELECT * FROM usage.runs
  WHERE public_id = p_public_id
    AND created_at >= uuid_extract_timestamp(p_public_id) - interval '1 day'
    AND created_at <= uuid_extract_timestamp(p_public_id) + interval '1 minute'
$$;
