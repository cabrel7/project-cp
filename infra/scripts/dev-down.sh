#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Stopping project-cp dev infrastructure..."
docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" \
  --project-name cp-dev \
  down "$@"

echo "Done. Use --volumes to also remove data."
