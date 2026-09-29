-- =============================================================================
-- 055_oauth.sql — Serveur d'autorisation OAuth 2.1 de la plateforme
-- Permet à Claude, ChatGPT, Cursor… (clients MCP) de se connecter à un serveur
-- MCP hébergé : enregistrement dynamique des clients (DCR), code + PKCE,
-- consentement, jetons d'accès / rafraîchissement avec rotation.
-- =============================================================================

-- Clients OAuth (globaux : un client comme "ChatGPT" sert plusieurs organisations)
CREATE TABLE iam.oauth_clients (
  id                         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id                  uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  client_id                  text        NOT NULL UNIQUE,
  client_secret_hash         bytea,                         -- NULL = client public (PKCE)
  name                       text        NOT NULL,
  logo_uri                   text,
  redirect_uris              text[]      NOT NULL CHECK (cardinality(redirect_uris) > 0),
  grant_types                text[]      NOT NULL DEFAULT '{authorization_code,refresh_token}',
  token_endpoint_auth_method text        NOT NULL DEFAULT 'none'
                             CHECK (token_endpoint_auth_method IN ('none','client_secret_basic','client_secret_post','private_key_jwt')),
  registered_via             text        NOT NULL DEFAULT 'dcr' CHECK (registered_via IN ('dcr','manual','first_party')),
  software_id                text,
  is_trusted                 boolean     NOT NULL DEFAULT false,    -- clients connus (Claude, ChatGPT)
  status                     text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  metadata                   jsonb       NOT NULL DEFAULT '{}',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_clients_software_idx ON iam.oauth_clients (software_id);

-- Consentement : quel utilisateur autorise quel client sur quel serveur MCP, avec quelles portées
CREATE TABLE iam.oauth_consents (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  client_id       bigint      NOT NULL REFERENCES iam.oauth_clients(id) ON DELETE CASCADE,
  mcp_server_id   bigint      NOT NULL,
  environment_id  bigint,
  scopes          text[]      NOT NULL,
  allowed_tool_ids bigint[],                     -- NULL = selon scopes
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  FOREIGN KEY (mcp_server_id, organization_id)  REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX oauth_consents_active_uq ON iam.oauth_consents (user_id, client_id, mcp_server_id) WHERE revoked_at IS NULL;
CREATE INDEX oauth_consents_client_idx ON iam.oauth_consents (client_id);
CREATE INDEX oauth_consents_server_idx ON iam.oauth_consents (mcp_server_id, organization_id);
CREATE INDEX oauth_consents_env_idx    ON iam.oauth_consents (environment_id, organization_id);
CREATE INDEX oauth_consents_org_idx    ON iam.oauth_consents (organization_id);

CREATE TABLE iam.oauth_authorization_codes (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_hash             bytea       NOT NULL UNIQUE,
  client_id             bigint      NOT NULL REFERENCES iam.oauth_clients(id) ON DELETE CASCADE,
  user_id               bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id       bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  consent_id            bigint      NOT NULL REFERENCES iam.oauth_consents(id) ON DELETE CASCADE,
  resource              text        NOT NULL,        -- URL du serveur MCP (RFC 8707)
  scopes                text[]      NOT NULL,
  redirect_uri          text        NOT NULL,
  code_challenge        text        NOT NULL,        -- PKCE obligatoire
  code_challenge_method text        NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
  expires_at            timestamptz NOT NULL,
  consumed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_codes_client_idx  ON iam.oauth_authorization_codes (client_id);
CREATE INDEX oauth_codes_user_idx    ON iam.oauth_authorization_codes (user_id);
CREATE INDEX oauth_codes_org_idx     ON iam.oauth_authorization_codes (organization_id);
CREATE INDEX oauth_codes_consent_idx ON iam.oauth_authorization_codes (consent_id);
CREATE INDEX oauth_codes_expiry_idx  ON iam.oauth_authorization_codes (expires_at) WHERE consumed_at IS NULL;

-- Jetons (hachés). family_id : détection de réutilisation d'un refresh token -> révocation de la famille.
CREATE TABLE iam.oauth_tokens (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash       bytea       NOT NULL UNIQUE,
  token_type       text        NOT NULL CHECK (token_type IN ('access','refresh')),
  family_id        uuid        NOT NULL,
  parent_token_id  bigint      REFERENCES iam.oauth_tokens(id) ON DELETE SET NULL,
  client_id        bigint      NOT NULL REFERENCES iam.oauth_clients(id) ON DELETE CASCADE,
  user_id          bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  consent_id       bigint      NOT NULL REFERENCES iam.oauth_consents(id) ON DELETE CASCADE,
  mcp_server_id    bigint      NOT NULL,
  scopes           text[]      NOT NULL,
  expires_at       timestamptz NOT NULL,
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  revoked_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mcp_server_id, organization_id) REFERENCES mcp.servers(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX oauth_tokens_family_idx  ON iam.oauth_tokens (family_id);
CREATE INDEX oauth_tokens_parent_idx  ON iam.oauth_tokens (parent_token_id);
CREATE INDEX oauth_tokens_client_idx  ON iam.oauth_tokens (client_id);
CREATE INDEX oauth_tokens_user_idx    ON iam.oauth_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX oauth_tokens_org_idx     ON iam.oauth_tokens (organization_id);
CREATE INDEX oauth_tokens_consent_idx ON iam.oauth_tokens (consent_id);
CREATE INDEX oauth_tokens_server_idx  ON iam.oauth_tokens (mcp_server_id, organization_id);
CREATE INDEX oauth_tokens_expiry_idx  ON iam.oauth_tokens (expires_at) WHERE revoked_at IS NULL;
