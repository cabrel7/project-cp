#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if docker info >/dev/null 2>&1; then
  echo "Stopping project-cp dev infrastructure (Docker)..."
  docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" \
    --project-name cp-dev \
    down "$@"
  echo "Done. Use --volumes to also remove data."
else
  echo "Docker non disponible, arret du mode natif..."
  bash "$SCRIPT_DIR/dev-native.sh" stop
fi
