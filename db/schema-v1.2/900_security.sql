-- =============================================================================
-- 900_security.sql — Triggers transverses, immutabilité, rôles applicatifs,
-- Row-Level Security (isolation stricte entre clients), partitions initiales.
-- =============================================================================

-- ------------------------------------------------------ triggers transverses
-- updated_at automatique sur toutes les tables qui ont la colonne
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'updated_at' AND NOT a.attisdropped
    WHERE c.relkind IN ('r','p')
      AND NOT c.relispartition
      AND n.nspname IN ('ref','iam','storage','billing','ai','mcp','agent','usage','dev','market','ux','notif','compliance','platform','audit')
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION util.touch_updated_at()',
                   r.relname || '_touch_updated_at', r.tbl);
  END LOOP;
END $$;

-- lock_version (verrou optimiste) : UPDATE ... WHERE id = $1 AND lock_version = $2
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'lock_version' AND NOT a.attisdropped
    WHERE c.relkind IN ('r','p') AND NOT c.relispartition
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION util.bump_lock_version()',
                   r.relname || '_bump_lock_version', r.tbl);
  END LOOP;
END $$;

-- ------------------------------------------------------------ immutabilité
-- Grand livre des crédits : ajout seul (les corrections passent par des écritures inverses)
CREATE TRIGGER credit_ledger_append_only
  BEFORE UPDATE OR DELETE ON billing.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION util.forbid_mutation();

-- Versions d'agent : immuables (chaque run référence la configuration exacte utilisée)
CREATE TRIGGER agent_versions_immutable
  BEFORE UPDATE ON agent.versions
  FOR EACH ROW EXECUTE FUNCTION util.forbid_mutation();

-- Versions de serveur MCP : l'instantané publié ne change jamais (seul le statut évolue)
CREATE OR REPLACE FUNCTION util.protect_server_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.config_snapshot IS DISTINCT FROM OLD.config_snapshot
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.semver IS DISTINCT FROM OLD.semver THEN
    RAISE EXCEPTION 'Une version de serveur MCP est immuable (créer une nouvelle version)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER server_versions_snapshot_immutable
  BEFORE UPDATE ON mcp.server_versions
  FOR EACH ROW EXECUTE FUNCTION util.protect_server_snapshot();

-- Versions de capacité : verrouillées une fois publiées
CREATE OR REPLACE FUNCTION util.protect_locked_capability_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_locked THEN
    RAISE EXCEPTION 'Version de capacité verrouillée (créer une nouvelle version)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capability_versions_locked
  BEFORE UPDATE ON ai.capability_versions
  FOR EACH ROW EXECUTE FUNCTION util.protect_locked_capability_version();

-- Historique des paramètres de la plateforme
CREATE OR REPLACE FUNCTION util.log_setting_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO platform.settings_history (key, old_value, new_value, changed_by_staff_id)
  VALUES (NEW.key, CASE WHEN TG_OP = 'UPDATE' THEN OLD.value END, NEW.value, NEW.updated_by_staff_id);
  RETURN NEW;
END $$;
CREATE TRIGGER settings_history_log
  AFTER INSERT OR UPDATE OF value ON platform.settings
  FOR EACH ROW EXECUTE FUNCTION util.log_setting_change();

-- ---------------------------------------------------------- partitions
-- Partition par défaut (surveillée, doit rester vide) + mois courant et 3 suivants.
-- En production : job quotidien util.ensure_monthly_partitions(<table>, current_date, 3)
-- et job de rétention qui DÉTACHE puis archive/supprime les vieilles partitions.
DO $$
DECLARE t regclass;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'billing.credit_ledger','dev.inbound_events','dev.webhook_deliveries',
    'usage.runs','usage.run_steps','usage.llm_requests','usage.tool_calls','usage.guardrail_events','audit.events'
  ]::regclass[]
  LOOP
    PERFORM util.ensure_default_partition(t);
    PERFORM util.ensure_monthly_partitions(t, date_trunc('month', now())::date, 4);
  END LOOP;
END $$;

-- ----------------------------------------------------------------- rôles
-- app_rw      : API, runtime MCP, workers "client" — soumis à la RLS
-- app_auth    : résolution des identifiants (clés API, jetons, sessions) avant
--               que l'organisation soit connue — BYPASSRLS, droits très restreints
-- app_admin   : back-office et jobs système (facturation, purge, partitions) — BYPASSRLS
-- app_readonly: analytique / export ClickHouse — lecture seule, BYPASSRLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw')       THEN CREATE ROLE app_rw NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth')     THEN CREATE ROLE app_auth NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin')    THEN CREATE ROLE app_admin NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN CREATE ROLE app_readonly NOLOGIN BYPASSRLS; END IF;
END $$;

-- Schémas
GRANT USAGE ON SCHEMA util, ref, iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance, platform, audit
  TO app_rw, app_admin, app_readonly;
GRANT USAGE ON SCHEMA util, iam, dev, mcp, platform TO app_auth;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA util TO app_rw, app_admin, app_auth, app_readonly;
GRANT EXECUTE ON FUNCTION usage.find_run(uuid) TO app_rw, app_admin, app_readonly;

-- app_admin : tout ; app_readonly : lecture
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
  ref, iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance, platform TO app_admin;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA
  ref, iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance, platform, audit TO app_admin, app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA
  ref, iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance, platform, audit TO app_readonly;

-- app_rw : lecture des référentiels / catalogues, écriture sur les données tenant
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
  iam, storage, billing, ai, mcp, agent, usage, dev, market, ux, notif, compliance TO app_rw;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO app_rw;
-- catalogues globaux : lecture seule pour app_rw
REVOKE INSERT, UPDATE, DELETE ON
  iam.permissions, billing.plans, billing.plan_prices, billing.features, billing.plan_features,
  billing.credit_packs, billing.credit_pack_prices, billing.infra_meters, billing.infra_meter_rates,
  billing.payment_providers, billing.invoice_sequences, ai.providers, ai.provider_accounts,
  ai.provider_account_snapshots, ai.models, ai.model_deployments, ai.model_prices,
  mcp.connector_definitions, market.categories, compliance.legal_documents,
  compliance.processing_activities, compliance.subprocessors, compliance.transfer_authorizations,
  compliance.data_breaches, billing.coupons, ai.guardrail_detectors
FROM app_rw;
REVOKE ALL ON ai.provider_accounts, ai.provider_account_snapshots, compliance.data_breaches,
  compliance.transfer_authorizations, billing.invoice_sequences FROM app_rw;
-- Stockage (D52) : app_rw lit le backend d'un fichier (sans secret), ne le modifie jamais ;
-- les migrations entre backends sont réservées au back-office et aux jobs (app_admin)
REVOKE INSERT, UPDATE, DELETE ON storage.backends FROM app_rw;
REVOKE ALL ON storage.backend_migrations FROM app_rw;
-- back-office : app_rw ne voit que ce qui sert au produit client
GRANT SELECT ON platform.settings, platform.feature_flags, platform.feature_flag_overrides,
  platform.error_codes, platform.translations, platform.message_templates, platform.announcements,
  platform.status_components, platform.incidents, platform.incident_updates, platform.api_versions,
  platform.maintenance_windows, platform.rate_limit_policies, platform.emergency_stops TO app_rw;
GRANT SELECT, INSERT, DELETE ON platform.announcement_dismissals TO app_rw;
GRANT SELECT, INSERT, UPDATE ON platform.support_tickets, platform.support_messages TO app_rw;
GRANT INSERT ON platform.moderation_reports, platform.abuse_signals TO app_rw;

-- app_auth : uniquement la résolution d'identifiants
GRANT SELECT, UPDATE ON iam.user_sessions, dev.api_keys, mcp.access_tokens, iam.oauth_tokens,
  iam.oauth_authorization_codes, dev.device_authorizations, mcp.bridges TO app_auth;
GRANT SELECT, INSERT, UPDATE ON iam.oauth_clients TO app_auth;
GRANT INSERT ON iam.oauth_tokens TO app_auth;
GRANT SELECT ON iam.users, iam.memberships, iam.organizations, iam.environments, iam.workspaces,
  mcp.servers, platform.blocklist_entries TO app_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO app_auth;

-- Les partitions ne sont accessibles que via la table parente (sinon la RLS serait contournable)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT inhrelid::regclass AS part FROM pg_inherits i
           JOIN pg_class c ON c.oid = i.inhrelid WHERE c.relispartition AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM app_rw, app_readonly, app_auth', r.part);
  END LOOP;
END $$;

-- ------------------------------------------------------- Row-Level Security
-- Règle générale : organization_id = util.current_org_id()
-- Sans contexte (app.org_id non posé) => aucune ligne : refus par défaut.
DO $$
DECLARE
  r record;
  shared_catalogs text[] := ARRAY['iam.roles','ai.routing_profiles','ai.routing_rules',
                                  'ai.guardrail_profiles','ai.guardrail_rules','ai.guardrail_bindings'];
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl, n.nspname || '.' || c.relname AS fqn, a.attnotnull
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped
    WHERE c.relkind IN ('r','p') AND NOT c.relispartition
      AND n.nspname IN ('iam','storage','billing','ai','mcp','agent','usage','dev','market','compliance','audit')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
    IF r.fqn = ANY (shared_catalogs) THEN
      -- NULL = élément système partagé : lisible par tous, modifiable par personne via app_rw
      EXECUTE format('CREATE POLICY tenant_read ON %s FOR SELECT TO app_rw USING (organization_id IS NULL OR organization_id = util.current_org_id())', r.tbl);
      EXECUTE format('CREATE POLICY tenant_insert ON %s FOR INSERT TO app_rw WITH CHECK (organization_id = util.current_org_id())', r.tbl);
      EXECUTE format('CREATE POLICY tenant_update ON %s FOR UPDATE TO app_rw USING (organization_id = util.current_org_id()) WITH CHECK (organization_id = util.current_org_id())', r.tbl);
      EXECUTE format('CREATE POLICY tenant_delete ON %s FOR DELETE TO app_rw USING (organization_id = util.current_org_id())', r.tbl);
    ELSE
      EXECUTE format('CREATE POLICY tenant_isolation ON %s FOR ALL TO app_rw USING (organization_id = util.current_org_id()) WITH CHECK (organization_id = util.current_org_id())', r.tbl);
    END IF;
  END LOOP;
END $$;

-- Organisations : celle du contexte + celles dont l'utilisateur est membre (sélecteur d'organisation)
ALTER TABLE iam.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_current ON iam.organizations FOR ALL TO app_rw
  USING (id = util.current_org_id()) WITH CHECK (id = util.current_org_id());
CREATE POLICY org_member_read ON iam.organizations FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM iam.memberships m
                 WHERE m.organization_id = organizations.id AND m.user_id = util.current_user_id()));
CREATE POLICY org_create ON iam.organizations FOR INSERT TO app_rw
  WITH CHECK (created_by_user_id = util.current_user_id());

-- "Mes adhésions" sans contexte d'organisation
CREATE POLICY membership_self_read ON iam.memberships FOR SELECT TO app_rw
  USING (user_id = util.current_user_id());

-- Acceptations légales et demandes RGPD au niveau de l'utilisateur
CREATE POLICY acceptance_self ON compliance.legal_acceptances FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());
CREATE POLICY dsr_self ON compliance.data_subject_requests FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());

-- Marketplace : les éléments publiés sont publics
CREATE POLICY listing_public_read ON market.listings FOR SELECT TO app_rw USING (status = 'published');
CREATE POLICY publisher_public_read ON market.publishers FOR SELECT TO app_rw USING (status = 'active');
CREATE POLICY review_public_read ON market.reviews FOR SELECT TO app_rw USING (status = 'published');
ALTER TABLE market.listing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_version_read ON market.listing_versions FOR SELECT TO app_rw
  USING (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = listing_versions.listing_id
                 AND (l.status = 'published' OR l.organization_id = util.current_org_id())));
CREATE POLICY listing_version_write ON market.listing_versions FOR ALL TO app_rw
  USING (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = listing_versions.listing_id AND l.organization_id = util.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = listing_versions.listing_id AND l.organization_id = util.current_org_id()));
ALTER TABLE market.bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY bundle_items_read ON market.bundle_items FOR SELECT TO app_rw USING (true);
CREATE POLICY bundle_items_write ON market.bundle_items FOR ALL TO app_rw
  USING (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = bundle_items.bundle_listing_id AND l.organization_id = util.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = bundle_items.bundle_listing_id AND l.organization_id = util.current_org_id()));
ALTER TABLE market.listing_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_prices_read ON market.listing_prices FOR SELECT TO app_rw USING (true);
CREATE POLICY listing_prices_write ON market.listing_prices FOR ALL TO app_rw
  USING (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = listing_prices.listing_id AND l.organization_id = util.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM market.listings l WHERE l.id = listing_prices.listing_id AND l.organization_id = util.current_org_id()));

-- Tables par utilisateur (frontend)
ALTER TABLE ux.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_self ON ux.user_preferences FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());

ALTER TABLE ux.ui_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY ui_states_self ON ux.ui_states FOR ALL TO app_rw
  USING (user_id = util.current_user_id() AND (organization_id IS NULL OR organization_id = util.current_org_id()))
  WITH CHECK (user_id = util.current_user_id() AND (organization_id IS NULL OR organization_id = util.current_org_id()));

ALTER TABLE ux.onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_self ON ux.onboarding_progress FOR ALL TO app_rw
  USING (user_id = util.current_user_id() AND (organization_id IS NULL OR organization_id = util.current_org_id()))
  WITH CHECK (user_id = util.current_user_id() AND (organization_id IS NULL OR organization_id = util.current_org_id()));

ALTER TABLE ux.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_self ON ux.drafts FOR ALL TO app_rw
  USING (user_id = util.current_user_id() AND organization_id = util.current_org_id())
  WITH CHECK (user_id = util.current_user_id() AND organization_id = util.current_org_id());

ALTER TABLE ux.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_views_read ON ux.saved_views FOR SELECT TO app_rw
  USING (organization_id = util.current_org_id() AND (user_id = util.current_user_id() OR is_shared));
CREATE POLICY saved_views_write ON ux.saved_views FOR ALL TO app_rw
  USING (organization_id = util.current_org_id() AND user_id = util.current_user_id())
  WITH CHECK (organization_id = util.current_org_id() AND user_id = util.current_user_id());

ALTER TABLE ux.dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboards_read ON ux.dashboards FOR SELECT TO app_rw
  USING (organization_id = util.current_org_id() AND (owner_user_id = util.current_user_id() OR is_shared));
CREATE POLICY dashboards_write ON ux.dashboards FOR ALL TO app_rw
  USING (organization_id = util.current_org_id() AND owner_user_id = util.current_user_id())
  WITH CHECK (organization_id = util.current_org_id() AND owner_user_id = util.current_user_id());

ALTER TABLE notif.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_self ON notif.notifications FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());
ALTER TABLE notif.preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_self ON notif.preferences FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());
ALTER TABLE notif.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliveries_org ON notif.deliveries FOR SELECT TO app_rw
  USING (organization_id = util.current_org_id());

-- Support : un client ne voit que les tickets de son organisation, jamais les notes internes
ALTER TABLE platform.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_org ON platform.support_tickets FOR ALL TO app_rw
  USING (organization_id = util.current_org_id() OR user_id = util.current_user_id())
  WITH CHECK (organization_id = util.current_org_id() OR user_id = util.current_user_id());
ALTER TABLE platform.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_messages_org ON platform.support_messages FOR ALL TO app_rw
  USING (NOT is_internal AND EXISTS (SELECT 1 FROM platform.support_tickets t WHERE t.id = support_messages.ticket_id
         AND (t.organization_id = util.current_org_id() OR t.user_id = util.current_user_id())))
  WITH CHECK (NOT is_internal AND author_type = 'user' AND EXISTS (SELECT 1 FROM platform.support_tickets t
         WHERE t.id = support_messages.ticket_id AND (t.organization_id = util.current_org_id() OR t.user_id = util.current_user_id())));
ALTER TABLE platform.announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY dismissals_self ON platform.announcement_dismissals FOR ALL TO app_rw
  USING (user_id = util.current_user_id()) WITH CHECK (user_id = util.current_user_id());
ALTER TABLE platform.moderation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_insert ON platform.moderation_reports FOR INSERT TO app_rw
  WITH CHECK (reporter_user_id = util.current_user_id());
ALTER TABLE platform.abuse_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY abuse_insert ON platform.abuse_signals FOR INSERT TO app_rw WITH CHECK (true);
-- paramètres : app_rw ne lit que les paramètres publics
ALTER TABLE platform.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_public ON platform.settings FOR SELECT TO app_rw USING (is_public);
