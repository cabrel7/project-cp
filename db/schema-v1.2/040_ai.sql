-- =============================================================================
-- 040_ai.sql — Fournisseurs, comptes, modèles, déploiements, prix dynamiques,
-- profils de routage (Flash/Smart/Max), BYOK, capacités ai.run (Prompt Studio),
-- évaluations.
-- Principe : un MODÈLE canonique (ex. claude-sonnet) peut être servi par
-- plusieurs DÉPLOIEMENTS (Anthropic direct, Bedrock, Vertex...) avec des prix
-- différents. Jamais de prix dans le code.
-- =============================================================================

-- ------------------------------------------------------------ fournisseurs
CREATE TABLE ai.providers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id   uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key         text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_-]+$'), -- anthropic, openai, google, bedrock, azure_openai, vertex, groq, mistral, together, self_hosted
  name        text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('direct','cloud','inference_host','self_hosted')),
  website     text,
  terms_notes text,                         -- rappels contractuels (revente, limites...)
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Nos comptes chez les fournisseurs (paliers, limites, solde prépayé)
CREATE TABLE ai.provider_accounts (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id               uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  provider_id             bigint      NOT NULL REFERENCES ai.providers(id),
  label                   text        NOT NULL,
  legal_entity            text,                      -- titulaire du contrat (migration vers la SARL)
  secret_id               bigint      REFERENCES iam.secrets(id) ON DELETE SET NULL,
  tier                    text,                      -- palier actuel chez le fournisseur
  rate_limits             jsonb       NOT NULL DEFAULT '{}',  -- {"rpm":..., "tpm":...}
  billing_mode            text        NOT NULL DEFAULT 'prepaid' CHECK (billing_mode IN ('prepaid','postpaid','commitment')),
  balance_currency        char(3)     REFERENCES ref.currencies(code),
  low_balance_threshold_minor bigint,
  auto_reload_enabled     boolean     NOT NULL DEFAULT false,
  status                  text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','limited','suspended','disabled')),
  region                  text,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_accounts_provider_idx ON ai.provider_accounts (provider_id);
CREATE INDEX provider_accounts_secret_idx   ON ai.provider_accounts (secret_id);
CREATE INDEX provider_accounts_currency_idx ON ai.provider_accounts (balance_currency);

-- Relevés de solde / dépense chez les fournisseurs (trésorerie, alertes)
CREATE TABLE ai.provider_account_snapshots (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_account_id bigint      NOT NULL REFERENCES ai.provider_accounts(id) ON DELETE CASCADE,
  balance_minor       bigint,
  spend_period_minor  bigint,
  currency            char(3)     NOT NULL REFERENCES ref.currencies(code),
  captured_at         timestamptz NOT NULL DEFAULT now(),
  source              text        NOT NULL DEFAULT 'api'
);
CREATE INDEX provider_account_snapshots_idx          ON ai.provider_account_snapshots (provider_account_id, captured_at DESC);
CREATE INDEX provider_account_snapshots_currency_idx ON ai.provider_account_snapshots (currency);

-- ---------------------------------------------------------------- modèles
CREATE TABLE ai.models (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  key                text        NOT NULL UNIQUE,             -- identifiant canonique interne
  vendor             text        NOT NULL,                    -- créateur du modèle
  family             text,
  display_name       text        NOT NULL,
  license            text        NOT NULL CHECK (license IN ('proprietary','open_weight')),
  modalities_in      text[]      NOT NULL DEFAULT '{text}',   -- text, image, audio, video, pdf
  modalities_out     text[]      NOT NULL DEFAULT '{text}',   -- text, image, audio, embedding
  capabilities       text[]      NOT NULL DEFAULT '{}',       -- tools, json_schema, reasoning, vision, caching
  context_window     integer     CHECK (context_window > 0),
  max_output_tokens  integer     CHECK (max_output_tokens > 0),
  embedding_dims     integer     CHECK (embedding_dims > 0),
  quality_score      numeric(5,2),                            -- utilisé par le routeur
  speed_score        numeric(5,2),
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('preview','active','deprecated','disabled')),
  released_at        date,
  deprecated_at      date,
  metadata           jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX models_capabilities_gin ON ai.models USING gin (capabilities);
CREATE INDEX models_modalities_gin   ON ai.models USING gin (modalities_in);

-- Un modèle servi par un fournisseur via un de nos comptes (route LiteLLM)
CREATE TABLE ai.model_deployments (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  model_id            bigint      NOT NULL REFERENCES ai.models(id),
  provider_id         bigint      NOT NULL REFERENCES ai.providers(id),
  provider_account_id bigint      REFERENCES ai.provider_accounts(id) ON DELETE SET NULL, -- NULL = BYOK uniquement
  provider_model_name text        NOT NULL,             -- nom chez le fournisseur
  litellm_route       text        NOT NULL UNIQUE,      -- nom dans la config LiteLLM
  priority            smallint    NOT NULL DEFAULT 100,
  weight              smallint    NOT NULL DEFAULT 100 CHECK (weight >= 0),
  zero_data_retention boolean     NOT NULL DEFAULT false,
  processing_region   text,                             -- us, eu... (conformité)
  allows_platform_keys boolean    NOT NULL DEFAULT true,  -- false = modèle accessible en BYOK seulement
  status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','degraded','disabled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_deployments_model_idx    ON ai.model_deployments (model_id, priority) WHERE status = 'active';
CREATE INDEX model_deployments_provider_idx ON ai.model_deployments (provider_id);
CREATE INDEX model_deployments_account_idx  ON ai.model_deployments (provider_account_id);

-- Prix fournisseur (USD) par unité, versionnés sans chevauchement
CREATE TABLE ai.model_prices (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id     bigint         NOT NULL REFERENCES ai.model_deployments(id) ON DELETE CASCADE,
  unit              text           NOT NULL CHECK (unit IN (
                      'input_token','output_token','cached_input_token','cache_write_token','reasoning_token',
                      'embedding_token','image_input','image_output','audio_input_second','audio_output_second',
                      'tts_character','document_page','video_second','request')),
  unit_price_usd    numeric(24,14) NOT NULL CHECK (unit_price_usd >= 0),
  tier_condition    jsonb,          -- ex: {"context_over": 200000} pour tarifs par palier
  effective_during  tstzrange      NOT NULL,
  source            text           NOT NULL DEFAULT 'manual',
  created_at        timestamptz    NOT NULL DEFAULT now(),
  EXCLUDE USING gist (deployment_id WITH =, unit WITH =, (coalesce(tier_condition::text, '')) WITH =,
                      effective_during WITH &&)
);

-- ------------------------------------------------------------------ routage
-- Profils = intentions (flash: coût/vitesse, smart: équilibre, max: qualité)
-- organization_id NULL = profil système ; sinon profil personnalisé (Pro+)
CREATE TABLE ai.routing_profiles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (key ~ '^[a-z0-9_]+$'),
  name            jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description     jsonb,
  strategy        jsonb       NOT NULL DEFAULT '{}',   -- {"cost":0.6,"latency":0.3,"quality":0.1}
  is_system       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (is_system = (organization_id IS NULL))
);
CREATE UNIQUE INDEX routing_profiles_key_uq ON ai.routing_profiles (organization_id, key) NULLS NOT DISTINCT;

CREATE TABLE ai.routing_rules (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  profile_id      bigint      NOT NULL REFERENCES ai.routing_profiles(id) ON DELETE CASCADE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  priority        smallint    NOT NULL DEFAULT 100,
  conditions      jsonb       NOT NULL DEFAULT '{}',   -- modalité, taille d'entrée, plan, type de tâche...
  is_enabled      boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routing_rules_profile_idx ON ai.routing_rules (profile_id, priority) WHERE is_enabled;
CREATE INDEX routing_rules_org_idx     ON ai.routing_rules (organization_id);

-- Cibles ordonnées d'une règle (position 0 = primaire, suivantes = bascule)
CREATE TABLE ai.routing_rule_targets (
  rule_id    bigint   NOT NULL REFERENCES ai.routing_rules(id) ON DELETE CASCADE,
  model_id   bigint   NOT NULL REFERENCES ai.models(id),
  position   smallint NOT NULL CHECK (position >= 0),
  weight     smallint NOT NULL DEFAULT 100,
  PRIMARY KEY (rule_id, position)
);
CREATE INDEX routing_rule_targets_model_idx ON ai.routing_rule_targets (model_id);

-- --------------------------------------------------------------------- BYOK
CREATE TABLE ai.byok_keys (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE,
  workspace_id       bigint,                       -- NULL = toute l'organisation
  environment_id     bigint,
  provider_id        bigint      NOT NULL REFERENCES ai.providers(id),
  label              text        NOT NULL,
  secret_id          bigint      NOT NULL,
  priority           smallint    NOT NULL DEFAULT 100,
  status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalid','revoked')),
  last_validated_at  timestamptz,
  last_error         text,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (secret_id, organization_id)      REFERENCES iam.secrets(id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)   REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX byok_keys_lookup_idx   ON ai.byok_keys (organization_id, provider_id, priority) WHERE status = 'active';
CREATE INDEX byok_keys_provider_idx ON ai.byok_keys (provider_id);
CREATE INDEX byok_keys_secret_idx   ON ai.byok_keys (secret_id, organization_id);
CREATE INDEX byok_keys_ws_idx       ON ai.byok_keys (workspace_id, organization_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX byok_keys_env_idx      ON ai.byok_keys (environment_id, organization_id) WHERE environment_id IS NOT NULL;
CREATE INDEX byok_keys_creator_idx  ON ai.byok_keys (created_by_user_id);

-- ------------------------------------------------ capacités ai.run("clé")
-- Une capacité = une fonction IA métier appelée par le SDK (invoice.extract,
-- support.reply). Ses prompts, schémas et réglages sont versionnés.
CREATE TABLE ai.capabilities (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  key                text        NOT NULL CHECK (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  name               text        NOT NULL,
  description        text,
  status             text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  source_listing_id  bigint,                   -- installée depuis la marketplace (FK dans 080)
  visibility         text        NOT NULL DEFAULT 'private'
                     CHECK (visibility IN ('private','organization','public')),  -- public = publiée sur la Marketplace
  is_sealed          boolean     NOT NULL DEFAULT false,   -- achetée « scellée » : utilisable, prompt jamais visible ni modifiable
  lock_version       integer     NOT NULL DEFAULT 0,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id) REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX capabilities_key_uq ON ai.capabilities (workspace_id, key) WHERE deleted_at IS NULL;
CREATE INDEX capabilities_ws_org_idx    ON ai.capabilities (workspace_id, organization_id);
CREATE INDEX capabilities_creator_idx   ON ai.capabilities (created_by_user_id);
CREATE INDEX capabilities_listing_idx   ON ai.capabilities (source_listing_id);
CREATE INDEX capabilities_org_shared_idx ON ai.capabilities (organization_id, key) WHERE visibility <> 'private' AND deleted_at IS NULL;

-- Version immuable une fois publiée (is_locked)
CREATE TABLE ai.capability_versions (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  capability_id       bigint      NOT NULL,
  organization_id     bigint      NOT NULL,
  version             integer     NOT NULL CHECK (version > 0),
  system_prompt       text        NOT NULL,
  user_template       text,                         -- gabarit avec {{variables}}
  variables_schema    jsonb       NOT NULL DEFAULT '{}',
  input_schema        jsonb,
  output_schema       jsonb,                        -- sortie JSON structurée
  routing_profile_id  bigint      REFERENCES ai.routing_profiles(id),
  model_override_id   bigint      REFERENCES ai.models(id),  -- modèle fixé (plan Pro et plus : ai.model_override)
  model_fallback      text        NOT NULL DEFAULT 'profile'
                      CHECK (model_fallback IN ('profile','fail')), -- modèle fixé indisponible : basculer vers le profil ou échouer (mode Technique)
  params              jsonb       NOT NULL DEFAULT '{}',   -- temperature, max_tokens...
  tool_refs           jsonb       NOT NULL DEFAULT '[]',   -- outils MCP autorisés
  optimization        jsonb       NOT NULL DEFAULT '{}',   -- compression contexte, cache sémantique
  guardrails          jsonb       NOT NULL DEFAULT '{}',   -- masquage PII, filtres
  changelog           text,
  is_locked           boolean     NOT NULL DEFAULT false,
  created_by_user_id  bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, version),
  UNIQUE (id, organization_id),
  FOREIGN KEY (capability_id, organization_id) REFERENCES ai.capabilities(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX capability_versions_cap_org_idx ON ai.capability_versions (capability_id, organization_id);
CREATE INDEX capability_versions_profile_idx ON ai.capability_versions (routing_profile_id);
CREATE INDEX capability_versions_model_idx   ON ai.capability_versions (model_override_id);
CREATE INDEX capability_versions_creator_idx ON ai.capability_versions (created_by_user_id);

-- Capacité scellée (achat Marketplace) : aucune version ne peut être créée ni modifiée par l'acheteur.
-- Seule la synchronisation Marketplace (SET LOCAL app.market_sync = 'on', rôle app_admin) peut pousser une version.
CREATE FUNCTION ai.protect_sealed_capability() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.market_sync', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM ai.capabilities c WHERE c.id = NEW.capability_id AND c.is_sealed) THEN
    RAISE EXCEPTION 'CAPABILITY_SEALED: capacité scellée, modification réservée à l''éditeur'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capability_versions_sealed_trg
  BEFORE INSERT OR UPDATE ON ai.capability_versions
  FOR EACH ROW EXECUTE FUNCTION ai.protect_sealed_capability();

-- Profil de routage par défaut (organisation puis workspace ; à défaut : défaut du plan)
ALTER TABLE iam.organizations ADD COLUMN default_routing_profile_id bigint REFERENCES ai.routing_profiles(id);
ALTER TABLE iam.workspaces    ADD COLUMN default_routing_profile_id bigint REFERENCES ai.routing_profiles(id);
CREATE INDEX organizations_routing_profile_idx ON iam.organizations (default_routing_profile_id);
CREATE INDEX workspaces_routing_profile_idx    ON iam.workspaces (default_routing_profile_id);

-- Mise en production par environnement, avec répartition A/B
CREATE TABLE ai.capability_releases (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  capability_id      bigint      NOT NULL,
  organization_id    bigint      NOT NULL,
  environment_id     bigint      NOT NULL,
  is_active          boolean     NOT NULL DEFAULT true,
  released_by_user_id bigint     REFERENCES iam.users(id) ON DELETE SET NULL,
  released_at        timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  UNIQUE (id, organization_id),
  FOREIGN KEY (capability_id, organization_id)  REFERENCES ai.capabilities(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id, organization_id) REFERENCES iam.environments(id, organization_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX capability_releases_active_uq ON ai.capability_releases (capability_id, environment_id) WHERE is_active;
CREATE INDEX capability_releases_cap_org_idx ON ai.capability_releases (capability_id, organization_id);
CREATE INDEX capability_releases_env_org_idx ON ai.capability_releases (environment_id, organization_id);
CREATE INDEX capability_releases_user_idx    ON ai.capability_releases (released_by_user_id);

CREATE TABLE ai.capability_release_variants (
  release_id      bigint   NOT NULL,
  version_id      bigint   NOT NULL,
  organization_id bigint   NOT NULL,
  weight_pct      smallint NOT NULL CHECK (weight_pct BETWEEN 0 AND 100),
  PRIMARY KEY (release_id, version_id),
  FOREIGN KEY (release_id, organization_id) REFERENCES ai.capability_releases(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, organization_id) REFERENCES ai.capability_versions(id, organization_id)
);
CREATE INDEX capability_release_variants_version_idx ON ai.capability_release_variants (version_id, organization_id);
CREATE INDEX capability_release_variants_rel_org_idx ON ai.capability_release_variants (release_id, organization_id);

-- -------------------------------------------------------------- évaluations
CREATE TABLE ai.eval_datasets (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id          uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id    bigint      NOT NULL,
  workspace_id       bigint      NOT NULL,
  capability_id      bigint,
  name               text        NOT NULL,
  description        text,
  source_file_id     bigint      REFERENCES storage.files(id) ON DELETE SET NULL,
  created_by_user_id bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)  REFERENCES iam.workspaces(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (capability_id, organization_id) REFERENCES ai.capabilities(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX eval_datasets_ws_idx      ON ai.eval_datasets (workspace_id, organization_id);
CREATE INDEX eval_datasets_cap_idx     ON ai.eval_datasets (capability_id, organization_id);
CREATE INDEX eval_datasets_file_idx    ON ai.eval_datasets (source_file_id);
CREATE INDEX eval_datasets_creator_idx ON ai.eval_datasets (created_by_user_id);

CREATE TABLE ai.eval_cases (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_id      bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  input           jsonb       NOT NULL,
  expected        jsonb,
  assertions      jsonb       NOT NULL DEFAULT '[]',   -- règles de notation
  tags            text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (dataset_id, organization_id) REFERENCES ai.eval_datasets(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX eval_cases_dataset_idx ON ai.eval_cases (dataset_id, organization_id);

CREATE TABLE ai.eval_runs (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id             uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id       bigint      NOT NULL,
  dataset_id            bigint      NOT NULL,
  capability_version_id bigint      NOT NULL,
  status                text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  score                 numeric(6,3),
  metrics               jsonb       NOT NULL DEFAULT '{}',   -- qualité, coût moyen, latence
  started_at            timestamptz,
  completed_at          timestamptz,
  created_by_user_id    bigint      REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (dataset_id, organization_id)            REFERENCES ai.eval_datasets(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (capability_version_id, organization_id) REFERENCES ai.capability_versions(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX eval_runs_dataset_idx ON ai.eval_runs (dataset_id, organization_id, created_at DESC);
CREATE INDEX eval_runs_version_idx ON ai.eval_runs (capability_version_id, organization_id);
CREATE INDEX eval_runs_creator_idx ON ai.eval_runs (created_by_user_id);

CREATE TABLE ai.eval_results (
  eval_run_id     bigint      NOT NULL,
  case_id         bigint      NOT NULL,
  organization_id bigint      NOT NULL,
  output          jsonb,
  score           numeric(6,3),
  passed          boolean,
  details         jsonb       NOT NULL DEFAULT '{}',
  run_id          bigint,                 -- run d'usage associé (traçabilité coût)
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (eval_run_id, case_id),
  FOREIGN KEY (eval_run_id, organization_id) REFERENCES ai.eval_runs(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (case_id, organization_id)     REFERENCES ai.eval_cases(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX eval_results_case_idx    ON ai.eval_results (case_id, organization_id);
CREATE INDEX eval_results_run_org_idx ON ai.eval_results (eval_run_id, organization_id);
