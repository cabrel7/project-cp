-- =============================================================================
-- 050_mcp.sql — Connecteurs, actions, bridges, serveurs MCP (runtime unique
-- multi-tenant piloté par configuration), versions publiées immuables, outils,
-- ressources, prompts MCP, jetons d'accès, contrôles de santé.
-- Vocabulaire :
--   connector        = un système externe branché (API, base, SaaS, fichiers, MCP externe…)
--   connector_action = une opération brute de ce système (endpoint, requête SQL paramétrée…)
--   mcp_tool         = ce que voit l'IA : nom sémantique, description, risque, règles
--   mcp_server       = un regroupement d'outils exposé sur mcp.<domaine>/{public_id|slug}
-- =============================================================================

-- Catalogue des connecteurs prêts à l'emploi (officiels ou issus de la marketplace)
CREATE TABLE mcp.connector_definitions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key             text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_.-]+$'),  -- hubspot, woocommerce, google.sheets, komerce
  kind            text        NOT NULL CHECK (kind IN ('saas','google_workspace','database','payment','messaging','other')),
  name            text        NOT NULL,
  description     jsonb       NOT NULL CHECK (util.is_i18n(description)),
  icon_file_id    bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  auth_types      text[]      NOT NULL DEFAULT '{}',
  config_schema   jsonb       NOT NULL DEFAULT '{}',   -- champs demandés à l'utilisateur
  default_actions jsonb       NOT NULL DEFAULT '[]',   -- actions pré-définies
  publisher       text        NOT NULL DEFAULT 'official' CHECK (publisher IN ('official','marketplace')),
  version         text        NOT NULL DEFAULT '1.0.0',
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('beta','active','deprecated','disabled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connector_definitions_icon_idx ON mcp.connector_definitions (icon_file_id);
CREATE INDEX connector_definitions_name_trgm ON mcp.connector_definitions USING gin (name gin_trgm_ops);

-- Jetons OAuth obtenus auprès de systèmes tiers (Google, HubSpot...) — valeurs dans le coffre
CREATE TABLE mcp.oauth_connections (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  provider_key       text        NOT NULL,            -- google, hubspot, ...
  account_label      text,                            -- email ou nom du compte connecté
  scopes             text[]      NOT NULL DEFAULT '{}',
  access_secret_id   bigint      NOT NULL,
  refresh_secret_id  bigint,
  expires_at         timestamptz,
  last_refreshed_at  timestamptz,
  refresh_failures   smallint    NOT NULL DEFAULT 0,
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  connected_by_user_id bigint    REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (access_secret_id, organization_id)  REFERENCES iam.secrets(id, organization_id),
  FOREIGN KEY (refresh_secret_id, organization_id) REFERENCES iam.secrets(id, organization_id)
);
CREATE INDEX oauth_connections_org_idx     ON mcp.oauth_connections (organization_id, provider_key);
CREATE INDEX oauth_connections_access_idx  ON mcp.oauth_connections (access_secret_id, organization_id);
CREATE INDEX oauth_connections_refresh_idx ON mcp.oauth_connections (refresh_secret_id, organization_id);
CREATE INDEX oauth_connections_user_idx    ON mcp.oauth_connections (connected_by_user_id);
CREATE INDEX oauth_connections_refresh_due_idx ON mcp.oauth_connections (expires_at) WHERE status = 'active'; -- refresh 5 min avant

-- Bridge local : petit agent installé chez le client, connexion SORTANTE uniquement
CREATE TABLE mcp.bridges (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  name               text        NOT NULL,
  token_hash         bytea       NOT NULL UNIQUE,
  public_key         text,                         -- mTLS / signature
  agent_version      text,
  host_info          jsonb       NOT NULL DEFAULT '{}',
  status             text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline','revoked')),
  last_seen_at       timestamptz,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX bridges_ws_idx      ON mcp.bridges (workspace_id, organization_id);
CREATE INDEX bridges_creator_idx ON mcp.bridges (created_by_user_id);
CREATE INDEX bridges_offline_idx ON mcp.bridges (last_seen_at) WHERE status = 'online';

-- Connecteur = système externe branché (8 chemins d'entrée)
CREATE TABLE mcp.connectors (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id      bigint      NOT NULL,
  workspace_id         bigint      NOT NULL,
  definition_id        bigint      REFERENCES mcp.connector_definitions(id),   -- si prêt à l'emploi
  kind                 text        NOT NULL CHECK (kind IN (
                         'openapi','http_undocumented','database','google_workspace','saas',
                         'files','webhook_inbound','bridge','external_mcp','graphql')),
  name                 text        NOT NULL,
  description          text,
  base_url             text,
  db_engine            text        CHECK (db_engine IN ('postgresql','mysql','mariadb','sqlserver','sqlite')),
  bridge_id            bigint,
  config               jsonb       NOT NULL DEFAULT '{}',   -- non secret : en-têtes, pagination, fuseau...
  auth_type            text        NOT NULL DEFAULT 'none' CHECK (auth_type IN (
                         'none','api_key','bearer','basic','oauth2','hmac','mtls','db_password','bridge_token')),
  auth_config          jsonb       NOT NULL DEFAULT '{}',   -- nom d'en-tête, emplacement, algo HMAC...
  safety_config        jsonb       NOT NULL DEFAULT '{}',   -- DB : lecture seule, tables autorisées, limites
  status               text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','active','error','revoked','archived')),
  health_status        text        NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','warning','error')),
  consecutive_failures smallint    NOT NULL DEFAULT 0,
  last_health_at       timestamptz,
  last_error           text,
  source_listing_id    bigint,                        -- FK dans 080
  lock_version         integer     NOT NULL DEFAULT 0,
  created_by_user_id   bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  UNIQUE (id, organization_id),
  CHECK (kind <> 'database' OR db_engine IS NOT NULL),
  CHECK (kind <> 'bridge' OR bridge_id IS NOT NULL),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (bridge_id, organization_id)    REFERENCES mcp.bridges(id, organization_id)
);
CREATE INDEX connectors_ws_idx          ON mcp.connectors (workspace_id, organization_id) WHERE deleted_at IS NULL;
CREATE INDEX connectors_definition_idx  ON mcp.connectors (definition_id);
CREATE INDEX connectors_bridge_idx      ON mcp.connectors (bridge_id, organization_id);
CREATE INDEX connectors_creator_idx     ON mcp.connectors (created_by_user_id);
CREATE INDEX connectors_listing_idx     ON mcp.connectors (source_listing_id);
CREATE INDEX connectors_health_due_idx  ON mcp.connectors (last_health_at) WHERE status = 'active';   -- health check 15 min

-- Identifiants du connecteur, éventuellement différents par environnement
CREATE TABLE mcp.connector_credentials (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connector_id        bigint      NOT NULL,
  organization_id     bigint      NOT NULL,
  environment_id      bigint,                      -- NULL = tous environnements
  secret_id           bigint,
  oauth_connection_id bigint,
  status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalid','revoked')),
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (secret_id IS NOT NULL OR oauth_connection_id IS NOT NULL),
  FOREIGN KEY (connector_id, organization_id)        REFERENCES mcp.connectors(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id)      REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (secret_id, organization_id)           REFERENCES iam.secrets(id, organization_id),
  FOREIGN KEY (oauth_connection_id, organization_id) REFERENCES mcp.oauth_connections(id, organization_id)
);
CREATE UNIQUE INDEX connector_credentials_env_uq ON mcp.connector_credentials (connector_id, environment_id) NULLS NOT DISTINCT
  WHERE status = 'active';
CREATE INDEX connector_credentials_conn_idx   ON mcp.connector_credentials (connector_id, organization_id);
CREATE INDEX connector_credentials_env_idx    ON mcp.connector_credentials (environment_id, organization_id);
CREATE INDEX connector_credentials_secret_idx ON mcp.connector_credentials (secret_id, organization_id);
CREATE INDEX connector_credentials_oauth_idx  ON mcp.connector_credentials (oauth_connection_id, organization_id);

-- Matière première analysée : spec OpenAPI, schéma de base, description en langage naturel...
CREATE TABLE mcp.connector_sources (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connector_id    bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  source_type     text        NOT NULL CHECK (source_type IN (
                    'openapi_upload','openapi_url','auto_discovery','db_schema','nl_description',
                    'manual','graphql_introspection','mcp_discovery','file_schema')),
  file_id         bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  content         jsonb,                         -- spec/ schéma normalisé
  content_hash    bytea,
  analysis        jsonb       NOT NULL DEFAULT '{}',   -- résultat de la sémantisation (LLM)
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connector_id, organization_id) REFERENCES mcp.connectors(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX connector_sources_conn_idx ON mcp.connector_sources (connector_id, organization_id, fetched_at DESC);
CREATE INDEX connector_sources_file_idx ON mcp.connector_sources (file_id);

-- Opérations brutes. Pour les bases : requête SQL PARAMÉTRÉE validée par l'utilisateur,
-- jamais de SQL libre ; DELETE/DDL interdits (contrôlés par l'application + effect).
CREATE TABLE mcp.connector_actions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  connector_id    bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  key             text        NOT NULL,             -- operationId, nom de requête...
  kind            text        NOT NULL CHECK (kind IN ('http','sql','google_api','saas_api','file_query','mcp_proxy','graphql')),
  definition      jsonb       NOT NULL,             -- méthode/chemin/paramètres ou gabarit SQL + paramètres
  input_schema    jsonb       NOT NULL DEFAULT '{}',
  output_schema   jsonb,
  effect          text        NOT NULL CHECK (effect IN ('read','write','delete','financial','external_message')),
  risk_level      text        NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  is_idempotent   boolean     NOT NULL DEFAULT false,
  generated_by    text        NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai','manual','prebuilt','discovery')),
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','broken')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, key),
  UNIQUE (id, organization_id),
  FOREIGN KEY (connector_id, organization_id) REFERENCES mcp.connectors(id, organization_id) ON DELETE CASCADE,
  CHECK (kind <> 'sql' OR effect <> 'delete')
);
CREATE INDEX connector_actions_conn_org_idx ON mcp.connector_actions (connector_id, organization_id);

-- Connecteur « fichiers » : jeux de données importés (CSV, Excel, JSON...)
CREATE TABLE mcp.file_datasets (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  connector_id      bigint      NOT NULL,
  organization_id   bigint      NOT NULL,
  file_id           bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  refresh_url       text,
  refresh_cron      text,
  detected_schema   jsonb       NOT NULL DEFAULT '{}',
  row_count         bigint,
  last_refreshed_at timestamptz,
  status            text        NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','error')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connector_id, organization_id) REFERENCES mcp.connectors(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX file_datasets_conn_idx ON mcp.file_datasets (connector_id, organization_id);
CREATE INDEX file_datasets_file_idx ON mcp.file_datasets (file_id);

-- ------------------------------------------------------------ serveurs MCP
CREATE TABLE mcp.servers (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id       bigint      NOT NULL,
  workspace_id          bigint      NOT NULL,
  slug                  citext      NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  name                  text        NOT NULL,
  description           text,
  instructions          text,                      -- consignes globales remises au client MCP
  visibility            text        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','organization','public')),
  status                text        NOT NULL DEFAULT 'draft' CHECK (status IN
                        ('draft','validating','active','failed','deprecated','suspended','archived')),
  active_version_id     bigint,                    -- FK ajoutée après mcp.server_versions
  auth_modes            text[]      NOT NULL DEFAULT '{oauth}' CHECK (auth_modes <@ ARRAY['oauth','static_token','api_key']::text[]),
  tool_routing_enabled  boolean     NOT NULL DEFAULT false,
  tool_routing_top_k    smallint    NOT NULL DEFAULT 10,
  rate_limits           jsonb       NOT NULL DEFAULT '{}',
  suspended_reason      text,
  source_listing_id     bigint,
  lock_version          integer     NOT NULL DEFAULT 0,
  created_by_user_id    bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX servers_slug_uq  ON mcp.servers (workspace_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX servers_ws_org_idx      ON mcp.servers (workspace_id, organization_id);
CREATE INDEX servers_active_ver_idx  ON mcp.servers (active_version_id);
CREATE INDEX servers_creator_idx     ON mcp.servers (created_by_user_id);
CREATE INDEX servers_listing_idx     ON mcp.servers (source_listing_id);

-- Version publiée = instantané IMMUABLE de toute la config résolue (outils, schémas,
-- règles). Le runtime MCP lit uniquement ceci (cache Redis). Rollback = changer active_version_id.
CREATE TABLE mcp.server_versions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  server_id            bigint      NOT NULL,
  organization_id      bigint      NOT NULL,
  version_seq          integer     NOT NULL CHECK (version_seq > 0),
  semver               text        NOT NULL CHECK (semver ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  status               text        NOT NULL DEFAULT 'validating' CHECK (status IN
                       ('validating','published','failed','superseded','rolled_back')),
  config_snapshot      jsonb       NOT NULL,
  snapshot_hash        bytea       NOT NULL,
  validation_report    jsonb       NOT NULL DEFAULT '{}',   -- 5 étapes : structure, connectivité, tests, sécurité, sémantique
  changelog            text,
  published_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, version_seq),
  UNIQUE (server_id, semver),
  UNIQUE (id, organization_id),
  FOREIGN KEY (server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX server_versions_srv_org_idx   ON mcp.server_versions (server_id, organization_id);
CREATE INDEX server_versions_publisher_idx ON mcp.server_versions (published_by_user_id);

ALTER TABLE mcp.servers ADD CONSTRAINT servers_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES mcp.server_versions(id) ON DELETE SET NULL;

-- Outils éditables (brouillon). La version publiée est figée dans server_versions.config_snapshot.
CREATE TABLE mcp.tools (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  server_id          bigint      NOT NULL,
  organization_id    bigint      NOT NULL,
  action_id          bigint,                       -- NULL si outil composite
  name               text        NOT NULL CHECK (name ~ '^[a-z][a-z0-9_]{0,63}$'),   -- snake_case
  title              jsonb       CHECK (title IS NULL OR util.is_i18n(title)),
  description        text        NOT NULL CHECK (length(description) >= 10),         -- lue par l'IA
  input_schema       jsonb       NOT NULL DEFAULT '{"type":"object"}',
  output_schema      jsonb,
  input_mapping      jsonb       NOT NULL DEFAULT '{}',    -- paramètres outil -> paramètres action
  output_transform   jsonb       NOT NULL DEFAULT '{}',    -- filtrage / masquage de la sortie
  composite_plan     jsonb,                                -- enchaînement de plusieurs actions
  effect             text        NOT NULL CHECK (effect IN ('read','write','delete','financial','external_message')),
  risk_level         text        NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  requires_approval  boolean     NOT NULL DEFAULT false,
  approval_rules     jsonb       NOT NULL DEFAULT '{}',    -- ex: montant > 500 000 FCFA
  is_enabled         boolean     NOT NULL DEFAULT true,
  timeout_ms         integer     NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1000 AND 120000),
  retry_policy       jsonb       NOT NULL DEFAULT '{"max_attempts":3,"backoff":[1000,3000,9000]}',
  rate_limit         jsonb       NOT NULL DEFAULT '{}',
  quality_score      numeric(5,2),                         -- qualité de description (LLM interne)
  position           integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name),
  UNIQUE (id, organization_id),
  CHECK (action_id IS NOT NULL OR composite_plan IS NOT NULL),
  -- Règle : les suppressions et actions financières exigent toujours une approbation
  CHECK (effect NOT IN ('delete','financial') OR requires_approval),
  FOREIGN KEY (server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (action_id, organization_id) REFERENCES mcp.connector_actions(id, organization_id)
);
CREATE INDEX tools_srv_org_idx    ON mcp.tools (server_id, organization_id, position);
CREATE INDEX tools_action_idx     ON mcp.tools (action_id, organization_id);

-- Embeddings des outils pour le tool routing (un modèle d'embedding interne fixe)
CREATE TABLE mcp.tool_embeddings (
  tool_id          bigint      PRIMARY KEY REFERENCES mcp.tools(id) ON DELETE CASCADE,
  organization_id  bigint      NOT NULL,
  server_id        bigint      NOT NULL,
  embedding_model  text        NOT NULL,
  embedding        vector(1536) NOT NULL,
  content_hash     bytea       NOT NULL,           -- recalcul si la description change
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tool_embeddings_server_idx ON mcp.tool_embeddings (server_id);
CREATE INDEX tool_embeddings_org_idx    ON mcp.tool_embeddings (organization_id);
CREATE INDEX tool_embeddings_hnsw       ON mcp.tool_embeddings USING hnsw (embedding vector_cosine_ops);

-- Ressources MCP (données lisibles) et prompts MCP (gabarits)
CREATE TABLE mcp.resources (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  server_id       bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  action_id       bigint,
  uri_template    text        NOT NULL,
  name            text        NOT NULL,
  description     text,
  mime_type       text        NOT NULL DEFAULT 'application/json',
  is_enabled      boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, uri_template),
  FOREIGN KEY (server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (action_id, organization_id) REFERENCES mcp.connector_actions(id, organization_id)
);
CREATE INDEX resources_srv_org_idx ON mcp.resources (server_id, organization_id);
CREATE INDEX resources_action_idx  ON mcp.resources (action_id, organization_id);

CREATE TABLE mcp.prompts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  server_id       bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  name            text        NOT NULL CHECK (name ~ '^[a-z][a-z0-9_]{0,63}$'),
  description     text,
  arguments       jsonb       NOT NULL DEFAULT '[]',
  template        text        NOT NULL,
  is_enabled      boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name),
  FOREIGN KEY (server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX prompts_srv_org_idx ON mcp.prompts (server_id, organization_id);

-- Jetons statiques (Claude Desktop, Cursor : configuration manuelle)
CREATE TABLE mcp.access_tokens (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  server_id          bigint      NOT NULL,
  organization_id    bigint      NOT NULL,
  environment_id     bigint,
  name               text        NOT NULL,
  prefix             text        NOT NULL UNIQUE,     -- affiché : "mcp_live_7Hk2"
  token_hash         bytea       NOT NULL UNIQUE,
  scope_mode         text        NOT NULL DEFAULT 'read_only'
                     CHECK (scope_mode IN ('read_only','read_write','full','custom')),
  rate_limit         jsonb       NOT NULL DEFAULT '{}',
  expires_at         timestamptz,
  last_used_at       timestamptz,
  last_used_ip       inet,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  revoked_at         timestamptz,
  revoked_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (server_id, organization_id)      REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX access_tokens_srv_idx     ON mcp.access_tokens (server_id, organization_id) WHERE revoked_at IS NULL;
CREATE INDEX access_tokens_env_idx     ON mcp.access_tokens (environment_id, organization_id);
CREATE INDEX access_tokens_creator_idx ON mcp.access_tokens (created_by_user_id);
CREATE INDEX access_tokens_revoker_idx ON mcp.access_tokens (revoked_by_user_id);

-- Portée "custom" : liste explicite d'outils autorisés
CREATE TABLE mcp.access_token_tools (
  token_id        bigint NOT NULL,
  tool_id         bigint NOT NULL,
  organization_id bigint NOT NULL,
  PRIMARY KEY (token_id, tool_id),
  FOREIGN KEY (token_id, organization_id) REFERENCES mcp.access_tokens(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id, organization_id)  REFERENCES mcp.tools(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX access_token_tools_tool_idx  ON mcp.access_token_tools (tool_id, organization_id);
CREATE INDEX access_token_tools_token_idx ON mcp.access_token_tools (token_id, organization_id);

-- Historique des contrôles de santé (connecteurs, serveurs, bridges) — purge à 30 jours
CREATE TABLE mcp.health_checks (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  target_type     text        NOT NULL CHECK (target_type IN ('connector','server','bridge','tool')),
  target_id       bigint      NOT NULL,
  check_type      text        NOT NULL CHECK (check_type IN ('ping','sanity_tool','auth','schema_drift')),
  status          text        NOT NULL CHECK (status IN ('ok','warning','error')),
  latency_ms      integer,
  error_code      text,
  error_message   text,
  checked_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_checks_target_idx ON mcp.health_checks (target_type, target_id, checked_at DESC);
CREATE INDEX health_checks_org_idx    ON mcp.health_checks (organization_id, checked_at DESC);
CREATE INDEX health_checks_purge_idx  ON mcp.health_checks (checked_at);
