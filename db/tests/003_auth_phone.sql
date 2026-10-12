-- =============================================================================
-- 003_auth_phone.sql — connexion/inscription par téléphone (P2.2), règles [DB]
--   CA-15 (SQL) : un numéro = un utilisateur (UNIQUE) ; un numéro n'est enregistré que vérifié (CHECK)
--   CA-26 (SQL) : platform.free_tier_requires_phone_otp() (droits, valeur, défaut sûr, preuve de nécessité)
--   CA-39 (SQL) : app_auth n'écrit pas dans iam.verification_tokens
--   Catalogue : les 4 codes AUTH_OTP_* / AUTH_SMS_UNAVAILABLE existent dans platform.error_codes
-- Usage : bash db/tests/run.sh (depuis la racine du projet)
-- Chaque test lève une exception s'il échoue. Tout est dans un ROLLBACK (nettoyage inclus).
-- Les identifiants ne sont jamais codés en dur (les séquences ne sont pas annulées par ROLLBACK).
-- Numéros fictifs « +2376000000xx » : jamais valides pour libphonenumber (préfixe 60), donc sans collision
-- avec les numéros aléatoires des tests d'intégration (qui sont des mobiles valides).
-- =============================================================================
\set QUIET on
\set ON_ERROR_STOP on
BEGIN;

-- ------------------------------------------------------------ jeu de données (propriétaire)
INSERT INTO iam.users (phone_e164, phone_verified_at, full_name, country_code, status)
VALUES ('+237600000011', now(), 'T24 Alice', 'CM', 'active');
INSERT INTO iam.users (email, full_name, status) VALUES ('t24-bruno@acme.cm', 'T24 Bruno', 'active');

-- ============================================================ CA-15 (SQL) : contraintes sous app_rw
SET LOCAL ROLE app_rw;

-- T24-1 : un second utilisateur avec le même numéro vérifié => 23505 sur users_phone_e164_key
DO $$
DECLARE c text;
BEGIN
  BEGIN
    INSERT INTO iam.users (phone_e164, phone_verified_at, full_name, country_code, status)
    VALUES ('+237600000011', now(), 'T24 Autre', 'CM', 'active');
    RAISE EXCEPTION 'T24-1 ÉCHEC : second utilisateur avec le même numéro accepté';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS c = CONSTRAINT_NAME;
    IF c IS DISTINCT FROM 'users_phone_e164_key' THEN
      RAISE EXCEPTION 'T24-1 ÉCHEC : contrainte inattendue (%)', c;
    END IF;
    RAISE NOTICE 'T24-1 OK : 23505 users_phone_e164_key (un numéro = un utilisateur)';
  END;
END $$;

-- T24-2 : un numéro sans phone_verified_at => 23514 users_phone_requires_verification (anti-squat)
DO $$
DECLARE c text;
BEGIN
  BEGIN
    INSERT INTO iam.users (phone_e164, full_name, country_code, status)
    VALUES ('+237600000012', 'T24 Squat', 'CM', 'active');
    RAISE EXCEPTION 'T24-2 ÉCHEC : numéro non vérifié accepté (squat possible)';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS c = CONSTRAINT_NAME;
    IF c IS DISTINCT FROM 'users_phone_requires_verification' THEN
      RAISE EXCEPTION 'T24-2 ÉCHEC : contrainte inattendue (%)', c;
    END IF;
    RAISE NOTICE 'T24-2 OK : 23514 users_phone_requires_verification';
  END;
END $$;

-- T24-3 : même règle en UPDATE (rattacher un numéro non vérifié à un compte e-mail existant)
DO $$
DECLARE c text;
BEGIN
  BEGIN
    UPDATE iam.users SET phone_e164 = '+237600000013' WHERE email = 't24-bruno@acme.cm';
    RAISE EXCEPTION 'T24-3 ÉCHEC : numéro non vérifié accepté en UPDATE';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS c = CONSTRAINT_NAME;
    IF c IS DISTINCT FROM 'users_phone_requires_verification' THEN
      RAISE EXCEPTION 'T24-3 ÉCHEC : contrainte inattendue (%)', c;
    END IF;
    RAISE NOTICE 'T24-3 OK : UPDATE d''un numéro non vérifié refusé';
  END;
END $$;

-- T24-4 : régression P2.1 — un utilisateur e-mail sans téléphone reste valide ; un utilisateur
--         téléphone seul (ni e-mail ni mot de passe) avec numéro vérifié est valide
DO $$
DECLARE n int;
BEGIN
  INSERT INTO iam.users (email, password_hash, full_name, status)
  VALUES ('t24-chloe@acme.cm', 'hash', 'T24 Chloé', 'pending');
  INSERT INTO iam.users (phone_e164, phone_verified_at, full_name, country_code, status)
  VALUES ('+237600000014', now(), 'T24 Dora', 'CM', 'active');
  SELECT count(*) INTO n FROM iam.users
   WHERE (email = 't24-chloe@acme.cm' AND phone_e164 IS NULL)
      OR (phone_e164 = '+237600000014' AND email IS NULL AND password_hash IS NULL AND phone_verified_at IS NOT NULL);
  IF n <> 2 THEN RAISE EXCEPTION 'T24-4 ÉCHEC : % ligne(s) au lieu de 2', n; END IF;
  RAISE NOTICE 'T24-4 OK : e-mail seul et téléphone vérifié seul acceptés';
END $$;

-- T24-5 : un utilisateur vérifié peut être rattaché à un numéro vérifié en UPDATE (phone + phone_verified_at ensemble)
DO $$
BEGIN
  UPDATE iam.users SET phone_e164 = '+237600000015', phone_verified_at = now() WHERE email = 't24-bruno@acme.cm';
  IF NOT FOUND THEN RAISE EXCEPTION 'T24-5 ÉCHEC : UPDATE sans effet'; END IF;
  RAISE NOTICE 'T24-5 OK : rattachement avec vérification accepté';
END $$;

-- ============================================================ CA-39 (SQL) : app_auth en lecture seule sur les jetons
RESET ROLE;
SET LOCAL ROLE app_auth;
DO $$
BEGIN
  BEGIN
    INSERT INTO iam.verification_tokens (purpose, target, token_hash, expires_at)
    VALUES ('otp_login', '+237600000099', '\x00'::bytea, now() + interval '5 minutes');
    RAISE EXCEPTION 'T24-6 ÉCHEC : app_auth a pu écrire dans iam.verification_tokens';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T24-6 OK : app_auth ne peut pas insérer de jeton';
  END;
  BEGIN
    UPDATE iam.verification_tokens SET attempts = attempts + 1 WHERE false;
    RAISE EXCEPTION 'T24-6 ÉCHEC : app_auth a pu modifier iam.verification_tokens';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'T24-6 OK : app_auth ne peut pas modifier de jeton';
  END;
END $$;
RESET ROLE;

-- ============================================================ CA-26 (SQL) : platform.free_tier_requires_phone_otp()
-- T24-7 : droits et définition
DO $$
DECLARE sig regprocedure;
BEGIN
  BEGIN
    sig := 'platform.free_tier_requires_phone_otp()'::regprocedure;
  EXCEPTION WHEN undefined_function THEN
    RAISE EXCEPTION 'T24-7 ÉCHEC : platform.free_tier_requires_phone_otp() n''existe pas';
  END;
  IF NOT has_function_privilege('app_auth', sig, 'EXECUTE') THEN RAISE EXCEPTION 'T24-7 ÉCHEC : app_auth sans EXECUTE'; END IF;
  IF NOT has_function_privilege('app_rw', sig, 'EXECUTE')   THEN RAISE EXCEPTION 'T24-7 ÉCHEC : app_rw sans EXECUTE'; END IF;
  IF has_function_privilege('public', sig, 'EXECUTE')       THEN RAISE EXCEPTION 'T24-7 ÉCHEC : PUBLIC a EXECUTE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.oid = sig AND p.prosecdef
                    AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')) THEN
    RAISE EXCEPTION 'T24-7 ÉCHEC : fonction non SECURITY DEFINER ou search_path non figé';
  END IF;
  RAISE NOTICE 'T24-7 OK : EXECUTE pour app_auth et app_rw, pas pour PUBLIC ; SECURITY DEFINER à search_path figé';
END $$;

-- T24-8 : preuve de nécessité — sous app_rw le paramètre n'est pas lisible (is_public = false),
--         sous app_auth la table n'est même pas accessible
SET LOCAL ROLE app_rw;
SELECT set_config('t24.rw_rows', (SELECT count(*) FROM platform.settings WHERE key = 'free_tier.require_phone_otp')::text, true);
RESET ROLE;
DO $$
BEGIN
  IF current_setting('t24.rw_rows') <> '0' THEN
    RAISE EXCEPTION 'T24-8 ÉCHEC : app_rw lit le paramètre directement (% ligne(s))', current_setting('t24.rw_rows');
  END IF;
  RAISE NOTICE 'T24-8 OK : paramètre invisible de app_rw (la fonction est nécessaire)';
END $$;

-- T24-9 : valeurs renvoyées (seed = true), puis false (jsonb booléen et chaîne), puis true, puis clé absente = true
CREATE TEMP TABLE t24_vals (step text PRIMARY KEY, rw text, auth text);
GRANT ALL ON t24_vals TO app_rw, app_auth;

-- (a) valeur du seed
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('seed', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;
SET LOCAL ROLE app_auth; UPDATE t24_vals SET auth = platform.free_tier_requires_phone_otp()::text WHERE step = 'seed';
RESET ROLE;

-- (b) false (booléen JSON)
UPDATE platform.settings SET value = 'false'::jsonb WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('false_bool', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;
SET LOCAL ROLE app_auth; UPDATE t24_vals SET auth = platform.free_tier_requires_phone_otp()::text WHERE step = 'false_bool';
RESET ROLE;

-- (c) "false" (chaîne JSON)
UPDATE platform.settings SET value = '"false"'::jsonb WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('false_str', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;

-- (d) true
UPDATE platform.settings SET value = 'true'::jsonb WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('true_bool', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;

-- (d') valeur invalide (saisie admin erronée) : défaut sûr = true, jamais une erreur 22P02
--      (sinon /me et la connexion e-mail tomberaient en 500 pour tout le monde)
UPDATE platform.settings SET value = '"maybe"'::jsonb WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('invalid_str', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;
UPDATE platform.settings SET value = '{"x":1}'::jsonb WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_auth; INSERT INTO t24_vals (step, auth) VALUES ('invalid_obj', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;

-- (e) clé absente : défaut sûr = true
DELETE FROM platform.settings WHERE key = 'free_tier.require_phone_otp';
SET LOCAL ROLE app_rw;   INSERT INTO t24_vals (step, rw) VALUES ('absent', platform.free_tier_requires_phone_otp()::text);
RESET ROLE;
SET LOCAL ROLE app_auth; UPDATE t24_vals SET auth = platform.free_tier_requires_phone_otp()::text WHERE step = 'absent';
RESET ROLE;

DO $$
DECLARE r t24_vals;
BEGIN
  SELECT * INTO r FROM t24_vals WHERE step = 'seed';
  IF r.rw IS DISTINCT FROM 'true' OR r.auth IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'T24-9 ÉCHEC : valeur du seed (rw=%, auth=%) au lieu de true/true', r.rw, r.auth;
  END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'false_bool';
  IF r.rw IS DISTINCT FROM 'false' OR r.auth IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'T24-9 ÉCHEC : valeur false (rw=%, auth=%)', r.rw, r.auth;
  END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'false_str';
  IF r.rw IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'T24-9 ÉCHEC : "false" (chaîne) lu comme %', r.rw; END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'true_bool';
  IF r.rw IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'T24-9 ÉCHEC : true lu comme %', r.rw; END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'invalid_str';
  IF r.rw IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'T24-9 ÉCHEC : valeur invalide "maybe" lue comme % (attendu true)', r.rw; END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'invalid_obj';
  IF r.auth IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'T24-9 ÉCHEC : objet JSON lu comme % (attendu true)', r.auth; END IF;
  SELECT * INTO r FROM t24_vals WHERE step = 'absent';
  IF r.rw IS DISTINCT FROM 'true' OR r.auth IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'T24-9 ÉCHEC : clé absente => (rw=%, auth=%) au lieu de true (défaut sûr)', r.rw, r.auth;
  END IF;
  RAISE NOTICE 'T24-9 OK : valeur du seed, false (bool + chaîne), true, clé absente = true (défaut sûr)';
END $$;

-- ============================================================ catalogue d'erreurs
-- T24-10 : les 4 codes existent avec le statut et le caractère relançable de la spec (§3.3)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM platform.error_codes e
   WHERE e.category = 'AUTH' AND NOT e.refunds_credits
     AND ((e.code = 'AUTH_OTP_INVALID'           AND e.http_status = 422 AND NOT e.is_retryable)
       OR (e.code = 'AUTH_OTP_EXPIRED'           AND e.http_status = 422 AND NOT e.is_retryable)
       OR (e.code = 'AUTH_OTP_ATTEMPTS_EXCEEDED' AND e.http_status = 422 AND NOT e.is_retryable)
       OR (e.code = 'AUTH_SMS_UNAVAILABLE'       AND e.http_status = 503 AND e.is_retryable));
  IF n <> 4 THEN RAISE EXCEPTION 'T24-10 ÉCHEC : % code(s) conforme(s) sur 4', n; END IF;
  SELECT count(*) INTO n FROM platform.error_codes e
   WHERE e.code IN ('AUTH_OTP_INVALID','AUTH_OTP_EXPIRED','AUTH_OTP_ATTEMPTS_EXCEEDED','AUTH_SMS_UNAVAILABLE')
     AND e.message ? 'fr' AND e.message ? 'en' AND e.doc_path = '/errors/' || lower(e.code);
  IF n <> 4 THEN RAISE EXCEPTION 'T24-10 ÉCHEC : messages FR/EN ou doc_path manquants (%)', n; END IF;
  RAISE NOTICE 'T24-10 OK : 4 codes AUTH_OTP_* / AUTH_SMS_UNAVAILABLE (statut, relançable, FR/EN, doc_path)';
END $$;

-- T24-11 : données de référence IDEMPOTENTES ET CONVERGENTES (cp-database §8 : INSERT … ON CONFLICT … DO UPDATE).
-- Rejouer l'INSERT de la migration 0004 sur une base où un des 4 codes a été modifié (message, statut HTTP, relançable,
-- chemin de doc) doit REMETTRE les valeurs de la migration ; avec « DO NOTHING » la correction du catalogue dans une
-- migration ultérieure ou un rejeu ne converge jamais. L'instruction est extraite du fichier de migration lui-même
-- (aucune copie à maintenir) : à lancer depuis la racine du dépôt (bash db/tests/run.sh), comme en CI.
\set t24_insert `sed -n '/^INSERT INTO platform.error_codes/,/;[[:space:]]*$/p' db/migrations/*_0004_auth_phone.sql`

-- Garde-fou de l'extraction : un bloc vide ou tronqué ferait « réussir » le test pour une mauvaise raison.
CREATE FUNCTION pg_temp.t24_assert(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN IF NOT ok THEN RAISE EXCEPTION '%', msg; END IF; END $f$;
SELECT pg_temp.t24_assert(
         :'t24_insert' LIKE 'INSERT INTO platform.error_codes%'
         AND :'t24_insert' LIKE '%AUTH_OTP_INVALID%' AND :'t24_insert' LIKE '%AUTH_SMS_UNAVAILABLE%'
         AND :'t24_insert' LIKE '%ON CONFLICT (code) DO %',
         'T24-11 ÉCHEC : bloc INSERT des codes d''erreur introuvable dans la migration 0004 (lancer depuis la racine du dépôt)');

-- Un code voisin hors migration 0004 (P2.1) : il ne doit PAS être touché par le rejeu.
CREATE TEMP TABLE t24_before AS
  SELECT code, http_status, message, is_retryable, doc_path
    FROM platform.error_codes WHERE code = 'AUTH_SIGNUP_CLOSED';

-- Altération des 4 codes : message, statut HTTP, relançable, remboursement, catégorie, chemin de doc.
UPDATE platform.error_codes
   SET message = jsonb_build_object('fr', 'ALTÉRÉ', 'en', 'ALTERED'),
       http_status = 400,
       is_retryable = NOT is_retryable,
       refunds_credits = true,
       doc_path = '/errors/altere'
 WHERE code IN ('AUTH_OTP_INVALID','AUTH_OTP_EXPIRED','AUTH_OTP_ATTEMPTS_EXCEEDED','AUTH_SMS_UNAVAILABLE');

-- Rejeu de l'instruction de la migration (deux fois : idempotence).
:t24_insert
:t24_insert

DO $$
DECLARE n int;
BEGIN
  -- Convergence : les valeurs de la migration sont revenues (statut, relançable, remboursement, doc, messages FR/EN exacts).
  SELECT count(*) INTO n FROM platform.error_codes e
   WHERE e.category = 'AUTH' AND NOT e.refunds_credits
     AND ((e.code = 'AUTH_OTP_INVALID'           AND e.http_status = 422 AND NOT e.is_retryable
             AND e.message = '{"fr": "Code incorrect", "en": "Incorrect code"}'::jsonb)
       OR (e.code = 'AUTH_OTP_EXPIRED'           AND e.http_status = 422 AND NOT e.is_retryable
             AND e.message = '{"fr": "Ce code a expiré", "en": "This code has expired"}'::jsonb)
       OR (e.code = 'AUTH_OTP_ATTEMPTS_EXCEEDED' AND e.http_status = 422 AND NOT e.is_retryable
             AND e.message = '{"fr": "Trop d''essais pour ce code", "en": "Too many attempts for this code"}'::jsonb)
       OR (e.code = 'AUTH_SMS_UNAVAILABLE'       AND e.http_status = 503 AND e.is_retryable
             AND e.message = '{"fr": "Envoi de SMS indisponible", "en": "SMS delivery unavailable"}'::jsonb))
     AND e.doc_path = '/errors/' || lower(e.code);
  IF n <> 4 THEN
    RAISE EXCEPTION 'T24-11 ÉCHEC : % code(s) revenu(s) aux valeurs de la migration après rejeu, 4 attendus (ON CONFLICT DO NOTHING ?)', n;
  END IF;

  -- Idempotence : pas de doublon.
  SELECT count(*) INTO n FROM platform.error_codes
   WHERE code IN ('AUTH_OTP_INVALID','AUTH_OTP_EXPIRED','AUTH_OTP_ATTEMPTS_EXCEEDED','AUTH_SMS_UNAVAILABLE');
  IF n <> 4 THEN RAISE EXCEPTION 'T24-11 ÉCHEC : % ligne(s) pour 4 codes après deux rejeux', n; END IF;

  -- Pas d'effet de bord : un code d'une autre migration est resté identique.
  SELECT count(*) INTO n FROM platform.error_codes e JOIN t24_before b USING (code)
   WHERE e.http_status = b.http_status AND e.message = b.message
     AND e.is_retryable = b.is_retryable AND e.doc_path = b.doc_path;
  IF n <> 1 THEN RAISE EXCEPTION 'T24-11 ÉCHEC : AUTH_SIGNUP_CLOSED modifié par le rejeu de 0004'; END IF;

  RAISE NOTICE 'T24-11 OK : rejeu de l''INSERT de 0004 = valeurs de la migration rétablies, aucun doublon, aucun effet sur les autres codes';
END $$;

-- Nettoyage : tout ce qui précède (utilisateurs, paramètre modifié, ...) est annulé.
ROLLBACK;
