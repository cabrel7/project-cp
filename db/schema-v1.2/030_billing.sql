-- =============================================================================
-- 030_billing.sql — Plans, droits (features), abonnements, crédits (wallet +
-- grand livre), recharges, compteurs infra, paiements, factures, budgets, promos
-- 1 crédit = 1 FCFA de valeur de consommation (prépaiement de services,
-- ni monnaie ni transférable entre organisations). Stocké en micro-crédits.
-- =============================================================================

-- --------------------------------------------------------------------- plans
CREATE TABLE billing.plans (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key               text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'), -- free, starter, starter_byok, pro, pro_byok, business, business_byok, enterprise
  name              jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description       jsonb,
  tier              smallint    NOT NULL,           -- ordre de montée en gamme (0=free)
  is_byok_variant   boolean     NOT NULL DEFAULT false,
  base_plan_id      bigint      REFERENCES billing.plans(id),  -- variante BYOK -> plan standard
  is_public         boolean     NOT NULL DEFAULT true,          -- affiché sur la page tarifs
  is_active         boolean     NOT NULL DEFAULT true,
  is_custom         boolean     NOT NULL DEFAULT false,         -- Enterprise négocié
  sort_order        smallint    NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_byok_variant OR base_plan_id IS NOT NULL)
);
CREATE INDEX plans_base_plan_idx ON billing.plans (base_plan_id);

-- Prix par devise et par période, versionnés dans le temps
CREATE TABLE billing.plan_prices (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id                   uuid         NOT NULL DEFAULT uuidv7() UNIQUE,
  plan_id                     bigint       NOT NULL REFERENCES billing.plans(id),
  currency                    char(3)      NOT NULL REFERENCES ref.currencies(code),
  billing_interval            text         NOT NULL CHECK (billing_interval IN ('month','year')),
  amount_minor                bigint       NOT NULL CHECK (amount_minor >= 0),
  tax_inclusive               boolean      NOT NULL DEFAULT false,
  included_llm_credits_micro  bigint       NOT NULL DEFAULT 0 CHECK (included_llm_credits_micro >= 0),
  included_infra_credits_micro bigint      NOT NULL DEFAULT 0 CHECK (included_infra_credits_micro >= 0),
  llm_coefficient             numeric(6,4) NOT NULL CHECK (llm_coefficient >= 1),  -- ex 1.3000
  effective_during            tstzrange    NOT NULL,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  EXCLUDE USING gist (plan_id WITH =, currency WITH =, billing_interval WITH =, effective_during WITH &&)
);
CREATE INDEX plan_prices_currency_idx ON billing.plan_prices (currency);

-- Catalogue des droits / limites (entitlements) : un seul endroit pour la grille des plans
CREATE TABLE billing.features (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'), -- mcp.servers.max
  category    text        NOT NULL,          -- workspace, mcp, agents, ai, developer, control, marketplace, support
  value_type  text        NOT NULL CHECK (value_type IN ('boolean','integer','string','string_list')),
  unit        text,                          -- count, days, per_minute...
  name        jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description jsonb,
  sort_order  smallint    NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Valeur d'un droit pour un plan. Convention : integer -1 = illimité
CREATE TABLE billing.plan_features (
  plan_id    bigint NOT NULL REFERENCES billing.plans(id) ON DELETE CASCADE,
  feature_id bigint NOT NULL REFERENCES billing.features(id) ON DELETE CASCADE,
  value      jsonb  NOT NULL,
  PRIMARY KEY (plan_id, feature_id)
);
CREATE INDEX plan_features_feature_idx ON billing.plan_features (feature_id);

-- Surcharges négociées ou temporaires par organisation (Enterprise, gestes commerciaux)
CREATE TABLE billing.organization_feature_overrides (
  organization_id     bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  feature_id          bigint      NOT NULL REFERENCES billing.features(id) ON DELETE CASCADE,
  value               jsonb       NOT NULL,
  reason              text,
  expires_at          timestamptz,
  granted_by_staff_id bigint,                  -- FK ajoutée dans 090_platform
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, feature_id)
);
CREATE INDEX org_feature_overrides_feature_idx ON billing.organization_feature_overrides (feature_id);
CREATE INDEX org_feature_overrides_staff_idx   ON billing.organization_feature_overrides (granted_by_staff_id);

-- ------------------------------------------------------------- abonnements
CREATE TABLE billing.subscriptions (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id              uuid         NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id        bigint       NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  plan_id                bigint       NOT NULL REFERENCES billing.plans(id),
  plan_price_id          bigint       REFERENCES billing.plan_prices(id),   -- NULL pour Free
  status                 text         NOT NULL CHECK (status IN
                         ('trialing','active','past_due','grace','cancelled','expired')),
  currency               char(3)      NOT NULL REFERENCES ref.currencies(code),
  llm_coefficient_override numeric(6,4) CHECK (llm_coefficient_override >= 1), -- Enterprise
  current_period_start   timestamptz  NOT NULL,
  current_period_end     timestamptz  NOT NULL,
  trial_ends_at          timestamptz,
  grace_ends_at          timestamptz,
  cancel_at_period_end   boolean      NOT NULL DEFAULT false,
  cancelled_at           timestamptz,
  ended_at               timestamptz,
  default_payment_method_id bigint,                   -- FK ajoutée plus bas
  auto_renew             boolean      NOT NULL DEFAULT true,
  metadata               jsonb        NOT NULL DEFAULT '{}',
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  CHECK (current_period_end > current_period_start)
);
-- Règle : une seule souscription "vivante" par organisation
CREATE UNIQUE INDEX subscriptions_one_live_uq ON billing.subscriptions (organization_id)
  WHERE status IN ('trialing','active','past_due','grace');
CREATE INDEX subscriptions_org_idx         ON billing.subscriptions (organization_id, created_at DESC);
CREATE INDEX subscriptions_plan_idx        ON billing.subscriptions (plan_id);
CREATE INDEX subscriptions_price_idx       ON billing.subscriptions (plan_price_id);
CREATE INDEX subscriptions_currency_idx    ON billing.subscriptions (currency);
CREATE INDEX subscriptions_renewal_idx     ON billing.subscriptions (current_period_end)
  WHERE status IN ('active','past_due','grace');                   -- job de renouvellement
CREATE INDEX subscriptions_pm_idx          ON billing.subscriptions (default_payment_method_id);

-- Historique des changements (upgrade, downgrade, renouvellement, annulation)
CREATE TABLE billing.subscription_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id   bigint      NOT NULL REFERENCES billing.subscriptions(id) ON DELETE CASCADE,
  organization_id   bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  event_type        text        NOT NULL CHECK (event_type IN
                    ('created','upgraded','downgraded','renewed','payment_failed','grace_started',
                     'cancelled','reactivated','expired','plan_price_changed')),
  from_plan_id      bigint      REFERENCES billing.plans(id),
  to_plan_id        bigint      REFERENCES billing.plans(id),
  proration_minor   bigint,
  effective_at      timestamptz NOT NULL DEFAULT now(),
  actor             jsonb,                     -- {type: user|staff|system, id}
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_events_sub_idx  ON billing.subscription_events (subscription_id, effective_at DESC);
CREATE INDEX subscription_events_org_idx  ON billing.subscription_events (organization_id);
CREATE INDEX subscription_events_from_idx ON billing.subscription_events (from_plan_id);
CREATE INDEX subscription_events_to_idx   ON billing.subscription_events (to_plan_id);

-- --------------------------------------------------------------- crédits
-- Portefeuilles : un par (organisation, [workspace], nature). workspace NULL = portefeuille org.
-- kind : llm (tokens / modalités), infra (MCP, agents, stockage), test (sandbox)
CREATE TABLE billing.credit_wallets (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id              uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id        bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  workspace_id           bigint,
  kind                   text        NOT NULL CHECK (kind IN ('llm','infra','test')),
  balance_micro          bigint      NOT NULL DEFAULT 0,
  reserved_micro         bigint      NOT NULL DEFAULT 0 CHECK (reserved_micro >= 0),
  overdraft_limit_micro  bigint      NOT NULL DEFAULT 0 CHECK (overdraft_limit_micro >= 0),
  low_balance_threshold_micro bigint,
  lock_version           integer     NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  -- Règle : jamais négatif, sauf découvert technique pour laisser finir un run en cours
  CHECK (balance_micro >= -overdraft_limit_micro),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX credit_wallets_owner_uq ON billing.credit_wallets (organization_id, workspace_id, kind) NULLS NOT DISTINCT;
CREATE INDEX credit_wallets_ws_org_idx      ON billing.credit_wallets (workspace_id, organization_id) WHERE workspace_id IS NOT NULL;

-- Lots de crédits (origine + expiration) : consommés en FIFO par date d'expiration
CREATE TABLE billing.credit_grants (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id   bigint      NOT NULL,
  wallet_id         bigint      NOT NULL,
  source            text        NOT NULL CHECK (source IN
                    ('plan_included','purchase','bonus','referral','promo','refund','goodwill','migration')),
  amount_micro      bigint      NOT NULL CHECK (amount_micro > 0),
  remaining_micro   bigint      NOT NULL CHECK (remaining_micro >= 0),
  expires_at        timestamptz,              -- NULL = n'expire pas (achats)
  source_ref_type   text,                     -- payment, subscription, coupon_redemption, referral...
  source_ref_id     bigint,
  period_start      timestamptz,              -- pour plan_included (perdu au downgrade)
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_micro <= amount_micro),
  UNIQUE (id, organization_id),
  FOREIGN KEY (wallet_id, organization_id) REFERENCES billing.credit_wallets(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX credit_grants_consumable_idx ON billing.credit_grants (wallet_id, expires_at NULLS LAST, id)
  WHERE remaining_micro > 0;                                     -- ordre de consommation FIFO
CREATE INDEX credit_grants_wallet_org_idx ON billing.credit_grants (wallet_id, organization_id);
CREATE INDEX credit_grants_expiry_idx     ON billing.credit_grants (expires_at) WHERE remaining_micro > 0 AND expires_at IS NOT NULL;
CREATE INDEX credit_grants_source_ref_idx ON billing.credit_grants (source_ref_type, source_ref_id);

-- Grand livre des crédits : AJOUT SEUL. Une ligne par mouvement et par lot touché.
-- balance_after_micro = solde du wallet après l'écriture (contrôle d'intégrité).
CREATE TABLE billing.credit_ledger (
  id                  bigint GENERATED ALWAYS AS IDENTITY,
  public_id           uuid        NOT NULL DEFAULT uuidv7(),
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  organization_id     bigint      NOT NULL,
  wallet_id           bigint      NOT NULL,
  grant_id            bigint,
  entry_type          text        NOT NULL CHECK (entry_type IN
                      ('grant','purchase','debit_usage','refund','expiry','forfeit_downgrade',
                       'adjustment','allocation_in','allocation_out','reversal')),
  amount_micro        bigint      NOT NULL CHECK (amount_micro <> 0),   -- signé : + crédit, - débit
  balance_after_micro bigint      NOT NULL,
  -- ventilation pour la traçabilité org -> workspace -> env -> projet -> run
  workspace_id        bigint,
  environment_id      bigint,
  project_id          bigint,
  run_id              bigint,
  run_created_at      timestamptz,
  reference_type      text,               -- payment, invoice, run, coupon, staff_adjustment...
  reference_id        bigint,
  description         jsonb,
  actor               jsonb,              -- {type: system|user|staff, id}
  PRIMARY KEY (id, occurred_at),
  UNIQUE (public_id, occurred_at),
  FOREIGN KEY (wallet_id, organization_id) REFERENCES billing.credit_wallets(id, organization_id)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX credit_ledger_wallet_idx ON billing.credit_ledger (wallet_id, organization_id, occurred_at DESC);
CREATE INDEX credit_ledger_org_idx    ON billing.credit_ledger (organization_id, occurred_at DESC);
CREATE INDEX credit_ledger_grant_idx  ON billing.credit_ledger (grant_id) WHERE grant_id IS NOT NULL;
CREATE INDEX credit_ledger_run_idx    ON billing.credit_ledger (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX credit_ledger_ref_idx    ON billing.credit_ledger (reference_type, reference_id);
CREATE INDEX credit_ledger_breakdown_idx ON billing.credit_ledger (organization_id, workspace_id, environment_id, occurred_at)
  WHERE entry_type = 'debit_usage';

-- Réservations : un run réserve un montant au démarrage, régularisé à la fin
CREATE TABLE billing.credit_reservations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint      NOT NULL,
  wallet_id       bigint      NOT NULL,
  run_id          bigint      NOT NULL,
  run_created_at  timestamptz NOT NULL,
  amount_micro    bigint      NOT NULL CHECK (amount_micro > 0),
  status          text        NOT NULL DEFAULT 'held' CHECK (status IN ('held','settled','released','expired')),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  settled_at      timestamptz,
  FOREIGN KEY (wallet_id, organization_id) REFERENCES billing.credit_wallets(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX credit_reservations_run_uq ON billing.credit_reservations (run_id, wallet_id);
CREATE INDEX credit_reservations_held_idx      ON billing.credit_reservations (wallet_id, organization_id) WHERE status = 'held';
CREATE INDEX credit_reservations_expiry_idx    ON billing.credit_reservations (expires_at) WHERE status = 'held';

-- Packs de recharge (remise dégressive plafonnée à -15 %)
CREATE TABLE billing.credit_packs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id     uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key           text        NOT NULL UNIQUE,
  kind          text        NOT NULL DEFAULT 'llm' CHECK (kind IN ('llm','infra')),
  credits_micro bigint      NOT NULL CHECK (credits_micro > 0),
  name          jsonb       NOT NULL CHECK (util.is_i18n(name)),
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    smallint    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing.credit_pack_prices (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pack_id          bigint      NOT NULL REFERENCES billing.credit_packs(id) ON DELETE CASCADE,
  currency         char(3)     NOT NULL REFERENCES ref.currencies(code),
  amount_minor     bigint      NOT NULL CHECK (amount_minor > 0),
  effective_during tstzrange   NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (pack_id WITH =, currency WITH =, effective_during WITH &&)
);
CREATE INDEX credit_pack_prices_currency_idx ON billing.credit_pack_prices (currency);

-- Compteurs d'infrastructure (hors LLM) : appel d'outil MCP, run d'agent, stockage...
CREATE TABLE billing.infra_meters (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'), -- mcp_tool_call, agent_run, agent_step_extra, trigger_fire, gateway_byok_request, memory_gb_month, storage_gb_month, bridge_month
  unit        text        NOT NULL,          -- call, run, step, gb_month, month
  name        jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tarif d'un compteur ; plan_id NULL = tarif par défaut
CREATE TABLE billing.infra_meter_rates (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meter_id            bigint      NOT NULL REFERENCES billing.infra_meters(id) ON DELETE CASCADE,
  plan_id             bigint      REFERENCES billing.plans(id) ON DELETE CASCADE,
  credits_micro_per_unit bigint   NOT NULL CHECK (credits_micro_per_unit >= 0),
  included_units_per_period bigint NOT NULL DEFAULT 0,
  effective_during    tstzrange   NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (meter_id WITH =, (coalesce(plan_id, 0)) WITH =, effective_during WITH &&)
);
CREATE INDEX infra_meter_rates_plan_idx ON billing.infra_meter_rates (plan_id);

-- --------------------------------------------------------------- paiements
-- Agrégateurs (CinetPay, etc.) — plusieurs pour la couverture. Identifiants dans le coffre.
CREATE TABLE billing.payment_providers (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key               text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  kind              text        NOT NULL CHECK (kind IN ('aggregator','card','bank_transfer','manual')),
  supported_countries char(2)[] NOT NULL DEFAULT '{}',
  supported_currencies char(3)[] NOT NULL DEFAULT '{}',
  supported_methods text[]      NOT NULL DEFAULT '{}',   -- mtn_momo, orange_money, wave, card...
  fee_config        jsonb       NOT NULL DEFAULT '{}',   -- {"percent":0.03,"fixed_minor":0}
  secret_ref        text,                                -- coffre
  priority          smallint    NOT NULL DEFAULT 100,    -- routage : plus petit = prioritaire
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_providers_countries_gin ON billing.payment_providers USING gin (supported_countries);

CREATE TABLE billing.payment_methods (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  provider_id      bigint      NOT NULL REFERENCES billing.payment_providers(id),
  kind             text        NOT NULL CHECK (kind IN ('mobile_money','card','bank_transfer')),
  operator         text,                      -- mtn, orange, wave, moov, airtel, visa...
  display_label    text        NOT NULL,      -- "MTN •••• 4521"
  phone_e164       text,
  country_code     char(2)     REFERENCES ref.countries(code),
  external_ref     text,                      -- jeton côté agrégateur
  is_default       boolean     NOT NULL DEFAULT false,
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','removed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_methods_default_uq ON billing.payment_methods (organization_id) WHERE is_default AND status = 'active';
CREATE INDEX payment_methods_org_idx      ON billing.payment_methods (organization_id);
CREATE INDEX payment_methods_provider_idx ON billing.payment_methods (provider_id);
CREATE INDEX payment_methods_country_idx  ON billing.payment_methods (country_code);

ALTER TABLE billing.subscriptions
  ADD CONSTRAINT subscriptions_default_pm_fk FOREIGN KEY (default_payment_method_id)
  REFERENCES billing.payment_methods(id) ON DELETE SET NULL;

-- Numérotation légale des factures sans trou : une ligne par série/année
CREATE TABLE billing.invoice_sequences (
  series      text     NOT NULL,           -- ex: 'INV' ; 'CN' (avoirs)
  year        smallint NOT NULL,
  last_number integer  NOT NULL DEFAULT 0,
  PRIMARY KEY (series, year)
);

CREATE TABLE billing.invoices (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  number            text        UNIQUE,                 -- attribué à l'émission (INV-2026-000123)
  organization_id   bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE RESTRICT,
  subscription_id   bigint      REFERENCES billing.subscriptions(id) ON DELETE SET NULL,
  kind              text        NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','credit_note')),
  corrects_invoice_id bigint    REFERENCES billing.invoices(id),
  status            text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','open','paid','void','uncollectible')),
  currency          char(3)     NOT NULL REFERENCES ref.currencies(code),
  subtotal_minor    bigint      NOT NULL DEFAULT 0,
  discount_minor    bigint      NOT NULL DEFAULT 0,
  tax_minor         bigint      NOT NULL DEFAULT 0,
  total_minor       bigint      NOT NULL DEFAULT 0,
  amount_paid_minor bigint      NOT NULL DEFAULT 0,
  billing_snapshot  jsonb       NOT NULL DEFAULT '{}',  -- raison sociale, adresse, NIU figés
  pdf_file_id       bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  voided_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor)
);
CREATE INDEX invoices_org_idx        ON billing.invoices (organization_id, created_at DESC);
CREATE INDEX invoices_sub_idx        ON billing.invoices (subscription_id);
CREATE INDEX invoices_corrects_idx   ON billing.invoices (corrects_invoice_id);
CREATE INDEX invoices_currency_idx   ON billing.invoices (currency);
CREATE INDEX invoices_pdf_idx        ON billing.invoices (pdf_file_id);
CREATE INDEX invoices_open_due_idx   ON billing.invoices (due_at) WHERE status = 'open';

CREATE TABLE billing.invoice_lines (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id       bigint        NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
  organization_id  bigint        NOT NULL,
  line_type        text          NOT NULL CHECK (line_type IN
                   ('subscription','credit_pack','overage','marketplace','adjustment','discount')),
  description      jsonb         NOT NULL CHECK (util.is_i18n(description)),
  quantity         numeric(18,6) NOT NULL DEFAULT 1,
  unit_amount_minor bigint       NOT NULL,
  amount_minor     bigint        NOT NULL,
  tax_rate_id      bigint        REFERENCES ref.tax_rates(id),
  tax_minor        bigint        NOT NULL DEFAULT 0,
  reference_type   text,         -- plan_price, credit_pack, listing, ...
  reference_id     bigint,
  period_start     timestamptz,
  period_end       timestamptz,
  position         smallint      NOT NULL DEFAULT 0
);
CREATE INDEX invoice_lines_invoice_idx ON billing.invoice_lines (invoice_id, position);
CREATE INDEX invoice_lines_tax_idx     ON billing.invoice_lines (tax_rate_id);
CREATE INDEX invoice_lines_ref_idx     ON billing.invoice_lines (reference_type, reference_id);

CREATE TABLE billing.payments (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id       bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE RESTRICT,
  invoice_id            bigint      REFERENCES billing.invoices(id) ON DELETE SET NULL,
  provider_id           bigint      NOT NULL REFERENCES billing.payment_providers(id),
  payment_method_id     bigint      REFERENCES billing.payment_methods(id) ON DELETE SET NULL,
  purpose               text        NOT NULL CHECK (purpose IN ('subscription','credit_pack','marketplace','invoice','other')),
  status                text        NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending','processing','succeeded','failed','cancelled','expired','refunded','partially_refunded')),
  currency              char(3)     NOT NULL REFERENCES ref.currencies(code),
  amount_minor          bigint      NOT NULL CHECK (amount_minor > 0),
  fee_minor             bigint      NOT NULL DEFAULT 0,       -- frais agrégateur
  net_minor             bigint,
  idempotency_key       text        NOT NULL UNIQUE,
  external_transaction_id text,
  external_status       text,
  failure_code          text,
  failure_message       text,
  initiated_by_user_id  bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  initiated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  settled_at            timestamptz,                         -- fonds reçus de l'agrégateur
  metadata              jsonb       NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_external_uq ON billing.payments (provider_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
CREATE INDEX payments_org_idx         ON billing.payments (organization_id, created_at DESC);
CREATE INDEX payments_invoice_idx     ON billing.payments (invoice_id);
CREATE INDEX payments_method_idx      ON billing.payments (payment_method_id);
CREATE INDEX payments_currency_idx    ON billing.payments (currency);
CREATE INDEX payments_initiator_idx   ON billing.payments (initiated_by_user_id);
CREATE INDEX payments_pending_idx     ON billing.payments (provider_id, initiated_at) WHERE status IN ('pending','processing'); -- réconciliation
CREATE INDEX payments_unsettled_idx   ON billing.payments (provider_id, completed_at) WHERE status = 'succeeded' AND settled_at IS NULL; -- trésorerie

-- Webhooks entrants des agrégateurs (journal brut, dédupliqué)
CREATE TABLE billing.payment_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id       bigint      NOT NULL REFERENCES billing.payment_providers(id),
  payment_id        bigint      REFERENCES billing.payments(id) ON DELETE SET NULL,
  external_event_id text        NOT NULL,
  event_type        text        NOT NULL,
  payload           jsonb       NOT NULL,
  signature_valid   boolean     NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  processing_error  text,
  UNIQUE (provider_id, external_event_id)
);
CREATE INDEX payment_events_payment_idx     ON billing.payment_events (payment_id);
CREATE INDEX payment_events_unprocessed_idx ON billing.payment_events (received_at) WHERE processed_at IS NULL;

CREATE TABLE billing.refunds (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id        uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  payment_id       bigint      NOT NULL REFERENCES billing.payments(id),
  organization_id  bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE RESTRICT,
  amount_minor     bigint      NOT NULL CHECK (amount_minor > 0),
  reason           text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  external_ref     text,
  requested_by     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX refunds_payment_idx ON billing.refunds (payment_id);
CREATE INDEX refunds_org_idx     ON billing.refunds (organization_id);

-- ----------------------------------------------------------------- budgets
-- Portée polymorphe : organization | workspace | environment | project | team | agent | api_key | end_user
CREATE TABLE billing.budgets (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  scope_type         text        NOT NULL CHECK (scope_type IN
                     ('organization','workspace','environment','project','team','agent','api_key','end_user')),
  scope_id           bigint      NOT NULL,
  credit_kind        text        NOT NULL DEFAULT 'all' CHECK (credit_kind IN ('llm','infra','all')),
  period             text        NOT NULL DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly','custom')),
  custom_start       timestamptz,
  custom_end         timestamptz,
  amount_micro       bigint      NOT NULL CHECK (amount_micro > 0),
  alert_thresholds   smallint[]  NOT NULL DEFAULT '{70,90}',
  action_on_exceed   text        NOT NULL DEFAULT 'block_new_runs'
                     CHECK (action_on_exceed IN ('alert_only','block_new_runs','block_all')),
  is_enabled         boolean     NOT NULL DEFAULT true,
  lock_version       integer     NOT NULL DEFAULT 0,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (period <> 'custom' OR (custom_start IS NOT NULL AND custom_end > custom_start))
);
CREATE INDEX budgets_scope_idx      ON billing.budgets (organization_id, scope_type, scope_id) WHERE is_enabled;
CREATE INDEX budgets_created_by_idx ON billing.budgets (created_by_user_id);

-- Consommation par période (alimentée depuis Redis par le worker)
CREATE TABLE billing.budget_periods (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_id       bigint      NOT NULL REFERENCES billing.budgets(id) ON DELETE CASCADE,
  organization_id bigint      NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  consumed_micro  bigint      NOT NULL DEFAULT 0,
  alerts_sent     smallint[]  NOT NULL DEFAULT '{}',
  exceeded_at     timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, period_start)
);
CREATE INDEX budget_periods_org_idx ON billing.budget_periods (organization_id, period_start DESC);

-- --------------------------------------------------- promotions & parrainage
CREATE TABLE billing.coupons (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id         uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  code              citext      NOT NULL UNIQUE,
  kind              text        NOT NULL CHECK (kind IN ('credits','percent_off','amount_off')),
  value             numeric(18,4) NOT NULL CHECK (value > 0),
  currency          char(3)     REFERENCES ref.currencies(code),  -- pour amount_off
  credits_expire_days integer,                                    -- pour kind=credits
  applicable_plan_ids bigint[],
  max_redemptions   integer,
  max_per_org       integer     NOT NULL DEFAULT 1,
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_until       timestamptz,
  is_active         boolean     NOT NULL DEFAULT true,
  created_by_staff_id bigint,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupons_currency_idx ON billing.coupons (currency);
CREATE INDEX coupons_staff_idx    ON billing.coupons (created_by_staff_id);

CREATE TABLE billing.coupon_redemptions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coupon_id       bigint      NOT NULL REFERENCES billing.coupons(id),
  organization_id bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  user_id         bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  invoice_id      bigint      REFERENCES billing.invoices(id) ON DELETE SET NULL,
  credit_grant_id bigint      REFERENCES billing.credit_grants(id) ON DELETE SET NULL,
  redeemed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupon_redemptions_coupon_idx  ON billing.coupon_redemptions (coupon_id);
CREATE INDEX coupon_redemptions_org_idx     ON billing.coupon_redemptions (organization_id, coupon_id);
CREATE INDEX coupon_redemptions_user_idx    ON billing.coupon_redemptions (user_id);
CREATE INDEX coupon_redemptions_invoice_idx ON billing.coupon_redemptions (invoice_id);
CREATE INDEX coupon_redemptions_grant_idx   ON billing.coupon_redemptions (credit_grant_id);

CREATE TABLE billing.referrals (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_org_id      bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  referrer_user_id     bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  referred_org_id      bigint      UNIQUE REFERENCES iam.organizations(id) ON DELETE CASCADE,
  code                 citext      NOT NULL,
  status               text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','qualified','rewarded','rejected')),
  qualified_at         timestamptz,
  reward_grant_id      bigint      REFERENCES billing.credit_grants(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_referrer_idx      ON billing.referrals (referrer_org_id);
CREATE INDEX referrals_referrer_user_idx ON billing.referrals (referrer_user_id);
CREATE INDEX referrals_code_idx          ON billing.referrals (code);
CREATE INDEX referrals_grant_idx         ON billing.referrals (reward_grant_id);
