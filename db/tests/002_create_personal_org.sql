-- =============================================================================
-- 002_create_personal_org.sql — iam.create_personal_organization (inscription)
-- Usage : bash db/tests/run.sh (depuis la racine du projet)
-- Chaque test lève une exception s'il échoue. Tout est dans un ROLLBACK (nettoyage inclus).
-- Les identifiants ne sont jamais codés en dur (les séquences ne sont pas annulées par ROLLBACK).
-- Le rôle applicatif est app_rw (cp_rw en dev en hérite : même RLS, mêmes droits).
-- =============================================================================
\set QUIET on
\set ON_ERROR_STOP on
BEGIN;

-- ------------------------------------------------------------ jeu de données (propriétaire)
INSERT INTO iam.users (email, full_name) VALUES ('t23-alice@acme.cm', 'Alice T23'), ('t23-bruno@beta.ci', 'Bruno T23');
CREATE TEMP TABLE t23 AS
  SELECT (SELECT id        FROM iam.users WHERE email = 't23-alice@acme.cm') AS a_id,
         (SELECT public_id FROM iam.users WHERE email = 't23-alice@acme.cm') AS a_pub,
         (SELECT id        FROM iam.users WHERE email = 't23-bruno@beta.ci') AS b_id,
         (SELECT public_id FROM iam.users WHERE email = 't23-bruno@beta.ci') AS b_pub;
GRANT SELECT ON t23 TO app_rw;

-- ------------------------------------------------------------ bascule vers le rôle applicatif (RLS appliquée)
SET LOCAL ROLE app_rw;
SELECT set_config('app.user_id', a_id::text, true) FROM t23;     -- pas d'app.org_id : l'organisation n'existe pas encore

-- T23-1 : sans la fonction, l'inscription échoue sous RLS (le défaut que la fonction corrige)
DO $$ BEGIN
  BEGIN
    INSERT INTO iam.organizations (name, slug, kind, country_code, default_currency, default_locale, data_region_id, created_by_user_id)
    SELECT 'Direct', 'user-direct', 'individual', 'CM', 'XAF', 'fr', (SELECT id FROM ref.data_regions WHERE code = 'eu-fr'), a_id
      FROM t23
    RETURNING id;
    RAISE EXCEPTION 'T23-1 ÉCHEC : INSERT ... RETURNING direct accepté sous RLS';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T23-1 OK : INSERT ... RETURNING direct refusé par la RLS';
  END;
END $$;

-- T23-2 : la fonction crée organisation, adhésion owner, workspace et 2 environnements
CREATE TEMP TABLE t23_res AS
  SELECT f.org_id, f.org_public_id
    FROM t23, iam.create_personal_organization(a_id, a_pub::text, 'Alice Perso', 'CM', 'XAF', 'fr', 'eu-fr') f;
GRANT SELECT ON t23_res TO app_rw;
SELECT set_config('app.org_id', org_id::text, true) FROM t23_res;   -- contexte de l'organisation créée

DO $$
DECLARE r t23_res; u t23; n int; v text;
BEGIN
  SELECT * INTO r FROM t23_res;
  SELECT * INTO u FROM t23;
  IF r.org_id IS NULL OR r.org_public_id IS NULL THEN RAISE EXCEPTION 'T23-2 ÉCHEC : retour vide'; END IF;

  SELECT slug::text INTO v FROM iam.organizations WHERE id = r.org_id AND public_id = r.org_public_id
     AND kind = 'individual' AND created_by_user_id = u.a_id AND name = 'Alice Perso'
     AND country_code = 'CM' AND default_currency = 'XAF' AND default_locale = 'fr'
     AND data_region_id = (SELECT id FROM ref.data_regions WHERE code = 'eu-fr');
  IF v IS DISTINCT FROM 'user-' || u.a_pub::text THEN RAISE EXCEPTION 'T23-2 ÉCHEC : organisation/slug incorrect (%)', v; END IF;

  SELECT count(*) INTO n FROM iam.memberships m JOIN iam.roles ro ON ro.id = m.role_id
   WHERE m.organization_id = r.org_id AND m.user_id = u.a_id AND m.status = 'active'
     AND ro.key = 'owner' AND ro.is_system AND ro.organization_id IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'T23-2 ÉCHEC : adhésion owner absente (%)', n; END IF;

  SELECT count(*) INTO n FROM iam.workspaces
   WHERE organization_id = r.org_id AND name = 'Default' AND slug = 'default' AND created_by_user_id = u.a_id;
  IF n <> 1 THEN RAISE EXCEPTION 'T23-2 ÉCHEC : workspace absent (%)', n; END IF;

  SELECT count(*) INTO n FROM iam.environments e JOIN iam.workspaces w ON w.id = e.workspace_id AND w.organization_id = e.organization_id
   WHERE e.organization_id = r.org_id AND w.slug = 'default'
     AND ((e.key = 'production' AND e.name = 'Production' AND e.kind = 'production' AND NOT e.is_sandbox)
       OR (e.key = 'sandbox'    AND e.name = 'Sandbox'    AND e.kind = 'sandbox'    AND e.is_sandbox));
  IF n <> 2 THEN RAISE EXCEPTION 'T23-2 ÉCHEC : environnements incorrects (%)', n; END IF;
  SELECT count(*) INTO n FROM iam.environments WHERE organization_id = r.org_id;
  IF n <> 2 THEN RAISE EXCEPTION 'T23-2 ÉCHEC : % environnements au lieu de 2', n; END IF;

  RAISE NOTICE 'T23-2 OK : organisation, adhésion owner, workspace, 2 environnements créés';
END $$;

-- T23-3 : une organisation créée par la fonction est isolée d'une autre (RLS toujours en vigueur)
DO $$
DECLARE u t23; r2 record; n int;
BEGIN
  SELECT * INTO u FROM t23;
  PERFORM set_config('app.user_id', u.b_id::text, true);
  PERFORM set_config('app.org_id', '', true);
  SELECT * INTO r2 FROM iam.create_personal_organization(u.b_id, u.b_pub::text, 'Bruno Perso', 'CI', 'XOF', 'fr', 'eu-fr');
  -- contexte de B : aucune ligne de A visible
  PERFORM set_config('app.org_id', r2.org_id::text, true);
  SELECT count(*) INTO n FROM iam.workspaces WHERE organization_id <> r2.org_id;
  IF n <> 0 THEN RAISE EXCEPTION 'T23-3 ÉCHEC : % workspace(s) d''une autre organisation visibles', n; END IF;
  SELECT count(*) INTO n FROM iam.environments WHERE organization_id <> r2.org_id;
  IF n <> 0 THEN RAISE EXCEPTION 'T23-3 ÉCHEC : % environnement(s) d''une autre organisation visibles', n; END IF;
  SELECT count(*) INTO n FROM iam.organizations WHERE id = (SELECT org_id FROM t23_res);
  IF n <> 0 THEN RAISE EXCEPTION 'T23-3 ÉCHEC : organisation de A visible depuis B'; END IF;
  RAISE NOTICE 'T23-3 OK : isolation entre deux organisations créées par la fonction';
END $$;

-- T23-4 : usurpation refusée (p_user_id différent de l'utilisateur du contexte)
DO $$
DECLARE u t23;
BEGIN
  SELECT * INTO u FROM t23;
  PERFORM set_config('app.user_id', u.a_id::text, true);
  BEGIN
    PERFORM iam.create_personal_organization(u.b_id, u.b_pub::text, 'Usurpation', 'CM', 'XAF', 'fr', 'eu-fr');
    RAISE EXCEPTION 'T23-4 ÉCHEC : création au nom d''un autre utilisateur acceptée';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T23-4 OK : usurpation d''utilisateur refusée';
  END;
  BEGIN
    PERFORM iam.create_personal_organization(u.a_id, u.b_pub::text, 'Mauvais public_id', 'CM', 'XAF', 'fr', 'eu-fr');
    RAISE EXCEPTION 'T23-4 ÉCHEC : public_id incohérent accepté';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T23-4 OK : public_id incohérent refusé';
  END;
END $$;

-- T23-5 : région inconnue => erreur STRICT, et rien n'est créé (savepoint de l'exception)
DO $$
DECLARE u t23; n_before int; n_after int;
BEGIN
  SELECT * INTO u FROM t23;
  PERFORM set_config('app.user_id', u.a_id::text, true);
  SELECT count(*) INTO n_before FROM iam.organizations WHERE created_by_user_id = u.a_id;
  BEGIN
    PERFORM iam.create_personal_organization(u.a_id, u.a_pub::text, 'Région inconnue', 'CM', 'XAF', 'fr', 'nowhere-0');
    RAISE EXCEPTION 'T23-5 ÉCHEC : région inconnue acceptée';
  EXCEPTION WHEN no_data_found THEN RAISE NOTICE 'T23-5 OK : région inconnue refusée (STRICT)';
  END;
  SELECT count(*) INTO n_after FROM iam.organizations WHERE created_by_user_id = u.a_id;
  IF n_after <> n_before THEN RAISE EXCEPTION 'T23-5 ÉCHEC : organisation créée malgré l''erreur'; END IF;
END $$;

-- T23-6 : atomicité — un second appel pour le même utilisateur échoue (slug unique) sans rien laisser
DO $$
DECLARE u t23; n int;
BEGIN
  SELECT * INTO u FROM t23;
  PERFORM set_config('app.user_id', u.a_id::text, true);
  BEGIN
    PERFORM iam.create_personal_organization(u.a_id, u.a_pub::text, 'Doublon', 'CM', 'XAF', 'fr', 'eu-fr');
    RAISE EXCEPTION 'T23-6 ÉCHEC : second appel accepté (slug dupliqué)';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'T23-6 OK : doublon refusé (slug unique)';
  END;
  SELECT count(*) INTO n FROM iam.organizations WHERE created_by_user_id = u.a_id;
  IF n <> 1 THEN RAISE EXCEPTION 'T23-6 ÉCHEC : % organisations pour A', n; END IF;
END $$;

-- ------------------------------------------------------------ droits d'exécution
RESET ROLE;

-- T23-7 : EXECUTE réservé à app_rw (ni PUBLIC, ni app_readonly) ; fonction SECURITY DEFINER à search_path figé
DO $$
DECLARE sig regprocedure := 'iam.create_personal_organization(bigint,text,text,char,char,text,text)'::regprocedure;
BEGIN
  IF NOT has_function_privilege('app_rw', sig, 'EXECUTE') THEN RAISE EXCEPTION 'T23-7 ÉCHEC : app_rw sans EXECUTE'; END IF;
  IF has_function_privilege('app_readonly', sig, 'EXECUTE') THEN RAISE EXCEPTION 'T23-7 ÉCHEC : app_readonly a EXECUTE'; END IF;
  IF has_function_privilege('public', sig, 'EXECUTE')       THEN RAISE EXCEPTION 'T23-7 ÉCHEC : PUBLIC a EXECUTE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = sig AND p.prosecdef
                   AND p.proconfig @> ARRAY['search_path=iam, ref, pg_catalog']) THEN
    RAISE EXCEPTION 'T23-7 ÉCHEC : SECURITY DEFINER / search_path non figé';
  END IF;
  RAISE NOTICE 'T23-7 OK : EXECUTE réservé à app_rw, SECURITY DEFINER, search_path figé';
END $$;

-- Nettoyage : tout ce qui précède (utilisateurs, organisations, ...) est annulé.
ROLLBACK;
