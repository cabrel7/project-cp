-- =============================================================================
-- 090_platform.sql — Back-office d'administration (application séparée :
-- admin.<domaine>). Équipe interne, rôles, sessions (2FA obligatoire, IP),
-- impersonation tracée, paramètres de la plateforme, maintenance, feature flags,
-- gestion de l'API (versions, limites, comptes de service, clés admin),
-- modèles de messages, traductions, codes d'erreur, annonces, page de statut,
-- support, modération, sécurité & abus.
-- =============================================================================

-- ---------------------------------------------------------- équipe interne
CREATE TABLE platform.staff_users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  email           citext      NOT NULL UNIQUE,
  full_name       text        NOT NULL,
  password_hash   text        NOT NULL,
  mfa_secret_ref  text,                         -- 2FA obligatoire (coffre)
  mfa_enrolled_at timestamptz,
  allowed_ips     cidr[],                       -- liste blanche d'IP
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','offboarded')),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- super_admin, finance, support, moderator, ops (+ rôles personnalisés)
CREATE TABLE platform.staff_roles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'),
  name        jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description jsonb,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.staff_permissions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z_]+(\.[a-z_]+)+$'),  -- orgs.suspend, finance.refund...
  module      text        NOT NULL,
  description jsonb       NOT NULL CHECK (util.is_i18n(description)),
  is_sensitive boolean    NOT NULL DEFAULT false        -- exige une ré-authentification
);

CREATE TABLE platform.staff_role_permissions (
  role_id       bigint NOT NULL REFERENCES platform.staff_roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES platform.staff_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX staff_role_permissions_perm_idx ON platform.staff_role_permissions (permission_id);

CREATE TABLE platform.staff_user_roles (
  staff_user_id bigint NOT NULL REFERENCES platform.staff_users(id) ON DELETE CASCADE,
  role_id       bigint NOT NULL REFERENCES platform.staff_roles(id) ON DELETE CASCADE,
  granted_by    bigint REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_user_id, role_id)
);
CREATE INDEX staff_user_roles_role_idx    ON platform.staff_user_roles (role_id);
CREATE INDEX staff_user_roles_granter_idx ON platform.staff_user_roles (granted_by);

CREATE TABLE platform.staff_sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_user_id bigint      NOT NULL REFERENCES platform.staff_users(id) ON DELETE CASCADE,
  token_hash    bytea       NOT NULL UNIQUE,
  ip            inet        NOT NULL,
  user_agent    text,
  mfa_passed_at timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,          -- sessions courtes (ex. 8 h)
  revoked_at    timestamptz
);
CREATE INDEX staff_sessions_user_idx ON platform.staff_sessions (staff_user_id) WHERE revoked_at IS NULL;

-- Clés API d'administration (automatisations internes, scripts d'exploitation)
CREATE TABLE platform.staff_api_keys (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id     uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  staff_user_id bigint      NOT NULL REFERENCES platform.staff_users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  prefix        text        NOT NULL UNIQUE,
  key_hash      bytea       NOT NULL UNIQUE,
  scopes        text[]      NOT NULL,
  allowed_ips   cidr[],
  expires_at    timestamptz NOT NULL,          -- toujours une expiration
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_api_keys_user_idx ON platform.staff_api_keys (staff_user_id);

-- Connexion "en tant que" un client pour le dépanner : motif + ticket + consentement, tout est audité
CREATE TABLE platform.impersonation_sessions (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  staff_user_id    bigint      NOT NULL REFERENCES platform.staff_users(id),
  target_user_id   bigint      NOT NULL REFERENCES iam.users(id),
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id),
  reason           text        NOT NULL,
  support_ticket_id bigint,                     -- FK plus bas
  customer_consent jsonb,                       -- preuve du consentement
  read_only        boolean     NOT NULL DEFAULT true,
  started_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  ended_at         timestamptz
);
CREATE INDEX impersonation_staff_idx  ON platform.impersonation_sessions (staff_user_id, started_at DESC);
CREATE INDEX impersonation_target_idx ON platform.impersonation_sessions (target_user_id);
CREATE INDEX impersonation_org_idx    ON platform.impersonation_sessions (organization_id);
CREATE INDEX impersonation_ticket_idx ON platform.impersonation_sessions (support_ticket_id);

-- Notes internes sur un client (jamais visibles par lui)
CREATE TABLE platform.staff_notes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type   text        NOT NULL CHECK (target_type IN ('organization','user','listing','publisher','payment')),
  target_id     bigint      NOT NULL,
  staff_user_id bigint      NOT NULL REFERENCES platform.staff_users(id),
  body          text        NOT NULL,
  is_pinned     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_notes_target_idx ON platform.staff_notes (target_type, target_id, created_at DESC);
CREATE INDEX staff_notes_staff_idx  ON platform.staff_notes (staff_user_id);

-- ---------------------------------------------------------------- paramètres
-- Inscriptions, pays/devises/langues actifs, sécurité, limites par défaut, marque (nom provisoire !),
-- rétention, communications... Une clé = une valeur typée. Les secrets restent dans le coffre.
CREATE TABLE platform.settings (
  key                  text        PRIMARY KEY CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),  -- brand.name, signup.mode...
  category             text        NOT NULL CHECK (category IN
                       ('brand','signup','localization','payments','communications','security','limits',
                        'free_tier','retention','legal','api','ai','mcp','agents','marketplace','system')),
  value                jsonb       NOT NULL,
  value_schema         jsonb,                   -- validation côté back-office
  description          jsonb,
  is_public            boolean     NOT NULL DEFAULT false,   -- exposable au frontend client
  updated_by_staff_id  bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX settings_category_idx ON platform.settings (category);
CREATE INDEX settings_staff_idx    ON platform.settings (updated_by_staff_id);

CREATE TABLE platform.settings_history (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key                 text        NOT NULL,
  old_value           jsonb,
  new_value           jsonb       NOT NULL,
  changed_by_staff_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  changed_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX settings_history_key_idx   ON platform.settings_history (key, changed_at DESC);
CREATE INDEX settings_history_staff_idx ON platform.settings_history (changed_by_staff_id);

CREATE TABLE platform.maintenance_windows (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  scope            text        NOT NULL CHECK (scope IN ('global','dashboard','api','mcp_runtime','agents','payments','marketplace')),
  data_region_id   bigint      REFERENCES ref.data_regions(id),
  mode             text        NOT NULL DEFAULT 'full' CHECK (mode IN ('full','read_only','degraded')),
  message          jsonb       NOT NULL CHECK (util.is_i18n(message)),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  allow_staff      boolean     NOT NULL DEFAULT true,
  status           text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')),
  created_by_staff_id bigint   REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_windows_active_idx ON platform.maintenance_windows (starts_at) WHERE status IN ('scheduled','active');
CREATE INDEX maintenance_windows_region_idx ON platform.maintenance_windows (data_region_id);
CREATE INDEX maintenance_windows_staff_idx  ON platform.maintenance_windows (created_by_staff_id);

-- Feature flags : activation progressive des surfaces (par plan, pays, organisation, pourcentage)
-- À distinguer des droits de plan (billing.features) : un flag décide si la fonction EXISTE pour qui.
CREATE TABLE platform.feature_flags (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key                 text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),  -- ai.vision, marketplace.publish
  description         text,
  kind                text        NOT NULL DEFAULT 'boolean' CHECK (kind IN ('boolean','percentage','variant')),
  default_value       jsonb       NOT NULL DEFAULT 'false',
  is_enabled          boolean     NOT NULL DEFAULT false,         -- interrupteur global (arrêt d'urgence)
  targeting           jsonb       NOT NULL DEFAULT '{}',          -- {"plans":[...],"countries":[...],"percentage":10}
  owner               text,
  updated_by_staff_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feature_flags_staff_idx ON platform.feature_flags (updated_by_staff_id);

CREATE TABLE platform.feature_flag_overrides (
  flag_id      bigint      NOT NULL REFERENCES platform.feature_flags(id) ON DELETE CASCADE,
  target_type  text        NOT NULL CHECK (target_type IN ('organization','user','workspace')),
  target_id    bigint      NOT NULL,
  value        jsonb       NOT NULL,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flag_id, target_type, target_id)
);
CREATE INDEX feature_flag_overrides_target_idx ON platform.feature_flag_overrides (target_type, target_id);

-- ------------------------------------------------------- gestion de l'API
CREATE TABLE platform.api_versions (
  version        text        PRIMARY KEY,           -- "2026-10-01" ou "v1"
  status         text        NOT NULL CHECK (status IN ('beta','current','deprecated','sunset')),
  released_at    date        NOT NULL,
  deprecated_at  date,
  sunset_at      date,
  changelog_url  text,
  notes          jsonb
);

-- Politiques de limitation de débit (globales, par plan, par organisation)
CREATE TABLE platform.rate_limit_policies (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key             text        NOT NULL,              -- api.requests, mcp.tool_calls, auth.otp...
  scope_type      text        NOT NULL CHECK (scope_type IN ('global','plan','organization','ip')),
  scope_id        bigint,
  limits          jsonb       NOT NULL,              -- {"per_minute":600,"burst":100}
  is_enabled      boolean     NOT NULL DEFAULT true,
  updated_by_staff_id bigint  REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rate_limit_policies_uq ON platform.rate_limit_policies (key, scope_type, scope_id) NULLS NOT DISTINCT;
CREATE INDEX rate_limit_policies_staff_idx ON platform.rate_limit_policies (updated_by_staff_id);

-- Comptes de service internes (API <-> LiteLLM, workers, Temporal...) : rotation tracée
CREATE TABLE platform.service_accounts (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key              text        NOT NULL UNIQUE,
  purpose          text        NOT NULL,
  secret_id        bigint      REFERENCES iam.secrets(id) ON DELETE SET NULL,
  scopes           text[]      NOT NULL DEFAULT '{}',
  last_rotated_at  timestamptz,
  rotation_days    integer     NOT NULL DEFAULT 90,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_accounts_secret_idx ON platform.service_accounts (secret_id);

-- Catalogue des codes d'erreur (messages bilingues, documentation)
CREATE TABLE platform.error_codes (
  code          text        PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]+$'),
  category      text        NOT NULL,          -- AUTH, BILLING, MCP, AGENT, LLM, PLATFORM
  http_status   smallint    NOT NULL,
  message       jsonb       NOT NULL CHECK (util.is_i18n(message)),
  hint          jsonb,
  is_retryable  boolean     NOT NULL DEFAULT false,
  refunds_credits boolean   NOT NULL DEFAULT false,
  doc_path      text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Modèles de messages (email, SMS, WhatsApp) bilingues et versionnés
CREATE TABLE platform.message_templates (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key                 text        NOT NULL,           -- otp_login, invoice_issued, approval_requested...
  channel             text        NOT NULL CHECK (channel IN ('email','sms','whatsapp','push','in_app')),
  locale              text        NOT NULL REFERENCES ref.languages(code),
  version             integer     NOT NULL DEFAULT 1,
  subject             text,
  body                text        NOT NULL,
  variables           jsonb       NOT NULL DEFAULT '[]',
  is_active           boolean     NOT NULL DEFAULT true,
  updated_by_staff_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel, locale, version)
);
CREATE UNIQUE INDEX message_templates_active_uq ON platform.message_templates (key, channel, locale) WHERE is_active;
CREATE INDEX message_templates_locale_idx ON platform.message_templates (locale);
CREATE INDEX message_templates_staff_idx  ON platform.message_templates (updated_by_staff_id);

-- Traductions éditables (surcharges de textes d'interface, contenus)
CREATE TABLE platform.translations (
  namespace   text        NOT NULL,
  key         text        NOT NULL,
  locale      text        NOT NULL REFERENCES ref.languages(code),
  value       text        NOT NULL,
  updated_by_staff_id bigint REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, key, locale)
);
CREATE INDEX translations_locale_idx ON platform.translations (locale);
CREATE INDEX translations_staff_idx  ON platform.translations (updated_by_staff_id);

-- ---------------------------------------------------- annonces & statut
CREATE TABLE platform.announcements (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  title            jsonb       NOT NULL CHECK (util.is_i18n(title)),
  body             jsonb       NOT NULL CHECK (util.is_i18n(body)),
  severity         text        NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  audience         jsonb       NOT NULL DEFAULT '{}',   -- plans, pays, organisations, profils
  placement        text        NOT NULL DEFAULT 'banner' CHECK (placement IN ('banner','modal','dashboard_card')),
  is_dismissible   boolean     NOT NULL DEFAULT true,
  starts_at        timestamptz NOT NULL DEFAULT now(),
  ends_at          timestamptz,
  created_by_staff_id bigint   REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_live_idx  ON platform.announcements (starts_at, ends_at);
CREATE INDEX announcements_staff_idx ON platform.announcements (created_by_staff_id);

CREATE TABLE platform.announcement_dismissals (
  announcement_id bigint      NOT NULL REFERENCES platform.announcements(id) ON DELETE CASCADE,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX announcement_dismissals_user_idx ON platform.announcement_dismissals (user_id);

CREATE TABLE platform.status_components (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE,     -- api, dashboard, mcp_runtime, agents, payments, llm_gateway
  name        jsonb       NOT NULL CHECK (util.is_i18n(name)),
  status      text        NOT NULL DEFAULT 'operational'
              CHECK (status IN ('operational','degraded','partial_outage','major_outage','maintenance')),
  sort_order  smallint    NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.incidents (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  title           jsonb       NOT NULL CHECK (util.is_i18n(title)),
  impact          text        NOT NULL CHECK (impact IN ('minor','major','critical')),
  status          text        NOT NULL DEFAULT 'investigating'
                  CHECK (status IN ('investigating','identified','monitoring','resolved')),
  component_ids   bigint[]    NOT NULL DEFAULT '{}',
  credits_refund_policy jsonb,                   -- remboursement auto des crédits consommés pendant l'incident
  started_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  postmortem_url  text,
  created_by_staff_id bigint  REFERENCES platform.staff_users(id) ON DELETE SET NULL
);
CREATE INDEX incidents_open_idx  ON platform.incidents (started_at DESC) WHERE status <> 'resolved';
CREATE INDEX incidents_staff_idx ON platform.incidents (created_by_staff_id);

CREATE TABLE platform.incident_updates (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id   bigint      NOT NULL REFERENCES platform.incidents(id) ON DELETE CASCADE,
  status        text        NOT NULL,
  message       jsonb       NOT NULL CHECK (util.is_i18n(message)),
  staff_user_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incident_updates_incident_idx ON platform.incident_updates (incident_id, created_at);
CREATE INDEX incident_updates_staff_idx    ON platform.incident_updates (staff_user_id);

-- ---------------------------------------------------------------- support
CREATE SEQUENCE platform.support_ticket_number_seq;

CREATE TABLE platform.support_tickets (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  number             bigint      NOT NULL UNIQUE DEFAULT nextval('platform.support_ticket_number_seq'),
  organization_id    bigint      REFERENCES iam.organizations(id) ON DELETE SET NULL,
  user_id            bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  contact_email      citext,
  subject            text        NOT NULL,
  category           text        NOT NULL CHECK (category IN ('billing','technical','account','mcp','agents','marketplace','security','other')),
  priority           text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status             text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending_customer','pending_internal','resolved','closed')),
  channel            text        NOT NULL DEFAULT 'web' CHECK (channel IN ('web','email','chat','whatsapp','phone')),
  assigned_staff_id  bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  sla_due_at         timestamptz,                -- selon le plan (48 h, 24 h, SLA Enterprise)
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  satisfaction       smallint    CHECK (satisfaction BETWEEN 1 AND 5),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_queue_idx ON platform.support_tickets (status, priority, sla_due_at) WHERE status NOT IN ('resolved','closed');
CREATE INDEX support_tickets_org_idx   ON platform.support_tickets (organization_id, created_at DESC);
CREATE INDEX support_tickets_user_idx  ON platform.support_tickets (user_id);
CREATE INDEX support_tickets_staff_idx ON platform.support_tickets (assigned_staff_id);

ALTER TABLE platform.impersonation_sessions ADD CONSTRAINT impersonation_ticket_fk
  FOREIGN KEY (support_ticket_id) REFERENCES platform.support_tickets(id) ON DELETE SET NULL;

CREATE TABLE platform.support_messages (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id      bigint      NOT NULL REFERENCES platform.support_tickets(id) ON DELETE CASCADE,
  author_type    text        NOT NULL CHECK (author_type IN ('user','staff','system')),
  user_id        bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  staff_user_id  bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  body           text        NOT NULL,
  is_internal    boolean     NOT NULL DEFAULT false,   -- note interne invisible du client
  attachment_ids bigint[]    NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON platform.support_messages (ticket_id, created_at);
CREATE INDEX support_messages_user_idx   ON platform.support_messages (user_id);
CREATE INDEX support_messages_staff_idx  ON platform.support_messages (staff_user_id);

-- ---------------------------------------------------- modération & abus
CREATE TABLE platform.moderation_reports (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  target_type        text        NOT NULL CHECK (target_type IN ('listing','publisher','mcp_server','organization','review')),
  target_id          bigint      NOT NULL,
  reporter_user_id   bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  reporter_org_id    bigint      REFERENCES iam.organizations(id) ON DELETE SET NULL,
  reason             text        NOT NULL CHECK (reason IN ('security','misleading','unexpected_behavior','abuse','copyright','other')),
  details            text,
  severity           text        NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal','high','security')),
  status             text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  resolved_by_staff_id bigint    REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  resolution         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);
CREATE INDEX moderation_reports_target_idx ON platform.moderation_reports (target_type, target_id);
CREATE INDEX moderation_reports_queue_idx  ON platform.moderation_reports (severity, created_at) WHERE status IN ('open','in_review');
CREATE INDEX moderation_reports_user_idx   ON platform.moderation_reports (reporter_user_id);
CREATE INDEX moderation_reports_org_idx    ON platform.moderation_reports (reporter_org_id);
CREATE INDEX moderation_reports_staff_idx  ON platform.moderation_reports (resolved_by_staff_id);

CREATE TABLE platform.moderation_actions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type    text        NOT NULL,
  target_id      bigint      NOT NULL,
  report_id      bigint      REFERENCES platform.moderation_reports(id) ON DELETE SET NULL,
  action         text        NOT NULL CHECK (action IN ('warning','suspend','remove','ban','restore')),
  reason         text        NOT NULL,
  staff_user_id  bigint      NOT NULL REFERENCES platform.staff_users(id),
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target_idx ON platform.moderation_actions (target_type, target_id, created_at DESC);
CREATE INDEX moderation_actions_report_idx ON platform.moderation_actions (report_id);
CREATE INDEX moderation_actions_staff_idx  ON platform.moderation_actions (staff_user_id);

-- Signaux d'abus : multi-comptes Free, fraude aux paiements, contenus signalés, abus de débit
CREATE TABLE platform.abuse_signals (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id      bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id              bigint      REFERENCES iam.users(id) ON DELETE CASCADE,
  kind                 text        NOT NULL CHECK (kind IN
                       ('free_tier_multi_account','payment_fraud','content_flag','rate_abuse','prompt_injection','credential_stuffing','other')),
  score                numeric(5,2) NOT NULL,
  details              jsonb       NOT NULL DEFAULT '{}',
  status               text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed','false_positive','actioned')),
  reviewed_by_staff_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz
);
CREATE INDEX abuse_signals_queue_idx ON platform.abuse_signals (kind, score DESC) WHERE status = 'open';
CREATE INDEX abuse_signals_org_idx   ON platform.abuse_signals (organization_id);
CREATE INDEX abuse_signals_user_idx  ON platform.abuse_signals (user_id);
CREATE INDEX abuse_signals_staff_idx ON platform.abuse_signals (reviewed_by_staff_id);

CREATE TABLE platform.blocklist_entries (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text        NOT NULL CHECK (kind IN ('email','email_domain','phone','ip','cidr','device','card_fingerprint')),
  value         text        NOT NULL,
  reason        text        NOT NULL,
  expires_at    timestamptz,
  created_by_staff_id bigint REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);
CREATE INDEX blocklist_entries_staff_idx ON platform.blocklist_entries (created_by_staff_id);

-- Liens vers l'équipe interne déclarés dans les domaines précédents
ALTER TABLE billing.organization_feature_overrides ADD CONSTRAINT org_feature_overrides_staff_fk
  FOREIGN KEY (granted_by_staff_id) REFERENCES platform.staff_users(id) ON DELETE SET NULL;
ALTER TABLE billing.coupons ADD CONSTRAINT coupons_staff_fk
  FOREIGN KEY (created_by_staff_id) REFERENCES platform.staff_users(id) ON DELETE SET NULL;
ALTER TABLE market.listing_versions ADD CONSTRAINT listing_versions_staff_fk
  FOREIGN KEY (reviewed_by_staff_id) REFERENCES platform.staff_users(id) ON DELETE SET NULL;

-- Stockage (D52) : auteur d'une migration entre backends
ALTER TABLE storage.backend_migrations
  ADD CONSTRAINT backend_migrations_staff_fk FOREIGN KEY (started_by_staff_user_id)
  REFERENCES platform.staff_users(id) ON DELETE SET NULL;
CREATE INDEX backend_migrations_staff_idx ON storage.backend_migrations (started_by_staff_user_id);
