-- =============================================================================
-- 097_guardrails.sql — Garde-fous IA + IA interne de la plateforme
--  * Catalogue des détecteurs (regex, classifieur local, modèle distant, juge LLM,
--    règle déterministe) avec budget de latence.
--  * Profils de garde-fous (système ou par client) = règles ordonnées par étape :
--    input -> context -> tool_call -> output -> cost.
--  * Rattachements (plan, organisation, workspace, environnement, capacité, agent,
--    serveur MCP) : le plus spécifique l'emporte.
--  * Journal des déclenchements (partitionné) + retour « faux positif ».
--  * Arrêts d'urgence (global, organisation, agent, modèle, fournisseur, outil).
--  * IA interne : l'organisation système (id = 0) possède les capacités internes
--    (sémantisation MCP, détection d'injection, juge, assistants...) gérées depuis
--    l'admin avec le même versionnage / A-B / évaluations que les capacités clients.
-- =============================================================================

-- Catalogue des détecteurs (global, géré par l'admin)
CREATE TABLE ai.guardrail_detectors (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key               text        NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]+$'),
  stage             text        NOT NULL CHECK (stage IN ('input','context','tool_call','output','cost')),
  engine            text        NOT NULL CHECK (engine IN
                    ('regex','deterministic','classifier_local','classifier_remote','llm_judge','policy')),
  model_id          bigint      REFERENCES ai.models(id),     -- pour classifier_remote / llm_judge
  local_model_ref   text,                                     -- ex: modèle ONNX embarqué
  latency_budget_ms integer     NOT NULL CHECK (latency_budget_ms > 0),
  cost_tier         text        NOT NULL DEFAULT 'free' CHECK (cost_tier IN ('free','low','medium','high')),
  default_params    jsonb       NOT NULL DEFAULT '{}',
  name              jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description       jsonb,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardrail_detectors_model_idx ON ai.guardrail_detectors (model_id);

-- Profils : système (organization_id NULL) ou personnalisés (Pro+)
CREATE TABLE ai.guardrail_profiles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id       uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,
  key             text        NOT NULL CHECK (key ~ '^[a-z0-9_]+$'),
  name            jsonb       NOT NULL CHECK (util.is_i18n(name)),
  description     jsonb,
  mode            text        NOT NULL DEFAULT 'enforce' CHECK (mode IN ('enforce','monitor')),  -- monitor = mode fantôme
  is_system       boolean     NOT NULL DEFAULT false,
  lock_version    integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  CHECK (is_system = (organization_id IS NULL))
);
CREATE UNIQUE INDEX guardrail_profiles_key_uq ON ai.guardrail_profiles (organization_id, key) NULLS NOT DISTINCT;

CREATE TABLE ai.guardrail_rules (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id      bigint       NOT NULL REFERENCES ai.guardrail_profiles(id) ON DELETE CASCADE,
  organization_id bigint       REFERENCES iam.organizations(id) ON DELETE CASCADE,
  detector_id     bigint       NOT NULL REFERENCES ai.guardrail_detectors(id),
  position        smallint     NOT NULL DEFAULT 0,
  action          text         NOT NULL CHECK (action IN
                  ('block','redact','flag','require_approval','fallback_model','retry','escalate_judge')),
  threshold       numeric(5,4) CHECK (threshold BETWEEN 0 AND 1),
  params          jsonb        NOT NULL DEFAULT '{}',
  applies_to      text[]       NOT NULL DEFAULT '{sdk,chat,agent,mcp_external,playground}',
  sample_rate     numeric(5,4) NOT NULL DEFAULT 1 CHECK (sample_rate > 0 AND sample_rate <= 1), -- contrôles coûteux échantillonnés
  is_enabled      boolean      NOT NULL DEFAULT true,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (profile_id, detector_id, position)
);
CREATE INDEX guardrail_rules_profile_idx  ON ai.guardrail_rules (profile_id, position) WHERE is_enabled;
CREATE INDEX guardrail_rules_org_idx      ON ai.guardrail_rules (organization_id);
CREATE INDEX guardrail_rules_detector_idx ON ai.guardrail_rules (detector_id);

-- Rattachement d'un profil à une portée (le plus spécifique l'emporte, priority départage)
CREATE TABLE ai.guardrail_bindings (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id      bigint      NOT NULL REFERENCES ai.guardrail_profiles(id) ON DELETE CASCADE,
  organization_id bigint      REFERENCES iam.organizations(id) ON DELETE CASCADE,  -- NULL si portée = plan / global
  scope_type      text        NOT NULL CHECK (scope_type IN
                  ('global','plan','organization','workspace','environment','capability','agent','mcp_server')),
  scope_id        bigint,                                   -- NULL pour global
  priority        smallint    NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'global') = (scope_id IS NULL)),
  CHECK (scope_type IN ('global','plan') OR organization_id IS NOT NULL)
);
CREATE UNIQUE INDEX guardrail_bindings_uq ON ai.guardrail_bindings (scope_type, scope_id, profile_id) NULLS NOT DISTINCT;
CREATE INDEX guardrail_bindings_profile_idx ON ai.guardrail_bindings (profile_id);
CREATE INDEX guardrail_bindings_org_idx     ON ai.guardrail_bindings (organization_id, scope_type, scope_id);

-- Journal des déclenchements (volume élevé -> partitionné). Jamais de contenu brut sensible :
-- extrait masqué + empreinte.
CREATE TABLE usage.guardrail_events (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  organization_id  bigint       NOT NULL,
  workspace_id     bigint,
  run_id           bigint,
  run_created_at   timestamptz,
  llm_request_id   bigint,
  tool_call_id     bigint,
  profile_id       bigint,
  rule_id          bigint,
  detector_key     text         NOT NULL,
  stage            text         NOT NULL,
  mode             text         NOT NULL CHECK (mode IN ('enforce','monitor')),
  action_taken     text         NOT NULL,          -- block, redact, flag, none (monitor)...
  score            numeric(5,4),
  latency_ms       integer,
  excerpt_masked   text,
  content_hash     bytea,
  details          jsonb        NOT NULL DEFAULT '{}',
  feedback         text         CHECK (feedback IN ('false_positive','true_positive')),
  feedback_by      jsonb,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX guardrail_events_org_idx      ON usage.guardrail_events (organization_id, created_at DESC);
CREATE INDEX guardrail_events_run_idx      ON usage.guardrail_events (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX guardrail_events_detector_idx ON usage.guardrail_events (detector_key, created_at DESC);
CREATE INDEX guardrail_events_review_idx   ON usage.guardrail_events (created_at DESC) WHERE action_taken = 'block' AND feedback IS NULL;

-- Arrêts d'urgence (lus en cache Redis, invalidés à chaque changement)
CREATE TABLE platform.emergency_stops (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id           uuid        NOT NULL DEFAULT uuidv7() UNIQUE,
  scope_type          text        NOT NULL CHECK (scope_type IN
                      ('global','organization','agent','model','provider','deployment','mcp_server','tool','capability','feature')),
  scope_id            bigint,
  scope_key           text,                          -- pour feature (clé de flag) / global
  reason              text        NOT NULL,
  blocks              text[]      NOT NULL DEFAULT '{runs,tool_calls}',  -- runs, tool_calls, llm_requests, publications
  activated_by_staff_id bigint    REFERENCES platform.staff_users(id) ON DELETE SET NULL,
  activated_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  deactivated_at      timestamptz,
  deactivated_by_staff_id bigint  REFERENCES platform.staff_users(id) ON DELETE SET NULL
);
CREATE INDEX emergency_stops_active_idx ON platform.emergency_stops (scope_type, scope_id) WHERE deactivated_at IS NULL;
CREATE INDEX emergency_stops_staff_idx  ON platform.emergency_stops (activated_by_staff_id);
CREATE INDEX emergency_stops_staff2_idx ON platform.emergency_stops (deactivated_by_staff_id);

-- Garde-fou de publication des prompts système : une version ne passe en production
-- qu'avec une évaluation réussie au-dessus du seuil (vérifié par l'application et visible ici).
ALTER TABLE ai.capability_releases
  ADD COLUMN eval_run_id bigint,
  ADD COLUMN min_eval_score numeric(6,3),
  ADD CONSTRAINT capability_releases_eval_fk FOREIGN KEY (eval_run_id, organization_id)
      REFERENCES ai.eval_runs(id, organization_id);
CREATE INDEX capability_releases_eval_idx ON ai.capability_releases (eval_run_id, organization_id);
