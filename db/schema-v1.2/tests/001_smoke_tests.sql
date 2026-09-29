-- =============================================================================
-- Tests de fumée du schéma : données minimales + vérification des garanties.
-- Usage : sur une base NEUVE (les séquences ne sont pas annulées par ROLLBACK) :
--   ./run_all.sh cp && psql -d cp -v ON_ERROR_STOP=1 -f tests/001_smoke_tests.sql
-- Chaque test lève une exception s'il échoue.
-- =============================================================================
\set QUIET on
BEGIN;

-- ------------------------------------------------------------ jeu de données
-- Référentiels, rôles système et plans : fournis par 950_seed_reference.sql
INSERT INTO iam.users (email, phone_e164, full_name) VALUES
  ('a@acme.cm', '+237690000001', 'Alice'), ('b@beta.ci', '+225070000002', 'Bruno');
INSERT INTO iam.organizations (name, slug, country_code, default_currency, default_locale, data_region_id, created_by_user_id, is_internal) VALUES
  ('Kòmerce (test)', 'komerce', 'CM', 'XAF', 'fr', (SELECT id FROM ref.data_regions WHERE code='eu-fr'), 1, true),
  ('Beta SARL', 'beta', 'CI', 'XOF', 'fr', (SELECT id FROM ref.data_regions WHERE code='eu-fr'), 2, false);
INSERT INTO iam.memberships (organization_id, user_id, role_id)
  SELECT o, u, (SELECT id FROM iam.roles WHERE key = 'owner' AND organization_id IS NULL) FROM (VALUES (1,1),(2,2)) v(o,u);
INSERT INTO iam.workspaces (organization_id, name, slug) VALUES (1, 'Principal', 'main'), (2, 'Principal', 'main');
INSERT INTO iam.environments (organization_id, workspace_id, key, name, kind) VALUES
  (1, 1, 'prod', 'Production', 'production'), (2, 2, 'prod', 'Production', 'production');

-- ------------------------------------------------------------------ TESTS
-- T1 : une FK composite interdit de rattacher un objet à un workspace d'un autre client
DO $$ BEGIN
  BEGIN
    INSERT INTO iam.environments (organization_id, workspace_id, key, name) VALUES (1, 2, 'x', 'x');
    RAISE EXCEPTION 'T1 ÉCHEC : lien inter-tenant accepté';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'T1 OK : lien inter-tenant refusé';
  END;
END $$;

-- T2 : un outil qui supprime doit exiger une approbation
INSERT INTO mcp.connectors (organization_id, workspace_id, kind, name, base_url)
  VALUES (1, 1, 'openapi', 'API Kòmerce', 'https://api.komerce.test');
INSERT INTO mcp.connector_actions (connector_id, organization_id, key, kind, definition, effect, risk_level)
  VALUES (1, 1, 'deleteProduct', 'http', '{"method":"DELETE","path":"/products/{id}"}', 'delete', 'critical');
INSERT INTO mcp.servers (organization_id, workspace_id, slug, name) VALUES (1, 1, 'boutique', 'Boutique');
DO $$ BEGIN
  BEGIN
    INSERT INTO mcp.tools (server_id, organization_id, action_id, name, description, effect, risk_level, requires_approval)
    VALUES (1, 1, 1, 'delete_product', 'Supprime un produit du catalogue', 'delete', 'critical', false);
    RAISE EXCEPTION 'T2 ÉCHEC : suppression sans approbation acceptée';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T2 OK : suppression sans approbation refusée';
  END;
END $$;

-- T3 : une action SQL ne peut pas être une suppression
INSERT INTO mcp.connectors (organization_id, workspace_id, kind, name, db_engine)
  VALUES (1, 1, 'database', 'Base Kòmerce', 'mysql');
DO $$ BEGIN
  BEGIN
    INSERT INTO mcp.connector_actions (connector_id, organization_id, key, kind, definition, effect, risk_level)
    VALUES (2, 1, 'purge', 'sql', '{"sql":"DELETE FROM orders"}', 'delete', 'critical');
    RAISE EXCEPTION 'T3 ÉCHEC : DELETE SQL accepté';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T3 OK : DELETE SQL refusé';
  END;
END $$;

-- T4 : une seule souscription vivante par organisation
INSERT INTO billing.plans (key, name, tier) VALUES ('test_plan', '{"fr":"Test","en":"Test"}', 9);
INSERT INTO billing.subscriptions (organization_id, plan_id, status, currency, current_period_start, current_period_end)
  VALUES (1, (SELECT id FROM billing.plans WHERE key='free'), 'active', 'XAF', now(), now() + interval '1 month');
DO $$ BEGIN
  BEGIN
    INSERT INTO billing.subscriptions (organization_id, plan_id, status, currency, current_period_start, current_period_end)
    VALUES (1, (SELECT id FROM billing.plans WHERE key='free'), 'active', 'XAF', now(), now() + interval '1 month');
    RAISE EXCEPTION 'T4 ÉCHEC : deux souscriptions actives';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'T4 OK : une seule souscription active';
  END;
END $$;

-- T5 : les périodes de prix ne se chevauchent pas
INSERT INTO billing.plan_prices (plan_id, currency, billing_interval, amount_minor, llm_coefficient, effective_during)
  VALUES ((SELECT id FROM billing.plans WHERE key='test_plan'), 'XAF', 'month', 0, 1.0, tstzrange('2026-01-01', NULL));
DO $$ BEGIN
  BEGIN
    INSERT INTO billing.plan_prices (plan_id, currency, billing_interval, amount_minor, llm_coefficient, effective_during)
    VALUES ((SELECT id FROM billing.plans WHERE key='test_plan'), 'XAF', 'month', 100, 1.0, tstzrange('2026-06-01', NULL));
    RAISE EXCEPTION 'T5 ÉCHEC : chevauchement de prix accepté';
  EXCEPTION WHEN exclusion_violation THEN RAISE NOTICE 'T5 OK : chevauchement de prix refusé';
  END;
END $$;

-- T6 : grand livre des crédits en ajout seul + solde non négatif hors découvert
INSERT INTO billing.credit_wallets (organization_id, kind) VALUES (1, 'llm');
INSERT INTO billing.credit_ledger (organization_id, wallet_id, entry_type, amount_micro, balance_after_micro)
  VALUES (1, 1, 'grant', 2500000000, 2500000000);
DO $$ BEGIN
  BEGIN
    UPDATE billing.credit_ledger SET amount_micro = 1 WHERE wallet_id = 1;
    RAISE EXCEPTION 'T6 ÉCHEC : écriture du grand livre modifiée';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T6a OK : grand livre immuable';
  END;
  BEGIN
    UPDATE billing.credit_wallets SET balance_micro = -1 WHERE id = 1;
    RAISE EXCEPTION 'T6 ÉCHEC : solde négatif accepté';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T6b OK : solde négatif refusé (découvert = 0)';
  END;
END $$;

-- T7 : partitions — un run tombe dans la partition du mois, retrouvable par son UUID
INSERT INTO usage.runs (organization_id, workspace_id, environment_id, source_type, status)
  VALUES (1, 1, 1, 'sdk', 'completed');
DO $$
DECLARE v_part text; v_uuid uuid; v_found int;
BEGIN
  SELECT tableoid::regclass::text, public_id INTO v_part, v_uuid FROM usage.runs LIMIT 1;
  IF v_part NOT LIKE 'usage.runs_p%' THEN RAISE EXCEPTION 'T7 ÉCHEC : partition %', v_part; END IF;
  SELECT count(*) INTO v_found FROM usage.find_run(v_uuid);
  IF v_found <> 1 THEN RAISE EXCEPTION 'T7 ÉCHEC : find_run'; END IF;
  RAISE NOTICE 'T7 OK : run dans % et retrouvé par UUIDv7', v_part;
END $$;

-- T8 : l'audit est immuable
INSERT INTO audit.events (organization_id, actor_type, actor_id, action) VALUES (1, 'user', 1, 'test.action');
DO $$ BEGIN
  BEGIN
    DELETE FROM audit.events;
    RAISE EXCEPTION 'T8 ÉCHEC : audit supprimé';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T8 OK : audit immuable';
  END;
END $$;

-- T9 : versions d'agent immuables
INSERT INTO agent.agents (organization_id, workspace_id, name) VALUES (1, 1, 'Relances');
INSERT INTO agent.versions (agent_id, organization_id, version_seq, objective) VALUES (1, 1, 1, 'Relancer les impayés');
DO $$ BEGIN
  BEGIN
    UPDATE agent.versions SET objective = 'autre' WHERE id = 1;
    RAISE EXCEPTION 'T9 ÉCHEC : version modifiée';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T9 OK : version d''agent immuable';
  END;
END $$;

-- T10 : verrou optimiste
UPDATE mcp.servers SET name = 'Boutique v2' WHERE id = 1;
DO $$ BEGIN
  IF (SELECT lock_version FROM mcp.servers WHERE id = 1) <> 1 THEN RAISE EXCEPTION 'T10 ÉCHEC'; END IF;
  RAISE NOTICE 'T10 OK : lock_version incrémenté';
END $$;

-- T18 : une capacité scellée (achat Marketplace) ne peut pas recevoir de version côté acheteur
INSERT INTO ai.capabilities (organization_id, workspace_id, key, name, status, is_sealed)
  VALUES (1, 1, 'extraire_facture', 'Extraire une facture', 'active', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO ai.capability_versions (capability_id, organization_id, version, system_prompt)
      VALUES ((SELECT id FROM ai.capabilities WHERE key = 'extraire_facture'), 1, 1, 'prompt pirate');
    RAISE EXCEPTION 'T18 ÉCHEC : version ajoutée à une capacité scellée';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T18 OK : capacité scellée protégée';
  END;
END $$;
SELECT set_config('app.market_sync', 'on', true);
INSERT INTO ai.capability_versions (capability_id, organization_id, version, system_prompt)
  VALUES ((SELECT id FROM ai.capabilities WHERE key = 'extraire_facture'), 1, 1, 'prompt éditeur');
SELECT set_config('app.market_sync', '', true);

-- T19 : un agent peut utiliser une capacité de son organisation, jamais celle d'un autre client
INSERT INTO agent.capability_grants (agent_version_id, organization_id, capability_id)
  VALUES (1, 1, (SELECT id FROM ai.capabilities WHERE key = 'extraire_facture'));
INSERT INTO ai.capabilities (organization_id, workspace_id, key, name) VALUES (2, 2, 'resume', 'Résumé Beta');
DO $$ BEGIN
  BEGIN
    INSERT INTO agent.capability_grants (agent_version_id, organization_id, capability_id)
      VALUES (1, 1, (SELECT id FROM ai.capabilities WHERE organization_id = 2 AND key = 'resume'));
    RAISE EXCEPTION 'T19 ÉCHEC : capacité d''un autre client accordée';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'T19 OK : capacités accordées aux agents dans la même organisation uniquement';
  END;
END $$;

-- T20 : repli « échouer » accepté ; valeur inconnue refusée
DO $$ BEGIN
  BEGIN
    INSERT INTO agent.versions (agent_id, organization_id, version_seq, objective, model_fallback)
      VALUES (1, 1, 2, 'x', 'autre');
    RAISE EXCEPTION 'T20 ÉCHEC : valeur de repli inconnue acceptée';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T20 OK : repli du modèle contrôlé';
  END;
END $$;

-- T21 : stockage (D52) — un seul backend d'écriture par région, jamais sur un backend inactif,
--       chaque fichier sait où il est, pas de migration d'un backend vers lui-même
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.backends WHERE is_write_target) <> 1 THEN
    RAISE EXCEPTION 'T21 ÉCHEC : il faut exactement un backend d''écriture par défaut';
  END IF;
  BEGIN
    UPDATE storage.backends SET status = 'active', is_write_target = true WHERE key = 'ovh_gra';
    RAISE EXCEPTION 'T21 ÉCHEC : deux backends d''écriture dans la même région';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE storage.backends SET status = 'read_only' WHERE key = 'local';
    RAISE EXCEPTION 'T21 ÉCHEC : backend d''écriture non actif accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.files (organization_id, purpose, bucket, storage_key, filename, mime_type, size_bytes, data_region_id)
    VALUES (1, 'other', 'cp-files', 'x', 'x.txt', 'text/plain', 1, (SELECT id FROM ref.data_regions WHERE code = 'eu-fr'));
    RAISE EXCEPTION 'T21 ÉCHEC : fichier sans backend accepté';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.backend_migrations (from_backend_id, to_backend_id, reason)
    SELECT id, id, 'test migration' FROM storage.backends WHERE key = 'local';
    RAISE EXCEPTION 'T21 ÉCHEC : migration vers le même backend acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'T21 OK : backends de stockage cohérents (un seul actif en écriture, fichier rattaché)';
END $$;
INSERT INTO storage.files (organization_id, purpose, backend_id, bucket, storage_key, filename, mime_type, size_bytes, data_region_id)
  VALUES (1, 'data_file', (SELECT id FROM storage.backends WHERE key = 'local'), 'cp-files', 'org1/facture.pdf',
          'facture.pdf', 'application/pdf', 1024, (SELECT id FROM ref.data_regions WHERE code = 'eu-fr'));

-- -------------------------------------------------------- tests RLS (app_rw)
GRANT app_rw TO CURRENT_USER;
SET LOCAL ROLE app_rw;

-- T11 : sans contexte -> aucune donnée
DO $$ BEGIN
  IF (SELECT count(*) FROM mcp.servers) <> 0 THEN RAISE EXCEPTION 'T11 ÉCHEC : fuite sans contexte'; END IF;
  RAISE NOTICE 'T11 OK : aucune donnée sans contexte d''organisation';
END $$;

-- T12 : client Beta ne voit pas les serveurs, runs, wallets de Kòmerce
SELECT set_config('app.org_id', '2', true), set_config('app.user_id', '2', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM mcp.servers) <> 0
     OR (SELECT count(*) FROM usage.runs) <> 0
     OR (SELECT count(*) FROM billing.credit_wallets) <> 0
     OR (SELECT count(*) FROM audit.events) <> 0 THEN
    RAISE EXCEPTION 'T12 ÉCHEC : fuite inter-tenant';
  END IF;
  RAISE NOTICE 'T12 OK : isolation entre clients (serveurs, runs, wallets, audit)';
END $$;

-- T13 : Beta ne peut pas écrire chez Kòmerce
DO $$ BEGIN
  BEGIN
    INSERT INTO mcp.servers (organization_id, workspace_id, slug, name) VALUES (1, 1, 'pirate', 'x');
    RAISE EXCEPTION 'T13 ÉCHEC : écriture inter-tenant';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T13 OK : écriture inter-tenant refusée par la RLS';
  END;
END $$;

-- T14 : Kòmerce voit ses données ; les rôles système sont partagés
SELECT set_config('app.org_id', '1', true), set_config('app.user_id', '1', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM mcp.servers) <> 1 OR (SELECT count(*) FROM usage.runs) <> 1 THEN
    RAISE EXCEPTION 'T14 ÉCHEC : données propres invisibles';
  END IF;
  IF (SELECT count(*) FROM iam.roles WHERE is_system) <> 5 THEN RAISE EXCEPTION 'T14 ÉCHEC : rôles système'; END IF;
  RAISE NOTICE 'T14 OK : le client voit ses données et les rôles système';
END $$;

-- T15 : sélecteur d'organisation : un utilisateur voit ses organisations via ses adhésions
SELECT set_config('app.org_id', '', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM iam.organizations) <> 1 THEN RAISE EXCEPTION 'T15 ÉCHEC'; END IF;
  RAISE NOTICE 'T15 OK : "mes organisations" sans contexte';
END $$;

-- T16 : un client lit les profils de garde-fous système mais jamais l'IA interne (org 0)
SELECT set_config('app.org_id', '1', true), set_config('app.user_id', '1', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM ai.guardrail_profiles WHERE is_system) < 4 THEN RAISE EXCEPTION 'T16 ÉCHEC : profils système invisibles'; END IF;
  IF (SELECT count(*) FROM ai.capabilities WHERE organization_id = 0) <> 0 THEN RAISE EXCEPTION 'T16 ÉCHEC : IA interne visible'; END IF;
  IF (SELECT count(*) FROM ai.capability_versions WHERE organization_id = 0) <> 0 THEN RAISE EXCEPTION 'T16 ÉCHEC : prompts système visibles'; END IF;
  RAISE NOTICE 'T16 OK : profils système lisibles, prompts système invisibles pour les clients';
END $$;

-- T17 : un client ne peut pas modifier un profil de garde-fous système
DO $$ DECLARE n int; BEGIN
  UPDATE ai.guardrail_profiles SET mode = 'monitor' WHERE is_system;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'T17 ÉCHEC : profil système modifié'; END IF;
  RAISE NOTICE 'T17 OK : profils système non modifiables par un client';
END $$;

-- T22 : un client lit le backend de ses fichiers mais ne modifie jamais le stockage
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM storage.files) <> 1 THEN RAISE EXCEPTION 'T22 ÉCHEC : fichier propre invisible'; END IF;
  IF (SELECT count(*) FROM storage.backends) < 2 THEN RAISE EXCEPTION 'T22 ÉCHEC : backends illisibles'; END IF;
  BEGIN
    UPDATE storage.backends SET is_write_target = false;
    RAISE EXCEPTION 'T22 ÉCHEC : un client a modifié un backend';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM storage.backend_migrations;
    RAISE EXCEPTION 'T22 ÉCHEC : migrations de stockage visibles par un client';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'T22 OK : stockage lisible, jamais modifiable par un client';
END $$;

RESET ROLE;
ROLLBACK;
\echo 'Tous les tests sont passés.'
