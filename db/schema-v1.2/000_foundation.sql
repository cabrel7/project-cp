-- =============================================================================
-- 000_foundation.sql — Extensions, schémas, fonctions utilitaires
-- Cible : PostgreSQL 18 (+ pgvector). Nom de code : project-cp
-- =============================================================================
-- CONVENTIONS GLOBALES (appliquées dans tous les fichiers)
--  * IDs hybrides :
--      id        bigint GENERATED ALWAYS AS IDENTITY  -> PK interne, FK, jointures
--      public_id uuid DEFAULT uuidv7()                -> exposé API / URL / SDK
--    Aucun bigint n'est jamais exposé à l'extérieur. UUIDv7 = ordonné dans le temps
--    (bonne localité d'index) et contient son horodatage (uuid_extract_timestamp).
--  * Multi-tenant : toute table appartenant à un client porte organization_id
--    (dénormalisé) -> Row-Level Security + clés étrangères composites
--    (id, organization_id) qui rendent IMPOSSIBLE un lien entre deux tenants.
--  * Argent : montants en unités mineures (bigint amount_minor) + devise ISO.
--    Crédits : bigint en micro-crédits (1 crédit = 1 000 000 µcr).
--  * Statuts : text + CHECK (modifiable par migration, contrairement aux ENUM).
--  * Libellés éditables et traduisibles : jsonb {"fr": "...", "en": "..."}.
--  * Horodatage : timestamptz partout. updated_at maintenu par trigger.
--  * Suppression : deleted_at (soft delete) sur les objets de configuration ;
--    unicités en index partiels WHERE deleted_at IS NULL.
--  * Verrou optimiste : lock_version incrémenté par trigger.
--  * Tables à fort volume : partitionnées par mois (RANGE sur created_at /
--    occurred_at). Pas de FK vers une table partitionnée (intégrité applicative)
--    afin de pouvoir détacher/supprimer les vieilles partitions librement.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;      -- emails / slugs insensibles à la casse
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- recherche floue (admin, marketplace)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- contraintes d'exclusion sur périodes
CREATE EXTENSION IF NOT EXISTS vector;      -- embeddings (tool routing, mémoire agents)
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- digest() pour hachages ponctuels

-- Schémas par domaine
CREATE SCHEMA IF NOT EXISTS util;        -- fonctions techniques
CREATE SCHEMA IF NOT EXISTS ref;         -- référentiels (pays, devises, langues, régions, taxes, change)
CREATE SCHEMA IF NOT EXISTS iam;         -- identité, organisations, workspaces, rôles, OAuth
CREATE SCHEMA IF NOT EXISTS storage;     -- fichiers (objet S3-compatible)
CREATE SCHEMA IF NOT EXISTS billing;     -- plans, abonnements, crédits, paiements, factures, budgets
CREATE SCHEMA IF NOT EXISTS ai;          -- fournisseurs, modèles, prix, routage, capacités, prompts, évals
CREATE SCHEMA IF NOT EXISTS mcp;         -- connecteurs, actions, serveurs MCP, outils, jetons, bridges
CREATE SCHEMA IF NOT EXISTS agent;       -- agents, versions, déclencheurs, approbations, mémoire, chat
CREATE SCHEMA IF NOT EXISTS usage;       -- runs, requêtes LLM, appels d'outils, agrégats
CREATE SCHEMA IF NOT EXISTS dev;         -- clés API, webhooks, idempotence, outbox, utilisateurs finaux
CREATE SCHEMA IF NOT EXISTS market;      -- marketplace
CREATE SCHEMA IF NOT EXISTS ux;          -- état et préférences du frontend
CREATE SCHEMA IF NOT EXISTS notif;       -- notifications
CREATE SCHEMA IF NOT EXISTS compliance;  -- légal, consentements, RGPD / loi 2024-017
CREATE SCHEMA IF NOT EXISTS platform;    -- back-office admin, paramètres, flags, support, modération
CREATE SCHEMA IF NOT EXISTS audit;       -- journal d'audit immuable

-- -----------------------------------------------------------------------------
-- Contexte de session (posé par l'application à chaque transaction)
--   SET LOCAL app.org_id = '123'; SET LOCAL app.user_id = '456';
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION util.current_org_id() RETURNS bigint
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::bigint
$$;

CREATE OR REPLACE FUNCTION util.current_user_id() RETURNS bigint
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::bigint
$$;

-- -----------------------------------------------------------------------------
-- Triggers génériques
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION util.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION util.bump_lock_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END $$;

-- Tables append-only (audit, ledger, snapshots publiés)
CREATE OR REPLACE FUNCTION util.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La table %.% est en ajout seul (% interdit)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

-- -----------------------------------------------------------------------------
-- Partitionnement mensuel : crée les partitions [p_from, p_from + p_months[
-- À appeler par un job planifié (ex : chaque jour, 3 mois d'avance).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION util.ensure_monthly_partitions(
  p_parent regclass, p_from date DEFAULT date_trunc('month', now())::date, p_months int DEFAULT 3
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_schema text;
  v_table  text;
  v_start  date;
  v_end    date;
  v_name   text;
BEGIN
  SELECT n.nspname, c.relname INTO v_schema, v_table
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_parent;

  FOR i IN 0 .. p_months - 1 LOOP
    v_start := (date_trunc('month', p_from) + make_interval(months => i))::date;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := format('%s_p%s', v_table, to_char(v_start, 'YYYYMM'));
    IF to_regclass(format('%I.%I', v_schema, v_name)) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
        v_schema, v_name, p_parent, v_start, v_end);
    END IF;
  END LOOP;
END $$;

-- Crée la partition par défaut (filet de sécurité ; doit rester vide — surveillée)
CREATE OR REPLACE FUNCTION util.ensure_default_partition(p_parent regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_schema text; v_table text;
BEGIN
  SELECT n.nspname, c.relname INTO v_schema, v_table
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_parent;
  IF to_regclass(format('%I.%I', v_schema, v_table || '_default')) IS NULL THEN
    EXECUTE format('CREATE TABLE %I.%I PARTITION OF %s DEFAULT',
                   v_schema, v_table || '_default', p_parent);
  END IF;
END $$;

-- Validation simple d'un objet de traduction {"fr": "...", "en": "..."}
CREATE OR REPLACE FUNCTION util.is_i18n(j jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT jsonb_typeof(j) = 'object' AND j ? 'fr'
$$;
