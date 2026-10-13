-- migrate:up

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- =============================================================================
-- 0005_auth_google_error_codes.sql — codes d'erreur de la connexion Google (P2.3, D67)
-- Migration de DONNÉES uniquement : aucune table, colonne, index ni RLS. iam.user_identities (baseline) suffit.
-- Même motif que 0002 / 0004 : doc_path = '/errors/' || lower(code), catégorie = 1er segment.
-- Idempotent ET convergent (cp-database §8) : DO UPDATE rétablit les valeurs de référence au rejeu.
-- =============================================================================

INSERT INTO platform.error_codes (code, category, http_status, message, is_retryable, refunds_credits, doc_path)
SELECT c, split_part(c, '_', 1), h, jsonb_build_object('fr', fr, 'en', en), rt, rf, '/errors/' || lower(c)
FROM (VALUES
  ('AUTH_SOCIAL_FLOW_INVALID',422,'La connexion a expiré ou n''est pas valide. Recommencez.','Sign-in expired or is invalid. Try again.',false,false),
  ('AUTH_SOCIAL_EMAIL_UNVERIFIED',422,'Google ne peut pas garantir cette adresse e-mail. Inscrivez-vous avec votre e-mail.','Google can''t vouch for this email address. Sign up with your email.',false,false),
  ('AUTH_SOCIAL_PROVIDER_UNAVAILABLE',503,'Connexion avec ce fournisseur momentanément indisponible','Sign-in with this provider is temporarily unavailable',true,false),
  ('AUTH_IDENTITY_ALREADY_LINKED',409,'Ce compte est déjà lié','This account is already linked',false,false),
  ('AUTH_ACCOUNT_NOT_VERIFIED',403,'Vérifiez d''abord votre adresse e-mail','Verify your email address first',false,false),
  ('AUTH_LAST_SIGN_IN_METHOD',409,'Impossible de retirer votre dernier moyen de connexion','You can''t remove your last sign-in method',false,false),
  ('AUTH_REAUTH_REQUIRED',403,'Pour votre sécurité, reconnectez-vous puis réessayez','For your security, sign in again and retry',false,false)
) AS e(c, h, fr, en, rt, rf)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  http_status = EXCLUDED.http_status,
  message = EXCLUDED.message,
  is_retryable = EXCLUDED.is_retryable,
  refunds_credits = EXCLUDED.refunds_credits,
  doc_path = EXCLUDED.doc_path;

-- migrate:down

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DELETE FROM platform.error_codes WHERE code IN (
  'AUTH_SOCIAL_FLOW_INVALID','AUTH_SOCIAL_EMAIL_UNVERIFIED','AUTH_SOCIAL_PROVIDER_UNAVAILABLE',
  'AUTH_IDENTITY_ALREADY_LINKED','AUTH_ACCOUNT_NOT_VERIFIED','AUTH_LAST_SIGN_IN_METHOD','AUTH_REAUTH_REQUIRED');
