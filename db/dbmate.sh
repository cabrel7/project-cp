#!/usr/bin/env bash
# Enveloppe dbmate : config explicite (dbmate 2.36 ne lit AUCUN fichier .dbmaterc).
# - lancé depuis la racine du dépôt : dbmate y charge automatiquement `.env`
#   (DBMATE_DATABASE_URL, ...) sans écraser les variables déjà exportées ;
# - migrations dans db/migrations, pas de dump de schéma (le SQL versionné fait foi) ;
# - attend la base jusqu'à 30 s.
# Usage : bash db/dbmate.sh <up|rollback|status|create|new|...> [args]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

exec dbmate \
  --env DBMATE_DATABASE_URL \
  --migrations-dir ./db/migrations \
  --no-dump-schema \
  --wait --wait-timeout 30s \
  "$@"
