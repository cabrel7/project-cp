#!/bin/bash
# Execute UNE seule fois, a la creation du volume (docker-entrypoint-initdb.d). DEV uniquement.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

  -- Roles applicatifs (NOLOGIN, herites par les users)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw')
      THEN CREATE ROLE app_rw NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth')
      THEN CREATE ROLE app_auth NOLOGIN BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin')
      THEN CREATE ROLE app_admin NOLOGIN BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly')
      THEN CREATE ROLE app_readonly NOLOGIN BYPASSRLS; END IF;
  END \$\$;

  -- Users applicatifs (LOGIN, un par pool de connexion)
  CREATE USER cp_rw       WITH PASSWORD '${CP_DB_PASSWORD_RW:-cp_rw_dev}'         IN ROLE app_rw;
  CREATE USER cp_auth     WITH PASSWORD '${CP_DB_PASSWORD_AUTH:-cp_auth_dev}'     IN ROLE app_auth;
  CREATE USER cp_admin    WITH PASSWORD '${CP_DB_PASSWORD_ADMIN:-cp_admin_dev}'   IN ROLE app_admin;
  CREATE USER cp_readonly WITH PASSWORD '${CP_DB_PASSWORD_RO:-cp_readonly_dev}'   IN ROLE app_readonly;

  -- Extensions
  CREATE EXTENSION IF NOT EXISTS citext;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

EOSQL
