-- migrate:up

-- =============================================================================
-- 0002_auth_error_codes.sql — Codes d'erreur AUTH de l'inscription par e-mail (P2.1)
-- Migration de données idempotente : aucun changement de schéma (DDL).
-- Même motif que la baseline : doc_path = '/errors/' || lower(code), catégorie = 1er segment.
-- =============================================================================

INSERT INTO platform.error_codes (code, category, http_status, message, is_retryable, refunds_credits, doc_path)
SELECT c, split_part(c, '_', 1), h, jsonb_build_object('fr', fr, 'en', en), rt, rf, '/errors/' || lower(c)
FROM (VALUES
  ('AUTH_INVALID_CREDENTIALS',401,'Identifiants invalides','Invalid credentials',false,false),
  ('AUTH_EMAIL_ALREADY_EXISTS',409,'Un compte avec cet e-mail existe déjà','An account with this email already exists',false,false),
  ('AUTH_VERIFICATION_TOKEN_EXPIRED',422,'Ce lien a expiré','This link has expired',false,false),
  ('AUTH_VERIFICATION_TOKEN_INVALID',422,'Ce lien est invalide ou a déjà été utilisé','This link is invalid or has already been used',false,false),
  ('AUTH_PASSWORD_TOO_WEAK',422,'Le mot de passe ne respecte pas les exigences de sécurité','Password does not meet security requirements',false,false),
  ('AUTH_SIGNUP_CLOSED',403,'Les inscriptions ne sont pas ouvertes','Registration is not open',false,false),
  ('AUTH_ACCOUNT_SUSPENDED',403,'Ce compte est suspendu','This account is suspended',false,false)
) AS e(c, h, fr, en, rt, rf)
ON CONFLICT (code) DO NOTHING;

-- migrate:down

DELETE FROM platform.error_codes
WHERE code IN (
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_ALREADY_EXISTS',
  'AUTH_VERIFICATION_TOKEN_EXPIRED',
  'AUTH_VERIFICATION_TOKEN_INVALID',
  'AUTH_PASSWORD_TOO_WEAK',
  'AUTH_SIGNUP_CLOSED',
  'AUTH_ACCOUNT_SUSPENDED'
);
