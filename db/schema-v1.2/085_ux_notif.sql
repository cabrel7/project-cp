-- =============================================================================
-- 085_ux_notif.sql — Ce que le frontend sauvegarde (préférences, états d'écran,
-- vues enregistrées, brouillons d'assistants, onboarding, tableaux de bord)
-- et les notifications (in-app, email, SMS, WhatsApp, webhook).
-- =============================================================================

-- ------------------------------------------------------------------- UX
CREATE TABLE ux.user_preferences (
  user_id              bigint      PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  theme                text        NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  display_currency     char(3)     REFERENCES ref.currencies(code),
  date_format          text,
  number_format        text,
  default_org_id       bigint      REFERENCES iam.organizations(id) ON DELETE SET NULL,
  default_workspace_id bigint      REFERENCES iam.workspaces(id) ON DELETE SET NULL,
  sidebar_collapsed    boolean     NOT NULL DEFAULT false,
  density              text        NOT NULL DEFAULT 'comfortable' CHECK (density IN ('compact','comfortable')),
  technical_mode       boolean     NOT NULL DEFAULT false,  -- affiche les détails techniques (dev) ou non (non-dev)
  extra                jsonb       NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_preferences_currency_idx ON ux.user_preferences (display_currency);
CREATE INDEX user_preferences_org_idx      ON ux.user_preferences (default_org_id);
CREATE INDEX user_preferences_ws_idx       ON ux.user_preferences (default_workspace_id);

-- États d'interface clé/valeur (colonnes de tableau, panneaux, dernier onglet...)
CREATE TABLE ux.ui_states (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (length(key) <= 200),   -- "runs.table.columns"
  value           jsonb       NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ui_states_uq ON ux.ui_states (user_id, organization_id, key) NULLS NOT DISTINCT;
CREATE INDEX ui_states_org_idx   ON ux.ui_states (organization_id);

-- Filtres / vues enregistrées (runs, logs, appels d'outils, factures...)
CREATE TABLE ux.saved_views (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  resource        text        NOT NULL,
  name            text        NOT NULL,
  filters         jsonb       NOT NULL DEFAULT '{}',
  sort            jsonb       NOT NULL DEFAULT '[]',
  columns         jsonb       NOT NULL DEFAULT '[]',
  is_shared       boolean     NOT NULL DEFAULT false,   -- visible par l'organisation
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_views_user_idx   ON ux.saved_views (user_id, resource);
CREATE INDEX saved_views_shared_idx ON ux.saved_views (organization_id, resource) WHERE is_shared;
CREATE UNIQUE INDEX saved_views_default_uq ON ux.saved_views (user_id, organization_id, resource) WHERE is_default;

-- Brouillons d'assistants (MCP Builder, création d'agent, connecteur...) : reprise où on s'est arrêté
CREATE TABLE ux.drafts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL,
  workspace_id    bigint,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  resource_type   text        NOT NULL CHECK (resource_type IN
                  ('connector','mcp_server','agent','capability','listing','budget','policy','other')),
  resource_id     bigint,                      -- NULL = création en cours
  wizard_step     text,
  data            jsonb       NOT NULL,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX drafts_user_idx   ON ux.drafts (user_id, organization_id, updated_at DESC);
CREATE INDEX drafts_ws_idx     ON ux.drafts (workspace_id, organization_id);
CREATE INDEX drafts_expiry_idx ON ux.drafts (expires_at);
CREATE INDEX drafts_org_idx    ON ux.drafts (organization_id);

-- Progression des parcours d'onboarding (3 profils, D41 : activité, applications, entreprise)
CREATE TABLE ux.onboarding_progress (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  flow_key        text        NOT NULL,               -- "profile_selection", "first_mcp", "first_agent"...
  profile         text        CHECK (profile IN ('activity','builder','enterprise')),
  current_step    text,
  completed_steps text[]      NOT NULL DEFAULT '{}',
  data            jsonb       NOT NULL DEFAULT '{}',
  completed_at    timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX onboarding_progress_uq ON ux.onboarding_progress (user_id, organization_id, flow_key) NULLS NOT DISTINCT;
CREATE INDEX onboarding_progress_org_idx   ON ux.onboarding_progress (organization_id);

-- Tableaux de bord personnalisés (widgets, disposition)
CREATE TABLE ux.dashboards (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  workspace_id    bigint,
  owner_user_id   bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  layout          jsonb       NOT NULL DEFAULT '[]',
  widgets         jsonb       NOT NULL DEFAULT '[]',
  is_shared       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX dashboards_owner_idx ON ux.dashboards (owner_user_id);
CREATE INDEX dashboards_org_idx   ON ux.dashboards (organization_id) WHERE is_shared;
CREATE INDEX dashboards_ws_idx    ON ux.dashboards (workspace_id, organization_id);

-- --------------------------------------------------------- notifications
CREATE TABLE notif.notifications (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  type            text        NOT NULL,        -- wallet.low, budget.threshold, run.failed, approval.requested...
  category        text        NOT NULL CHECK (category IN ('billing','usage','agents','mcp','security','marketplace','team','system')),
  severity        text        NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  title           text        NOT NULL,        -- rendu dans la langue de l'utilisateur
  body            text,
  params          jsonb       NOT NULL DEFAULT '{}',
  action_url      text,
  resource_type   text,
  resource_public_id uuid,
  read_at         timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notif.notifications (user_id, created_at DESC) WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX notifications_user_idx        ON notif.notifications (user_id, created_at DESC);
CREATE INDEX notifications_org_idx         ON notif.notifications (organization_id);

CREATE TABLE notif.preferences (
  user_id         bigint  NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id bigint  REFERENCES iam.organizations(id) ON DELETE CASCADE,
  category        text    NOT NULL,
  channel         text    NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp','webhook','push')),
  enabled         boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notif_preferences_uq ON notif.preferences (user_id, organization_id, category, channel) NULLS NOT DISTINCT;
CREATE INDEX notif_preferences_org_idx   ON notif.preferences (organization_id);

-- Envois sortants (email, SMS, WhatsApp) — traçabilité et relances
CREATE TABLE notif.deliveries (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id     bigint      REFERENCES notif.notifications(id) ON DELETE SET NULL,
  organization_id     bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  channel             text        NOT NULL CHECK (channel IN ('email','sms','whatsapp','push')),
  recipient           text        NOT NULL,
  template_key        text        NOT NULL,
  locale              text        NOT NULL REFERENCES ref.languages(code),
  status              text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','bounced','failed')),
  provider            text,
  provider_message_id text,
  error               text,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deliveries_notification_idx ON notif.deliveries (notification_id);
CREATE INDEX deliveries_org_idx          ON notif.deliveries (organization_id, created_at DESC);
CREATE INDEX deliveries_locale_idx       ON notif.deliveries (locale);
CREATE INDEX deliveries_queue_idx        ON notif.deliveries (created_at) WHERE status = 'queued';
CREATE INDEX deliveries_provider_msg_idx ON notif.deliveries (provider, provider_message_id);
