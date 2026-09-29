-- =============================================================================
-- 080_market.sql — Marketplace : éditeurs, fiches (MCP, modèles d'agent,
-- prompts, bundles), versions, prix, installations, droits d'accès, avis,
-- revenus des créateurs (70/30) et versements.
-- Les fiches publiées sont lisibles par tous (politique RLS dédiée, 900_security).
-- =============================================================================

CREATE TABLE market.publishers (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id      bigint      NOT NULL UNIQUE REFERENCES iam.organizations(id) ON DELETE CASCADE,
  display_name         text        NOT NULL,
  slug                 citext      NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  bio                  jsonb,
  website              text,
  logo_file_id         bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  level                text        NOT NULL DEFAULT 'community' CHECK (level IN ('community','verified','premium_certified','official')),
  status               text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  payout_method_id     bigint      REFERENCES billing.payment_methods(id) ON DELETE SET NULL,
  payout_currency      char(3)     REFERENCES ref.currencies(code),
  agreement_signed_at  timestamptz,                       -- contrat Premium
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publishers_logo_idx     ON market.publishers (logo_file_id);
CREATE INDEX publishers_payout_idx   ON market.publishers (payout_method_id);
CREATE INDEX publishers_currency_idx ON market.publishers (payout_currency);

CREATE TABLE market.categories (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        text        NOT NULL UNIQUE,
  name       jsonb       NOT NULL CHECK (util.is_i18n(name)),
  parent_id  bigint      REFERENCES market.categories(id),
  sort_order smallint    NOT NULL DEFAULT 0
);
CREATE INDEX categories_parent_idx ON market.categories (parent_id);

CREATE TABLE market.listings (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id            uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  publisher_id         bigint      NOT NULL REFERENCES market.publishers(id),
  organization_id      bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE, -- org de l'éditeur
  type                 text        NOT NULL CHECK (type IN ('mcp_server','agent_template','prompt_template','capability','bundle')),
  delivery_mode        text        NOT NULL DEFAULT 'sealed' CHECK (delivery_mode IN ('sealed','copy')), -- scellée (prompt caché) ou copie modifiable
  slug                 citext      NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,98}[a-z0-9])?$'),
  name                 jsonb       NOT NULL CHECK (util.is_i18n(name)),
  summary              jsonb       NOT NULL CHECK (util.is_i18n(summary)),
  description          jsonb,
  category_id          bigint      REFERENCES market.categories(id),
  tags                 text[]      NOT NULL DEFAULT '{}',
  trust_level          text        NOT NULL DEFAULT 'community' CHECK (trust_level IN ('community','verified','official','premium')),
  status               text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','published','suspended','removed')),
  pricing_model        text        NOT NULL DEFAULT 'free' CHECK (pricing_model IN ('free','one_time','monthly','usage_based','freemium')),
  current_version_id   bigint,                            -- FK après listing_versions
  requirements         jsonb       NOT NULL DEFAULT '{}', -- systèmes, connecteurs, plan minimum, langues
  declared_permissions jsonb       NOT NULL DEFAULT '{}', -- lecture / écriture / suppression / financier
  source_code_url      text,                               -- obligatoire en Community
  icon_file_id         bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  install_count        integer     NOT NULL DEFAULT 0,
  rating_avg           numeric(3,2),
  rating_count         integer     NOT NULL DEFAULT 0,
  published_at         timestamptz,
  search_tsv           tsvector GENERATED ALWAYS AS (
                         setweight(to_tsvector('simple', coalesce(name->>'fr','') || ' ' || coalesce(name->>'en','')), 'A') ||
                         setweight(to_tsvector('simple', coalesce(summary->>'fr','') || ' ' || coalesce(summary->>'en','')), 'B')
                       ) STORED,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (trust_level <> 'community' OR source_code_url IS NOT NULL OR status = 'draft'),
  CHECK (pricing_model = 'free' OR trust_level IN ('premium','official'))
);
CREATE INDEX listings_publisher_idx  ON market.listings (publisher_id);
CREATE INDEX listings_org_idx        ON market.listings (organization_id);
CREATE INDEX listings_category_idx   ON market.listings (category_id);
CREATE INDEX listings_version_idx    ON market.listings (current_version_id);
CREATE INDEX listings_icon_idx       ON market.listings (icon_file_id);
CREATE INDEX listings_browse_idx     ON market.listings (type, trust_level, install_count DESC) WHERE status = 'published';
CREATE INDEX listings_search_gin     ON market.listings USING gin (search_tsv);
CREATE INDEX listings_tags_gin       ON market.listings USING gin (tags);
CREATE INDEX listings_review_idx     ON market.listings (updated_at) WHERE status = 'in_review';

CREATE TABLE market.listing_versions (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  listing_id          bigint      NOT NULL REFERENCES market.listings(id) ON DELETE CASCADE,
  semver              text        NOT NULL CHECK (semver ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  package             jsonb       NOT NULL,     -- configuration sans identifiants ni données du créateur
  changelog           text,
  scan_status         text        NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','passed','failed')),
  scan_report         jsonb       NOT NULL DEFAULT '{}',
  review_status       text        NOT NULL DEFAULT 'not_required' CHECK (review_status IN
                      ('not_required','pending','approved','changes_requested','rejected')),
  reviewed_by_staff_id bigint,                  -- FK dans 090_platform
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  UNIQUE (listing_id, semver)
);
CREATE INDEX listing_versions_listing_idx ON market.listing_versions (listing_id, submitted_at DESC);
CREATE INDEX listing_versions_staff_idx   ON market.listing_versions (reviewed_by_staff_id);
CREATE INDEX listing_versions_queue_idx   ON market.listing_versions (submitted_at) WHERE review_status = 'pending';

ALTER TABLE market.listings ADD CONSTRAINT listings_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES market.listing_versions(id) ON DELETE SET NULL;

CREATE TABLE market.bundle_items (
  bundle_listing_id bigint   NOT NULL REFERENCES market.listings(id) ON DELETE CASCADE,
  item_listing_id   bigint   NOT NULL REFERENCES market.listings(id),
  position          smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_listing_id, item_listing_id),
  CHECK (bundle_listing_id <> item_listing_id)
);
CREATE INDEX bundle_items_item_idx ON market.bundle_items (item_listing_id);

CREATE TABLE market.listing_prices (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id       bigint       NOT NULL REFERENCES market.listings(id) ON DELETE CASCADE,
  currency         char(3)      NOT NULL REFERENCES ref.currencies(code),
  amount_minor     bigint       CHECK (amount_minor >= 0),          -- one_time / monthly
  usage_pct        numeric(5,4) CHECK (usage_pct > 0 AND usage_pct < 1), -- usage_based : % des crédits consommés
  effective_during tstzrange    NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CHECK (amount_minor IS NOT NULL OR usage_pct IS NOT NULL),
  EXCLUDE USING gist (listing_id WITH =, currency WITH =, effective_during WITH &&)
);
CREATE INDEX listing_prices_currency_idx ON market.listing_prices (currency);

-- Droit d'utiliser une fiche payante
CREATE TABLE market.entitlements (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  listing_id       bigint      NOT NULL REFERENCES market.listings(id),
  kind             text        NOT NULL CHECK (kind IN ('free','one_time','subscription','usage')),
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','expired','refunded')),
  invoice_line_id  bigint      REFERENCES billing.invoice_lines(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ends_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX entitlements_active_uq ON market.entitlements (organization_id, listing_id) WHERE status = 'active';
CREATE INDEX entitlements_listing_idx ON market.entitlements (listing_id);
CREATE INDEX entitlements_line_idx    ON market.entitlements (invoice_line_id);

-- Installation dans un workspace : crée une COPIE indépendante (pas de mise à jour auto)
CREATE TABLE market.installations (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id              uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id        bigint      NOT NULL,
  workspace_id           bigint      NOT NULL,
  listing_id             bigint      NOT NULL REFERENCES market.listings(id),
  listing_version_id     bigint      NOT NULL REFERENCES market.listing_versions(id),
  entitlement_id         bigint      REFERENCES market.entitlements(id) ON DELETE SET NULL,
  update_policy          text        NOT NULL DEFAULT 'notify' CHECK (update_policy IN ('manual','notify')),
  status                 text        NOT NULL DEFAULT 'active' CHECK (status IN ('installing','active','needs_config','uninstalled','failed')),
  installed_resources    jsonb       NOT NULL DEFAULT '[]',   -- [{type: mcp_server|agent|capability|connector, id}]
  installed_by_user_id   bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  uninstalled_at         timestamptz,
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX installations_ws_idx       ON market.installations (workspace_id, organization_id);
CREATE INDEX installations_listing_idx  ON market.installations (listing_id);
CREATE INDEX installations_version_idx  ON market.installations (listing_version_id);
CREATE INDEX installations_ent_idx      ON market.installations (entitlement_id);
CREATE INDEX installations_user_idx     ON market.installations (installed_by_user_id);

CREATE TABLE market.reviews (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  listing_id      bigint      NOT NULL REFERENCES market.listings(id) ON DELETE CASCADE,
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id         bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  rating          smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         text,
  status          text        NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','removed')),
  publisher_reply text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, organization_id)
);
CREATE INDEX reviews_listing_idx ON market.reviews (listing_id, created_at DESC) WHERE status = 'published';
CREATE INDEX reviews_org_idx     ON market.reviews (organization_id);
CREATE INDEX reviews_user_idx    ON market.reviews (user_id);

-- Revenus des créateurs (70 % créateur / 30 % plateforme)
CREATE TABLE market.payouts (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  publisher_id     bigint      NOT NULL REFERENCES market.publishers(id),
  currency         char(3)     NOT NULL REFERENCES ref.currencies(code),
  amount_minor     bigint      NOT NULL CHECK (amount_minor > 0),
  period_start     date        NOT NULL,
  period_end       date        NOT NULL,
  payment_method_id bigint     REFERENCES billing.payment_methods(id) ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  external_ref     text,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payouts_publisher_idx ON market.payouts (publisher_id, created_at DESC);
CREATE INDEX payouts_currency_idx  ON market.payouts (currency);
CREATE INDEX payouts_method_idx    ON market.payouts (payment_method_id);

CREATE TABLE market.earnings (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  publisher_id       bigint       NOT NULL REFERENCES market.publishers(id),
  listing_id         bigint       NOT NULL REFERENCES market.listings(id),
  buyer_org_id       bigint       REFERENCES iam.organizations(id) ON DELETE SET NULL,
  invoice_line_id    bigint       REFERENCES billing.invoice_lines(id) ON DELETE SET NULL,
  currency           char(3)      NOT NULL REFERENCES ref.currencies(code),
  gross_minor        bigint       NOT NULL,
  platform_fee_minor bigint       NOT NULL,
  net_minor          bigint       NOT NULL,
  revenue_share      numeric(4,3) NOT NULL DEFAULT 0.700,
  status             text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid','reversed')),
  available_at       timestamptz,
  payout_id          bigint       REFERENCES market.payouts(id) ON DELETE SET NULL,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  CHECK (net_minor = gross_minor - platform_fee_minor)
);
CREATE INDEX earnings_publisher_idx ON market.earnings (publisher_id, status);
CREATE INDEX earnings_listing_idx   ON market.earnings (listing_id);
CREATE INDEX earnings_buyer_idx     ON market.earnings (buyer_org_id);
CREATE INDEX earnings_line_idx      ON market.earnings (invoice_line_id);
CREATE INDEX earnings_currency_idx  ON market.earnings (currency);
CREATE INDEX earnings_payout_idx    ON market.earnings (payout_id);

-- Liens "installé depuis la marketplace" déclarés dans les domaines précédents
ALTER TABLE ai.capabilities ADD CONSTRAINT capabilities_listing_fk
  FOREIGN KEY (source_listing_id) REFERENCES market.listings(id) ON DELETE SET NULL;
ALTER TABLE mcp.connectors ADD CONSTRAINT connectors_listing_fk
  FOREIGN KEY (source_listing_id) REFERENCES market.listings(id) ON DELETE SET NULL;
ALTER TABLE mcp.servers ADD CONSTRAINT servers_listing_fk
  FOREIGN KEY (source_listing_id) REFERENCES market.listings(id) ON DELETE SET NULL;
ALTER TABLE agent.agents ADD CONSTRAINT agents_listing_fk
  FOREIGN KEY (source_listing_id) REFERENCES market.listings(id) ON DELETE SET NULL;
