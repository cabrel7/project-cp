-- =============================================================================
-- 020_iam.sql — Identité, organisations, rôles, workspaces, environnements
-- Hiérarchie : organization -> workspace -> environment / project
-- =============================================================================

-- ---------------------------------------------------------------- utilisateurs
CREATE TABLE iam.users (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  email             citext      UNIQUE,
  email_verified_at timestamptz,
  phone_e164        text        UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  phone_verified_at timestamptz,
  password_hash     text,                        -- argon2id ; NULL si connexion OTP / OAuth seulement
  full_name         text,
  avatar_file_id    bigint,                      -- FK ajoutée dans 025_storage
  locale            text        NOT NULL DEFAULT 'fr' REFERENCES ref.languages(code),
  timezone          text        NOT NULL DEFAULT 'Africa/Douala',
  country_code      char(2)     REFERENCES ref.countries(code),
  status            text        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending','active','suspended','deleted')),
  mfa_enabled       boolean     NOT NULL DEFAULT false,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
);
CREATE INDEX users_locale_idx   ON iam.users (locale);
CREATE INDEX users_country_idx  ON iam.users (country_code);
CREATE INDEX users_status_idx   ON iam.users (status) WHERE status <> 'active';
CREATE INDEX users_name_trgm    ON iam.users USING gin (full_name gin_trgm_ops);   -- recherche admin
CREATE INDEX users_email_trgm   ON iam.users USING gin ((email::text) gin_trgm_ops);

-- Connexions externes (Google, GitHub...)
CREATE TABLE iam.user_identities (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  provider         text        NOT NULL CHECK (provider IN ('google','github','microsoft','apple')),
  provider_user_id text        NOT NULL,
  email            citext,
  profile          jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz,
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX user_identities_user_idx ON iam.user_identities (user_id);

-- Facteurs MFA (le secret TOTP / WebAuthn vit dans le coffre : secret_ref)
CREATE TABLE iam.user_mfa_factors (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id    uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  user_id      bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('totp','webauthn','sms','recovery_codes')),
  label        text,
  secret_ref   text        NOT NULL,         -- chemin coffre (Infisical)
  verified_at  timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_mfa_factors_user_idx ON iam.user_mfa_factors (user_id);

CREATE TABLE iam.user_sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id    uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  user_id      bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  token_hash   bytea       NOT NULL UNIQUE,   -- sha256 du jeton ; jamais le jeton
  ip           inet,
  user_agent   text,
  device_label text,
  mfa_passed   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX user_sessions_user_active_idx ON iam.user_sessions (user_id, last_seen_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX user_sessions_expiry_idx      ON iam.user_sessions (expires_at) WHERE revoked_at IS NULL;

-- Jetons à usage unique : vérif email/téléphone, reset mot de passe, lien magique, OTP
CREATE TABLE iam.verification_tokens (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint      REFERENCES iam.users(id) ON DELETE CASCADE,
  purpose      text        NOT NULL CHECK (purpose IN
               ('verify_email','verify_phone','reset_password','magic_link','otp_login','change_email','change_phone')),
  target       text        NOT NULL,          -- email ou téléphone visé
  token_hash   bytea       NOT NULL UNIQUE,
  attempts     smallint    NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts smallint    NOT NULL DEFAULT 5,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_tokens_user_idx   ON iam.verification_tokens (user_id);
CREATE INDEX verification_tokens_target_idx ON iam.verification_tokens (target, purpose, created_at DESC); -- anti-spam OTP
CREATE INDEX verification_tokens_expiry_idx ON iam.verification_tokens (expires_at) WHERE consumed_at IS NULL;

-- ------------------------------------------------------------- organisations
CREATE TABLE iam.organizations (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  name                  text        NOT NULL,
  slug                  citext      NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'),
  kind                  text        NOT NULL DEFAULT 'company' CHECK (kind IN ('individual','company')),
  legal_name            text,
  tax_id                text,
  billing_email         citext,
  billing_address       jsonb,
  country_code          char(2)     NOT NULL REFERENCES ref.countries(code),
  default_currency      char(3)     NOT NULL REFERENCES ref.currencies(code),
  default_locale        text        NOT NULL REFERENCES ref.languages(code),
  data_region_id        bigint      NOT NULL REFERENCES ref.data_regions(id),
  status                text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','pending_deletion','deleted')),
  suspended_reason      text,
  deletion_requested_at timestamptz,
  deletion_scheduled_at timestamptz,        -- +30 jours de grâce
  is_internal           boolean     NOT NULL DEFAULT false,  -- orgs internes / banc d'essai (Kòmerce)
  settings              jsonb       NOT NULL DEFAULT '{}',
  created_by_user_id    bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  lock_version          integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE UNIQUE INDEX organizations_slug_uq      ON iam.organizations (slug) WHERE deleted_at IS NULL;
CREATE INDEX organizations_country_idx         ON iam.organizations (country_code);
CREATE INDEX organizations_currency_idx        ON iam.organizations (default_currency);
CREATE INDEX organizations_locale_idx          ON iam.organizations (default_locale);
CREATE INDEX organizations_region_idx          ON iam.organizations (data_region_id);
CREATE INDEX organizations_created_by_idx      ON iam.organizations (created_by_user_id);
CREATE INDEX organizations_status_idx          ON iam.organizations (status) WHERE status <> 'active';
CREATE INDEX organizations_deletion_idx        ON iam.organizations (deletion_scheduled_at) WHERE status = 'pending_deletion';
CREATE INDEX organizations_name_trgm           ON iam.organizations USING gin (name gin_trgm_ops);

-- --------------------------------------------------------- rôles & permissions
-- Catalogue des permissions (ex: agents.create, mcp.publish, billing.manage)
CREATE TABLE iam.permissions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  category    text        NOT NULL,
  description jsonb       NOT NULL CHECK (util.is_i18n(description)),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Rôles système (organization_id NULL : owner, admin, developer, operator, viewer)
-- ou personnalisés par organisation (Enterprise)
CREATE TABLE iam.roles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (key ~ '^[a-z0-9_]+$'),
  name            jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description     jsonb,
  is_system       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (is_system = (organization_id IS NULL))
);
CREATE UNIQUE INDEX roles_key_uq ON iam.roles (organization_id, key) NULLS NOT DISTINCT;

CREATE TABLE iam.role_permissions (
  role_id       bigint NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES iam.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX role_permissions_permission_idx ON iam.role_permissions (permission_id);

CREATE TABLE iam.memberships (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id            bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  role_id            bigint      NOT NULL REFERENCES iam.roles(id),
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  invited_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  joined_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (id, organization_id)
);
CREATE INDEX memberships_user_idx    ON iam.memberships (user_id);          -- "mes organisations"
CREATE INDEX memberships_role_idx    ON iam.memberships (role_id);
CREATE INDEX memberships_invited_idx ON iam.memberships (invited_by_user_id);

CREATE TABLE iam.invitations (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  email              citext      NOT NULL,
  role_id            bigint      NOT NULL REFERENCES iam.roles(id),
  token_hash         bytea       NOT NULL UNIQUE,
  invited_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  expires_at         timestamptz NOT NULL,             -- 7 jours
  accepted_at        timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invitations_pending_uq ON iam.invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX invitations_email_idx   ON iam.invitations (email);
CREATE INDEX invitations_role_idx    ON iam.invitations (role_id);
CREATE INDEX invitations_invited_idx ON iam.invitations (invited_by_user_id);

-- Équipes / départements (permissions et budgets par équipe — Business/Enterprise)
CREATE TABLE iam.teams (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX teams_name_uq ON iam.teams (organization_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE iam.team_members (
  team_id         bigint NOT NULL,
  membership_id   bigint NOT NULL,
  organization_id bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, membership_id),
  FOREIGN KEY (team_id, organization_id)       REFERENCES iam.teams(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, organization_id) REFERENCES iam.memberships(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX team_members_membership_idx ON iam.team_members (membership_id, organization_id);
CREATE INDEX team_members_team_org_idx   ON iam.team_members (team_id, organization_id);

-- ------------------------------------------------------------------ workspaces
CREATE TABLE iam.workspaces (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  slug            citext      NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  description     text,
  data_region_id  bigint      REFERENCES ref.data_regions(id),     -- surcharge (Enterprise)
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  settings        jsonb       NOT NULL DEFAULT '{}',
  lock_version    integer     NOT NULL DEFAULT 0,
  created_by_user_id bigint   REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX workspaces_slug_uq  ON iam.workspaces (organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX workspaces_region_idx      ON iam.workspaces (data_region_id);
CREATE INDEX workspaces_created_by_idx  ON iam.workspaces (created_by_user_id);

-- Accès fin au niveau workspace (surcharge du rôle d'organisation)
CREATE TABLE iam.workspace_members (
  workspace_id    bigint NOT NULL,
  membership_id   bigint NOT NULL,
  organization_id bigint NOT NULL,
  role_id         bigint REFERENCES iam.roles(id),     -- NULL = hérite du rôle d'organisation
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, membership_id),
  FOREIGN KEY (workspace_id, organization_id)  REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, organization_id) REFERENCES iam.memberships(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX workspace_members_membership_idx ON iam.workspace_members (membership_id, organization_id);
CREATE INDEX workspace_members_ws_org_idx     ON iam.workspace_members (workspace_id, organization_id);
CREATE INDEX workspace_members_role_idx       ON iam.workspace_members (role_id);

-- Environnements : dev / staging / production / sandbox (mode test)
CREATE TABLE iam.environments (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  workspace_id    bigint      NOT NULL,
  key             text        NOT NULL CHECK (key ~ '^[a-z0-9_-]{1,32}$'),
  name            text        NOT NULL,
  kind            text        NOT NULL DEFAULT 'custom'
                  CHECK (kind IN ('development','staging','production','sandbox','custom')),
  is_sandbox      boolean     NOT NULL DEFAULT false,   -- outils simulés, crédits de test
  settings        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (id, organization_id),
  UNIQUE (id, workspace_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX environments_key_uq ON iam.environments (workspace_id, key) WHERE deleted_at IS NULL;
CREATE INDEX environments_ws_org_idx    ON iam.environments (workspace_id, organization_id);

-- Projets : regroupement applicatif dans un workspace (traçabilité des coûts)
CREATE TABLE iam.projects (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  workspace_id    bigint      NOT NULL,
  name            text        NOT NULL,
  slug            citext      NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX projects_slug_uq ON iam.projects (workspace_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX projects_ws_org_idx     ON iam.projects (workspace_id, organization_id);
