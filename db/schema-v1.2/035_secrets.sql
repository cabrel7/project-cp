-- =============================================================================
-- 035_secrets.sql — Références vers le coffre de secrets (Infisical)
-- AUCUNE valeur secrète en base : seulement le chemin, la version et une empreinte.
-- Utilisé par : connecteurs, clés BYOK, webhooks (HMAC), comptes fournisseurs,
-- agrégateurs de paiement, jetons OAuth tiers, bridges, comptes de service.
-- =============================================================================

CREATE TABLE iam.secrets (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE, -- NULL = secret plateforme
  workspace_id       bigint,
  environment_id     bigint,
  owner_type         text        NOT NULL CHECK (owner_type IN (
                       'connector_credential','byok_key','webhook_signing','provider_account',
                       'payment_provider','oauth_token','bridge','service_account','mcp_upstream','other')),
  vault_path         text        NOT NULL UNIQUE,
  vault_version      integer     NOT NULL DEFAULT 1,
  fingerprint        text,                     -- ex: "…a9F2" (4 derniers caractères) ou hash tronqué
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotating','revoked','expired')),
  expires_at         timestamptz,
  last_rotated_at    timestamptz,
  last_validated_at  timestamptz,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)   REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX secrets_org_owner_idx  ON iam.secrets (organization_id, owner_type);
CREATE INDEX secrets_ws_org_idx     ON iam.secrets (workspace_id, organization_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX secrets_env_org_idx    ON iam.secrets (environment_id, organization_id) WHERE environment_id IS NOT NULL;
CREATE INDEX secrets_creator_idx    ON iam.secrets (created_by_user_id);
CREATE INDEX secrets_expiry_idx     ON iam.secrets (expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;
