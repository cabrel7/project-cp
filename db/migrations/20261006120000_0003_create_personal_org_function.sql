-- migrate:up

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Inscription : création atomique de l'organisation personnelle d'un nouvel utilisateur.
--
-- Pourquoi une fonction SECURITY DEFINER : à l'inscription, l'organisation n'existe pas encore, donc
-- `app.org_id` ne peut pas être posé. Sous le rôle `app_rw` (soumis à la RLS), `INSERT ... RETURNING` sur
-- iam.organizations échoue (policies SELECT org_current / org_member_read non satisfaites), et les INSERT
-- sur iam.memberships / iam.workspaces / iam.environments sont refusés par `tenant_isolation`.
-- La fonction (propriétaire = cp_owner, propriétaire des tables) s'exécute hors RLS ; elle est volontairement
-- étroite : une seule opération, aucune entrée libre autre que des valeurs de colonnes validées par les CHECK/FK.
--
-- Garde-fous :
--  * search_path figé (iam, ref, pg_catalog) : pas d'injection par search_path ; tout le reste est qualifié.
--  * EXECUTE retiré à PUBLIC, accordé à app_rw seulement.
--  * p_user_id doit être l'utilisateur du contexte (util.current_user_id()) et p_user_public_id doit
--    correspondre à cet utilisateur : un appelant app_rw ne peut pas créer d'organisation au nom d'un tiers.
--  * SELECT ... INTO STRICT : région de données ou rôle `owner` système introuvable => erreur explicite.
-- S'exécute dans la transaction de l'appelant (aucun BEGIN/COMMIT) : tout est annulé en cas d'échec.
CREATE OR REPLACE FUNCTION iam.create_personal_organization(
  p_user_id          bigint,
  p_user_public_id   text,
  p_name             text,
  p_country_code     char(2),
  p_default_currency char(3),
  p_default_locale   text,
  p_data_region_code text
)
RETURNS TABLE (org_id bigint, org_public_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam, ref, pg_catalog
AS $$
DECLARE
  v_region_id     bigint;
  v_role_id       bigint;
  v_org_id        bigint;
  v_org_public_id uuid;
  v_ws_id         bigint;
BEGIN
  -- L'appelant ne peut agir que pour l'utilisateur du contexte, et l'identifiant public doit être le sien.
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM util.current_user_id() THEN
    RAISE EXCEPTION 'create_personal_organization: user context mismatch'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM iam.users u
                 WHERE u.id = p_user_id AND u.public_id::text = p_user_public_id) THEN
    RAISE EXCEPTION 'create_personal_organization: unknown user'
      USING ERRCODE = '42501';
  END IF;

  SELECT dr.id INTO STRICT v_region_id
    FROM ref.data_regions dr WHERE dr.code = p_data_region_code;

  INSERT INTO iam.organizations
    (name, slug, kind, country_code, default_currency, default_locale, data_region_id, created_by_user_id)
  VALUES
    (p_name, 'user-' || p_user_public_id, 'individual', p_country_code, p_default_currency,
     p_default_locale, v_region_id, p_user_id)
  RETURNING id, public_id INTO v_org_id, v_org_public_id;

  SELECT r.id INTO STRICT v_role_id
    FROM iam.roles r
   WHERE r.key = 'owner' AND r.is_system = true AND r.organization_id IS NULL;

  INSERT INTO iam.memberships (organization_id, user_id, role_id, status)
  VALUES (v_org_id, p_user_id, v_role_id, 'active');

  INSERT INTO iam.workspaces (organization_id, name, slug, created_by_user_id)
  VALUES (v_org_id, 'Default', 'default', p_user_id)
  RETURNING id INTO v_ws_id;

  INSERT INTO iam.environments (organization_id, workspace_id, key, name, kind, is_sandbox)
  VALUES (v_org_id, v_ws_id, 'production', 'Production', 'production', false),
         (v_org_id, v_ws_id, 'sandbox',    'Sandbox',    'sandbox',    true);

  RETURN QUERY SELECT v_org_id, v_org_public_id;
END;
$$;

REVOKE ALL ON FUNCTION iam.create_personal_organization(bigint, text, text, char, char, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.create_personal_organization(bigint, text, text, char, char, text, text) TO app_rw;

-- migrate:down

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Retour arrière de cette migration uniquement (aucun client ne dépend encore de la fonction) :
-- squawk-ignore ban-drop-function
DROP FUNCTION IF EXISTS iam.create_personal_organization(bigint, text, text, char, char, text, text);
