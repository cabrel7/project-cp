-- =============================================================================
-- 070_dev.sql — Surface développeur : clés API (SDK), utilisateurs finaux des
-- applications clientes, webhooks entrants et sortants, idempotence, outbox,
-- connexion CLI (device flow).
-- =============================================================================

-- Clés API du SDK — liées à un environnement. Seul le préfixe est affichable.
CREATE TABLE dev.api_keys (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  environment_id     bigint      NOT NULL,
  project_id         bigint,
  name               text        NOT NULL,
  prefix             text        NOT NULL UNIQUE,     -- "sk_live_4fT9" / "sk_test_..."
  key_hash           bytea       NOT NULL UNIQUE,     -- sha256(clé complète)
  scopes             text[]      NOT NULL DEFAULT '{run,mcp.call}',
  allowed_ips        cidr[],
  allowed_origins    text[],                          -- usage navigateur
  rate_limit_per_min integer     CHECK (rate_limit_per_min > 0),
  expires_at         timestamptz,
  last_used_at       timestamptz,
  last_used_ip       inet,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  revoked_at         timestamptz,
  revoked_by         jsonb,                           -- {type: user|staff|system, id, reason}
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)   REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, organization_id)     REFERENCES iam.projects(id, organization_id) ON DELETE SET NULL (project_id)
);
CREATE INDEX api_keys_ws_idx       ON dev.api_keys (workspace_id, organization_id) WHERE revoked_at IS NULL;
CREATE INDEX api_keys_env_idx      ON dev.api_keys (environment_id, organization_id);
CREATE INDEX api_keys_project_idx  ON dev.api_keys (project_id, organization_id);
CREATE INDEX api_keys_creator_idx  ON dev.api_keys (created_by_user_id);
CREATE INDEX api_keys_expiry_idx   ON dev.api_keys (expires_at) WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

-- Utilisateurs finaux des applications de nos clients (metering par client final)
CREATE TABLE dev.end_users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  workspace_id    bigint      NOT NULL,
  external_ref    text        NOT NULL,              -- identifiant côté application cliente
  display_name    text,
  tier            text,                              -- palier défini par le client (starter, growth...)
  metadata        jsonb       NOT NULL DEFAULT '{}',
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  blocked_at      timestamptz,
  UNIQUE (workspace_id, external_ref),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX end_users_ws_org_idx ON dev.end_users (workspace_id, organization_id);
CREATE INDEX end_users_tier_idx   ON dev.end_users (workspace_id, tier);

ALTER TABLE agent.conversations ADD CONSTRAINT conversations_end_user_fk
  FOREIGN KEY (end_user_id) REFERENCES dev.end_users(id) ON DELETE SET NULL;

-- Points d'entrée webhook (déclencheurs d'agents, connecteur "webhooks entrants")
CREATE TABLE dev.webhook_endpoints (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,  -- dans l'URL : /hooks/{public_id}
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  environment_id     bigint      NOT NULL,
  connector_id       bigint,
  name               text        NOT NULL,
  verification       jsonb       NOT NULL DEFAULT '{"type":"hmac_sha256","header":"X-Signature"}',
  signing_secret_id  bigint,
  event_type_path    text,                           -- où lire le type d'événement dans le payload
  dedupe_key_path    text,
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  last_received_at   timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)      REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id)    REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (connector_id, organization_id)      REFERENCES mcp.connectors(id, organization_id) ON DELETE SET NULL (connector_id),
  FOREIGN KEY (signing_secret_id, organization_id) REFERENCES iam.secrets(id, organization_id)
);
CREATE INDEX webhook_endpoints_ws_idx     ON dev.webhook_endpoints (workspace_id, organization_id);
CREATE INDEX webhook_endpoints_env_idx    ON dev.webhook_endpoints (environment_id, organization_id);
CREATE INDEX webhook_endpoints_conn_idx   ON dev.webhook_endpoints (connector_id, organization_id);
CREATE INDEX webhook_endpoints_secret_idx ON dev.webhook_endpoints (signing_secret_id, organization_id);

ALTER TABLE agent.triggers ADD CONSTRAINT triggers_webhook_endpoint_fk
  FOREIGN KEY (webhook_endpoint_id, organization_id)
  REFERENCES dev.webhook_endpoints(id, organization_id) ON DELETE CASCADE;

-- Événements reçus (volume élevé -> partitionné)
CREATE TABLE dev.inbound_events (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  public_id        uuid        NOT NULL DEFAULT uuidv7(),
  received_at      timestamptz NOT NULL DEFAULT now(),
  organization_id  bigint      NOT NULL,
  endpoint_id      bigint      NOT NULL,
  event_type       text,
  dedupe_key       text,
  headers          jsonb       NOT NULL DEFAULT '{}',   -- en-têtes filtrés
  payload          jsonb       NOT NULL,
  signature_valid  boolean     NOT NULL,
  status           text        NOT NULL DEFAULT 'received' CHECK (status IN ('received','routed','ignored','rejected','failed')),
  triggered_runs   jsonb       NOT NULL DEFAULT '[]',   -- [{run_id, run_created_at}]
  error            text,
  PRIMARY KEY (id, received_at),
  UNIQUE (public_id, received_at)
) PARTITION BY RANGE (received_at);
CREATE INDEX inbound_events_endpoint_idx ON dev.inbound_events (endpoint_id, received_at DESC);
CREATE INDEX inbound_events_org_idx      ON dev.inbound_events (organization_id, received_at DESC);
CREATE INDEX inbound_events_dedupe_idx   ON dev.inbound_events (endpoint_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Webhooks sortants (notifier le système du client : run terminé, approbation demandée...)
CREATE TABLE dev.webhook_subscriptions (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  environment_id     bigint,
  url                text        NOT NULL CHECK (url ~ '^https://'),
  description        text,
  event_types        text[]      NOT NULL,              -- run.completed, approval.requested...
  signing_secret_id  bigint      NOT NULL,
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  consecutive_failures integer   NOT NULL DEFAULT 0,
  disabled_reason    text,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)      REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id)    REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (signing_secret_id, organization_id) REFERENCES iam.secrets(id, organization_id)
);
CREATE INDEX webhook_subscriptions_ws_idx      ON dev.webhook_subscriptions (workspace_id, organization_id) WHERE status = 'active';
CREATE INDEX webhook_subscriptions_env_idx     ON dev.webhook_subscriptions (environment_id, organization_id);
CREATE INDEX webhook_subscriptions_secret_idx  ON dev.webhook_subscriptions (signing_secret_id, organization_id);
CREATE INDEX webhook_subscriptions_creator_idx ON dev.webhook_subscriptions (created_by_user_id);
CREATE INDEX webhook_subscriptions_events_gin  ON dev.webhook_subscriptions USING gin (event_types);

CREATE TABLE dev.webhook_deliveries (
  id                  bigint GENERATED ALWAYS AS IDENTITY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  organization_id     bigint      NOT NULL,
  subscription_id     bigint      NOT NULL,
  event_public_id     uuid        NOT NULL,          -- identifiant de l'événement (idempotence côté client)
  event_type          text        NOT NULL,
  payload             jsonb       NOT NULL,
  attempt             smallint    NOT NULL DEFAULT 1,
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','abandoned')),
  response_status     smallint,
  response_snippet    text,
  duration_ms         integer,
  next_retry_at       timestamptz,
  delivered_at        timestamptz,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX webhook_deliveries_sub_idx   ON dev.webhook_deliveries (subscription_id, created_at DESC);
CREATE INDEX webhook_deliveries_retry_idx ON dev.webhook_deliveries (next_retry_at) WHERE status = 'pending';
CREATE INDEX webhook_deliveries_event_idx ON dev.webhook_deliveries (event_public_id);
CREATE INDEX webhook_deliveries_org_idx   ON dev.webhook_deliveries (organization_id, created_at DESC);

-- Outbox transactionnelle : les événements métier sont écrits dans la même
-- transaction que la donnée, puis publiés (webhooks, notifications, ClickHouse)
CREATE TABLE dev.outbox_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint,
  aggregate_type  text        NOT NULL,
  aggregate_id    bigint      NOT NULL,
  event_type      text        NOT NULL,
  payload         jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  attempts        smallint    NOT NULL DEFAULT 0,
  last_error      text
);
CREATE INDEX outbox_events_unpublished_idx ON dev.outbox_events (id) WHERE published_at IS NULL;
CREATE INDEX outbox_events_aggregate_idx   ON dev.outbox_events (aggregate_type, aggregate_id);
CREATE INDEX outbox_events_published_idx   ON dev.outbox_events (published_at) WHERE published_at IS NOT NULL; -- purge

-- Idempotence des requêtes API (en-tête Idempotency-Key)
CREATE TABLE dev.idempotency_keys (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  api_key_id       bigint,
  key              text        NOT NULL,
  request_method   text        NOT NULL,
  request_path     text        NOT NULL,
  request_hash     bytea       NOT NULL,
  response_status  smallint,
  response_body    jsonb,
  locked_until     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  UNIQUE (organization_id, key),
  FOREIGN KEY (api_key_id, organization_id) REFERENCES dev.api_keys(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX idempotency_keys_apikey_idx ON dev.idempotency_keys (api_key_id, organization_id);
CREATE INDEX idempotency_keys_expiry_idx ON dev.idempotency_keys (expires_at);

-- Connexion de la CLI (OAuth device flow)
CREATE TABLE dev.device_authorizations (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_code_hash bytea       NOT NULL UNIQUE,
  user_code        text        NOT NULL,
  client_name      text        NOT NULL DEFAULT 'cli',
  user_id          bigint      REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id  bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired','consumed')),
  interval_s       smallint    NOT NULL DEFAULT 5,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX device_authorizations_code_uq ON dev.device_authorizations (user_code) WHERE status = 'pending';
CREATE INDEX device_authorizations_user_idx ON dev.device_authorizations (user_id);
CREATE INDEX device_authorizations_org_idx  ON dev.device_authorizations (organization_id);
