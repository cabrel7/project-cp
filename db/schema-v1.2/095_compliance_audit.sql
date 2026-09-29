-- =============================================================================
-- 095_compliance_audit.sql — Conformité (loi camerounaise 2024/017, RGPD) et
-- journal d'audit immuable.
-- =============================================================================

-- Documents légaux versionnés (CGU, confidentialité, DPA, CGV marketplace, cookies)
CREATE TABLE compliance.legal_documents (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  kind                  text        NOT NULL CHECK (kind IN ('terms','privacy','dpa','marketplace_terms','publisher_agreement','cookies','aup')),
  version               text        NOT NULL,
  locale                text        NOT NULL REFERENCES ref.languages(code),
  content_md            text,
  file_id               bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  published_at          timestamptz,
  is_current            boolean     NOT NULL DEFAULT false,
  requires_reacceptance boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version, locale)
);
CREATE UNIQUE INDEX legal_documents_current_uq ON compliance.legal_documents (kind, locale) WHERE is_current;
CREATE INDEX legal_documents_locale_idx ON compliance.legal_documents (locale);
CREATE INDEX legal_documents_file_idx   ON compliance.legal_documents (file_id);

CREATE TABLE compliance.legal_acceptances (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,  -- DPA accepté au nom de l'org
  document_id     bigint      NOT NULL REFERENCES compliance.legal_documents(id),
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip              inet,
  user_agent      text,
  UNIQUE (user_id, document_id, organization_id)
);
CREATE INDEX legal_acceptances_doc_idx ON compliance.legal_acceptances (document_id);
CREATE INDEX legal_acceptances_org_idx ON compliance.legal_acceptances (organization_id);

CREATE TABLE compliance.cookie_consents (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint      REFERENCES iam.users(id) ON DELETE CASCADE,
  anonymous_id text,
  categories   jsonb       NOT NULL,         -- {"necessary":true,"analytics":false}
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  ip           inet,
  CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);
CREATE INDEX cookie_consents_user_idx ON compliance.cookie_consents (user_id, recorded_at DESC);
CREATE INDEX cookie_consents_anon_idx ON compliance.cookie_consents (anonymous_id);

-- Demandes des personnes : accès, export, rectification, suppression
CREATE TABLE compliance.data_subject_requests (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  user_id             bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  organization_id     bigint      REFERENCES iam.organizations(id) ON DELETE SET NULL,
  requester_email     citext      NOT NULL,
  kind                text        NOT NULL CHECK (kind IN ('access','export','rectification','deletion','objection','portability')),
  status              text        NOT NULL DEFAULT 'received' CHECK (status IN ('received','verifying','in_progress','completed','rejected')),
  due_at              timestamptz NOT NULL,
  export_file_id      bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  handled_by_staff_id bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);
CREATE INDEX dsr_open_idx  ON compliance.data_subject_requests (due_at) WHERE status NOT IN ('completed','rejected');
CREATE INDEX dsr_user_idx  ON compliance.data_subject_requests (user_id);
CREATE INDEX dsr_org_idx   ON compliance.data_subject_requests (organization_id);
CREATE INDEX dsr_file_idx  ON compliance.data_subject_requests (export_file_id);
CREATE INDEX dsr_staff_idx ON compliance.data_subject_requests (handled_by_staff_id);

-- Registre des traitements
CREATE TABLE compliance.processing_activities (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              text        NOT NULL UNIQUE,
  purpose           text        NOT NULL,
  legal_basis       text        NOT NULL,
  data_categories   text[]      NOT NULL,
  data_subjects     text[]      NOT NULL,
  recipients        text[]      NOT NULL DEFAULT '{}',
  transfers         jsonb       NOT NULL DEFAULT '[]',   -- pays, garanties, autorisation
  retention         text        NOT NULL,
  security_measures text        NOT NULL,
  dpia_required     boolean     NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Sous-traitants (liste publique) : OVH, Anthropic, OpenAI, agrégateurs...
CREATE TABLE compliance.subprocessors (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text        NOT NULL,
  purpose     text        NOT NULL,
  location    text        NOT NULL,
  dpa_url     text,
  is_public   boolean     NOT NULL DEFAULT true,
  added_at    date        NOT NULL DEFAULT current_date,
  removed_at  date
);

-- Autorisations de transfert hors du Cameroun (Autorité de protection des données)
CREATE TABLE compliance.transfer_authorizations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  authority    text        NOT NULL,
  reference    text,
  scope        text        NOT NULL,
  destination  text        NOT NULL,
  status       text        NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','granted','refused','expired')),
  requested_at date        NOT NULL,
  granted_at   date,
  expires_at   date,
  file_id      bigint      REFERENCES storage.files(id) ON DELETE SET NULL
);
CREATE INDEX transfer_authorizations_file_idx ON compliance.transfer_authorizations (file_id);

-- Registre des violations de données (notification Autorité + personnes)
CREATE TABLE compliance.data_breaches (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id              uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  detected_at            timestamptz NOT NULL,
  description            text        NOT NULL,
  severity               text        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  affected_org_ids       bigint[]    NOT NULL DEFAULT '{}',
  affected_subjects_est  integer,
  data_categories        text[]      NOT NULL DEFAULT '{}',
  authority_notified_at  timestamptz,
  subjects_notified_at   timestamptz,
  measures               text,
  status                 text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','closed')),
  owner_staff_id         bigint      REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX data_breaches_staff_idx ON compliance.data_breaches (owner_staff_id);

-- --------------------------------------------------------------- audit
-- Journal IMMUABLE : actions des utilisateurs, clés API, agents, système ET de l'équipe interne.
-- Conservation selon le plan (7 j / 30 j / 90 j / 365 j+) via détachement de partitions.
CREATE TABLE audit.events (
  id                 bigint GENERATED ALWAYS AS IDENTITY,
  public_id          uuid        NOT NULL DEFAULT uuidv7(),
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  organization_id    bigint,                 -- NULL = événement plateforme
  workspace_id       bigint,
  environment_id     bigint,
  actor_type         text        NOT NULL CHECK (actor_type IN
                     ('user','api_key','agent','mcp_token','oauth_client','system','staff','impersonation')),
  actor_id           bigint,
  actor_label        text,                   -- email / nom figé au moment de l'action
  impersonation_id   bigint,
  action             text        NOT NULL,   -- agent.created, mcp.published, apikey.revoked, billing.refund...
  target_type        text,
  target_id          bigint,
  target_public_id   uuid,
  outcome            text        NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failure','denied')),
  ip                 inet,
  user_agent         text,
  request_id         text,
  changes            jsonb,                  -- {before, after} nettoyés de tout secret
  metadata           jsonb       NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, occurred_at),
  UNIQUE (public_id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX events_org_time_idx    ON audit.events (organization_id, occurred_at DESC);
CREATE INDEX events_target_idx      ON audit.events (target_type, target_id, occurred_at DESC);
CREATE INDEX events_actor_idx       ON audit.events (actor_type, actor_id, occurred_at DESC);
CREATE INDEX events_action_idx      ON audit.events (action, occurred_at DESC);
CREATE INDEX events_staff_idx       ON audit.events (actor_id, occurred_at DESC) WHERE actor_type IN ('staff','impersonation');

CREATE TRIGGER events_append_only
  BEFORE UPDATE OR DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION util.forbid_mutation();
