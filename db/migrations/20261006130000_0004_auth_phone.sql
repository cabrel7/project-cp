-- migrate:up

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- =============================================================================
-- 0004_auth_phone.sql — connexion / inscription par téléphone + OTP SMS (P2.2)
--   1) codes d'erreur AUTH_OTP_* / AUTH_SMS_UNAVAILABLE (données de référence, idempotent)
--   2) CHECK users_phone_requires_verification (un numéro n'est enregistré que vérifié : anti-squat)
--   3) fonction étroite platform.free_tier_requires_phone_otp() (paramètre non public)
-- Aucune nouvelle table, aucun nouvel index : iam.users (phone_e164 UNIQUE, phone_verified_at) et
-- iam.verification_tokens (purpose 'otp_login', index (target, purpose, created_at DESC)) existent déjà.
-- =============================================================================

-- 1) Codes d'erreur — même motif que 0002 : doc_path = '/errors/' || lower(code), catégorie = 1er segment.
INSERT INTO platform.error_codes (code, category, http_status, message, is_retryable, refunds_credits, doc_path)
SELECT c, split_part(c, '_', 1), h, jsonb_build_object('fr', fr, 'en', en), rt, rf, '/errors/' || lower(c)
FROM (VALUES
  ('AUTH_OTP_INVALID',422,'Code incorrect','Incorrect code',false,false),
  ('AUTH_OTP_EXPIRED',422,'Ce code a expiré','This code has expired',false,false),
  ('AUTH_OTP_ATTEMPTS_EXCEEDED',422,'Trop d''essais pour ce code','Too many attempts for this code',false,false),
  ('AUTH_SMS_UNAVAILABLE',503,'Envoi de SMS indisponible','SMS delivery unavailable',true,false)
) AS e(c, h, fr, en, rt, rf)
ON CONFLICT (code) DO NOTHING;

-- 2) Un numéro n'est enregistré que vérifié (empêche de « squatter » le numéro d'un tiers : le UNIQUE
--    sur phone_e164 bloquerait ensuite son propriétaire légitime).
--    Séquence sûre NOT VALID puis VALIDATE. Les deux restent dans CETTE transaction : le verrou pris par
--    ADD CONSTRAINT est donc conservé pendant le balayage de VALIDATE. Choix assumé : aucune ligne de
--    iam.users n'a de téléphone avant ce lot (P2.1 = e-mail seul), le balayage est négligeable, et
--    lock_timeout / statement_timeout bornent le pire cas. Sur une table volumineuse, VALIDATE devrait
--    passer dans un fichier séparé (transaction distincte, verrou SHARE UPDATE EXCLUSIVE seulement).
--    Bloc DO gardé par pg_constraint : migration rejouable (règle squawk prefer-robust-stmts).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_requires_verification'
                   AND conrelid = 'iam.users'::regclass) THEN
    ALTER TABLE iam.users ADD CONSTRAINT users_phone_requires_verification
      CHECK (phone_e164 IS NULL OR phone_verified_at IS NOT NULL) NOT VALID;
  END IF;
  ALTER TABLE iam.users VALIDATE CONSTRAINT users_phone_requires_verification;
END $$;

-- 3) Lecture étroite du paramètre `free_tier.require_phone_otp`.
--    platform.settings n'est lisible par app_rw que pour is_public = true (policy settings_public) et
--    app_auth n'y a aucun droit : l'API ne peut pas lire ce paramètre. Fonction SECURITY DEFINER à liste
--    fermée : une seule clé, aucun argument, aucun SQL dynamique.
--    * search_path figé (pg_catalog) ; tout est qualifié.
--    * clé absente => true (défaut sûr : on exige la vérification du numéro).
--    * accepte un jsonb booléen (true/false) ou chaîne ("true"/"false").
--    * EXECUTE retiré à PUBLIC, accordé à app_auth et app_rw seulement.
CREATE OR REPLACE FUNCTION platform.free_tier_requires_phone_otp() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT COALESCE((SELECT (s.value #>> '{}')::boolean FROM platform.settings s
                   WHERE s.key = 'free_tier.require_phone_otp'), true) $$;

REVOKE ALL ON FUNCTION platform.free_tier_requires_phone_otp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.free_tier_requires_phone_otp() TO app_auth, app_rw;

-- migrate:down

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Retour arrière de cette migration uniquement (aucun client ne dépend encore de la fonction) :
-- squawk-ignore ban-drop-function
DROP FUNCTION IF EXISTS platform.free_tier_requires_phone_otp();

ALTER TABLE iam.users DROP CONSTRAINT IF EXISTS users_phone_requires_verification;

DELETE FROM platform.error_codes
WHERE code IN (
  'AUTH_OTP_INVALID',
  'AUTH_OTP_EXPIRED',
  'AUTH_OTP_ATTEMPTS_EXCEEDED',
  'AUTH_SMS_UNAVAILABLE'
);
