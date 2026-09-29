-- =============================================================================
-- 060_agent.sql — Agents (objectif + accès MCP + déclencheur + policy),
-- versions immuables, droits sur les outils, déclencheurs, approbations,
-- mémoire long terme (pgvector), conversations et messages (chat).
-- L'exécution elle-même est un RUN (usage.runs, source_type = 'agent').
-- =============================================================================

CREATE TABLE agent.agents (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  name               text        NOT NULL,
  description        text,
  status             text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  paused_reason      text,                        -- ex: connector_error, budget_exceeded, user
  current_version_id bigint,                      -- FK ajoutée après agent.versions
  max_concurrency    smallint    NOT NULL DEFAULT 1 CHECK (max_concurrency BETWEEN 1 AND 100),
  source_listing_id  bigint,                      -- installé depuis la marketplace
  lock_version       integer     NOT NULL DEFAULT 0,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  archived_at        timestamptz,
  deleted_at         timestamptz,
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX agents_ws_status_idx ON agent.agents (workspace_id, organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX agents_version_idx   ON agent.agents (current_version_id);
CREATE INDEX agents_creator_idx   ON agent.agents (created_by_user_id);
CREATE INDEX agents_listing_idx   ON agent.agents (source_listing_id);
CREATE INDEX agents_name_trgm     ON agent.agents USING gin (name gin_trgm_ops);

-- Configuration complète et immuable d'un agent (chaque run pointe vers la version utilisée)
CREATE TABLE agent.versions (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  agent_id              bigint      NOT NULL,
  organization_id       bigint      NOT NULL,
  version_seq           integer     NOT NULL CHECK (version_seq > 0),
  objective             text        NOT NULL,          -- langage naturel
  instructions          text,                          -- contexte métier, ton, règles
  language              text        NOT NULL DEFAULT 'fr' REFERENCES ref.languages(code),
  routing_profile_id    bigint      REFERENCES ai.routing_profiles(id),
  model_override_id     bigint      REFERENCES ai.models(id),
  model_fallback        text        NOT NULL DEFAULT 'profile' CHECK (model_fallback IN ('profile','fail')),
  temperature           numeric(3,2) NOT NULL DEFAULT 0.30 CHECK (temperature BETWEEN 0 AND 2),
  max_tokens_per_call   integer     CHECK (max_tokens_per_call > 0),
  max_iterations        smallint    NOT NULL DEFAULT 10 CHECK (max_iterations BETWEEN 1 AND 50),
  run_timeout_s         integer     NOT NULL DEFAULT 300 CHECK (run_timeout_s BETWEEN 10 AND 1800),
  tool_timeout_s        integer     NOT NULL DEFAULT 30  CHECK (tool_timeout_s BETWEEN 1 AND 120),
  max_nesting_depth     smallint    NOT NULL DEFAULT 5 CHECK (max_nesting_depth BETWEEN 1 AND 5),
  output_mode           text        NOT NULL DEFAULT 'text' CHECK (output_mode IN ('text','json','action')),
  output_schema         jsonb,
  memory_config         jsonb       NOT NULL DEFAULT '{"long_term":false,"scope":"agent","retention_days":30}',
  approval_config       jsonb       NOT NULL DEFAULT '{"timeout_hours":24,"channels":["dashboard"]}',
  budget_per_run_micro  bigint      CHECK (budget_per_run_micro > 0),
  on_budget_exceeded    text        NOT NULL DEFAULT 'stop' CHECK (on_budget_exceeded IN ('stop','ask_approval')),
  allowed_hours         jsonb,                          -- ex: {"tz":"Africa/Douala","from":"08:00","to":"20:00"}
  self_actions          jsonb       NOT NULL DEFAULT '{"trigger_other_agents":false,"modify_agents":false}',
  changelog             text,
  created_by_user_id    bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version_seq),
  UNIQUE (id, organization_id),
  CHECK (output_mode <> 'json' OR output_schema IS NOT NULL),
  FOREIGN KEY (agent_id, organization_id) REFERENCES agent.agents(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX versions_agent_org_idx ON agent.versions (agent_id, organization_id);
CREATE INDEX versions_profile_idx   ON agent.versions (routing_profile_id);
CREATE INDEX versions_model_idx     ON agent.versions (model_override_id);
CREATE INDEX versions_language_idx  ON agent.versions (language);
CREATE INDEX versions_creator_idx   ON agent.versions (created_by_user_id);

ALTER TABLE agent.agents ADD CONSTRAINT agents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES agent.versions(id) ON DELETE SET NULL;

-- Accès d'une version d'agent aux serveurs MCP / outils (granulaire)
CREATE TABLE agent.tool_grants (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_version_id     bigint   NOT NULL,
  organization_id      bigint   NOT NULL,
  mcp_server_id        bigint   NOT NULL,
  pinned_version_id    bigint,                        -- NULL = toujours la version active du serveur
  tool_id              bigint,                        -- NULL = tous les outils du serveur
  permission           text     NOT NULL DEFAULT 'allow' CHECK (permission IN ('allow','require_approval','deny')),
  FOREIGN KEY (agent_version_id, organization_id)  REFERENCES agent.versions(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (mcp_server_id, organization_id)     REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (pinned_version_id, organization_id) REFERENCES mcp.server_versions(id, organization_id),
  FOREIGN KEY (tool_id, organization_id)           REFERENCES mcp.tools(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX tool_grants_uq ON agent.tool_grants (agent_version_id, mcp_server_id, tool_id) NULLS NOT DISTINCT;
CREATE INDEX tool_grants_version_idx ON agent.tool_grants (agent_version_id, organization_id);
CREATE INDEX tool_grants_server_idx  ON agent.tool_grants (mcp_server_id, organization_id);
CREATE INDEX tool_grants_pinned_idx  ON agent.tool_grants (pinned_version_id, organization_id);
CREATE INDEX tool_grants_tool_idx    ON agent.tool_grants (tool_id, organization_id);

-- Capacités qu'une version d'agent peut appeler comme des outils (ex. extraire-facture)
CREATE TABLE agent.capability_grants (
  agent_version_id bigint NOT NULL,
  organization_id  bigint NOT NULL,
  capability_id    bigint NOT NULL,
  permission       text   NOT NULL DEFAULT 'allow' CHECK (permission IN ('allow','require_approval','deny')),
  PRIMARY KEY (agent_version_id, capability_id),
  FOREIGN KEY (agent_version_id, organization_id) REFERENCES agent.versions(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (capability_id, organization_id)    REFERENCES ai.capabilities(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX capability_grants_version_idx    ON agent.capability_grants (agent_version_id, organization_id);
CREATE INDEX capability_grants_capability_idx ON agent.capability_grants (capability_id, organization_id);

-- Déclencheurs : planifié (cron), webhook, chat, seuil, manuel
CREATE TABLE agent.triggers (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  agent_id             bigint      NOT NULL,
  organization_id      bigint      NOT NULL,
  environment_id       bigint      NOT NULL,
  kind                 text        NOT NULL CHECK (kind IN ('schedule','webhook','chat','threshold','manual','event')),
  is_enabled           boolean     NOT NULL DEFAULT true,
  cron_expression      text,
  timezone             text,
  webhook_endpoint_id  bigint,                     -- FK dans 070_dev
  event_filter         jsonb,                      -- ex: {"event_type":"order.payment_failed"}
  threshold_config     jsonb,                      -- requête + condition + fréquence de vérification
  input_template       jsonb       NOT NULL DEFAULT '{}',
  next_fire_at         timestamptz,
  last_fired_at        timestamptz,
  temporal_schedule_id text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  CHECK (kind <> 'schedule'  OR cron_expression IS NOT NULL),
  CHECK (kind <> 'webhook'   OR webhook_endpoint_id IS NOT NULL),
  CHECK (kind <> 'threshold' OR threshold_config IS NOT NULL),
  FOREIGN KEY (agent_id, organization_id)       REFERENCES agent.agents(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX triggers_agent_idx     ON agent.triggers (agent_id, organization_id);
CREATE INDEX triggers_env_idx       ON agent.triggers (environment_id, organization_id);
CREATE INDEX triggers_webhook_idx   ON agent.triggers (webhook_endpoint_id, organization_id);
CREATE INDEX triggers_due_idx       ON agent.triggers (next_fire_at) WHERE is_enabled AND kind IN ('schedule','threshold');

-- Demandes d'approbation humaine (le run attend : aucun crédit consommé pendant l'attente)
CREATE TABLE agent.approvals (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id     bigint      NOT NULL,
  workspace_id        bigint      NOT NULL,
  run_id              bigint      NOT NULL,         -- usage.runs (partitionnée : pas de FK)
  run_created_at      timestamptz NOT NULL,
  agent_id            bigint,
  tool_id             bigint,
  mcp_server_id       bigint,
  proposed_input      jsonb       NOT NULL,         -- paramètres proposés (masqués si sensibles)
  summary             jsonb       NOT NULL CHECK (util.is_i18n(summary)),  -- "Envoyer 3 emails de relance..."
  risk_level          text        NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  requested_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  decided_by_user_id  bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  decided_at          timestamptz,
  decision_note       text,
  edited_input        jsonb,                        -- l'humain peut corriger avant d'approuver
  channels_notified   text[]      NOT NULL DEFAULT '{}',
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id, organization_id)     REFERENCES agent.agents(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id, organization_id)      REFERENCES mcp.tools(id, organization_id) ON DELETE SET NULL (tool_id),
  FOREIGN KEY (mcp_server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE SET NULL (mcp_server_id)
);
CREATE INDEX approvals_pending_idx ON agent.approvals (organization_id, workspace_id, requested_at DESC) WHERE status = 'pending';
CREATE INDEX approvals_expiry_idx  ON agent.approvals (expires_at) WHERE status = 'pending';
CREATE INDEX approvals_run_idx     ON agent.approvals (run_id);
CREATE INDEX approvals_ws_idx      ON agent.approvals (workspace_id, organization_id);
CREATE INDEX approvals_agent_idx   ON agent.approvals (agent_id, organization_id);
CREATE INDEX approvals_tool_idx    ON agent.approvals (tool_id, organization_id);
CREATE INDEX approvals_server_idx  ON agent.approvals (mcp_server_id, organization_id);
CREATE INDEX approvals_decider_idx ON agent.approvals (decided_by_user_id);

-- Mémoire long terme (portée agent ou workspace)
CREATE TABLE agent.memories (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  workspace_id    bigint      NOT NULL,
  agent_id        bigint,                         -- NULL = mémoire partagée du workspace
  scope           text        NOT NULL CHECK (scope IN ('agent','workspace')),
  content         text        NOT NULL,
  embedding_model text        NOT NULL,
  embedding       vector(1536) NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  importance      smallint    NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source_run_id   bigint,
  size_bytes      integer     NOT NULL DEFAULT 0,  -- facturation stockage mémoire
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  CHECK ((scope = 'agent') = (agent_id IS NOT NULL)),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id, organization_id)     REFERENCES agent.agents(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX memories_agent_idx  ON agent.memories (agent_id, organization_id, created_at DESC);
CREATE INDEX memories_ws_idx     ON agent.memories (workspace_id, organization_id);
CREATE INDEX memories_expiry_idx ON agent.memories (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX memories_hnsw       ON agent.memories USING hnsw (embedding vector_cosine_ops);

-- Conversations (chat de la plateforme, déclencheur "chat" d'un agent)
CREATE TABLE agent.conversations (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id  bigint      NOT NULL,
  workspace_id     bigint      NOT NULL,
  environment_id   bigint,
  agent_id         bigint,                         -- NULL = assistant général du workspace
  user_id          bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  end_user_id      bigint,                         -- conversation d'un utilisateur final (SDK)
  title            text,
  is_pinned        boolean     NOT NULL DEFAULT false,
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  message_count    integer     NOT NULL DEFAULT 0,
  last_message_at  timestamptz,
  summary          text,                           -- résumé compressé (optimisation du contexte)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)   REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE SET NULL (environment_id),
  FOREIGN KEY (agent_id, organization_id)       REFERENCES agent.agents(id, organization_id) ON DELETE SET NULL (agent_id)
);
CREATE INDEX conversations_user_idx  ON agent.conversations (user_id, last_message_at DESC) WHERE status = 'active';
CREATE INDEX conversations_ws_idx    ON agent.conversations (workspace_id, organization_id);
CREATE INDEX conversations_env_idx   ON agent.conversations (environment_id, organization_id);
CREATE INDEX conversations_agent_idx ON agent.conversations (agent_id, organization_id);
CREATE INDEX conversations_eu_idx    ON agent.conversations (end_user_id);

CREATE TABLE agent.messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  conversation_id bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  role            text        NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content         jsonb       NOT NULL,            -- parties : texte, fichiers, appels d'outils, cartes d'approbation
  run_id          bigint,
  run_created_at  timestamptz,
  author_user_id  bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  feedback        smallint    CHECK (feedback IN (-1, 1)),
  feedback_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, organization_id) REFERENCES agent.conversations(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX messages_conversation_idx ON agent.messages (conversation_id, organization_id, created_at);
CREATE INDEX messages_run_idx          ON agent.messages (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX messages_author_idx       ON agent.messages (author_user_id);
