#!/usr/bin/env bash
# Recrée la base et applique tous les fichiers dans l'ordre.
# Usage : PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./run_all.sh [nom_base]
set -euo pipefail
DB="${1:-cp}"
cd "$(dirname "$0")"
psql -q -d postgres -c "DROP DATABASE IF EXISTS ${DB};" -c "CREATE DATABASE ${DB};"
for f in $(ls [0-9][0-9][0-9]_*.sql | sort); do
  echo "== ${f}"
  psql -q -d "${DB}" -v ON_ERROR_STOP=1 -f "${f}"
done
echo "Schéma appliqué sur ${DB}."
