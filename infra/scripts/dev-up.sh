#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_ARGS=()
if [ -f "$ROOT_DIR/.env" ]; then
  set -a; source "$ROOT_DIR/.env"; set +a
  ENV_ARGS=(--env-file "$ROOT_DIR/.env")
else
  echo "Note: .env absent, valeurs par defaut du compose (cp .env.example .env pour personnaliser)."
fi

# Auto-detection : Docker daemon disponible → compose, sinon → mode natif.
if docker info >/dev/null 2>&1; then
  echo "Starting project-cp dev infrastructure (Docker)..."
  docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" \
    ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} \
    --project-name cp-dev \
    up -d --wait

  echo ""
  echo "Services ready (Docker):"
  echo "  PostgreSQL : localhost:${POSTGRES_PORT:-5432}"
  echo "  Redis      : localhost:${REDIS_PORT:-6379}"
  echo "  SeaweedFS  : localhost:${S3_PORT:-9000} (S3) / localhost:${SEAWEEDFS_MASTER_PORT:-9333} (admin)"
  echo "  Mailpit UI : localhost:${MAILPIT_UI_PORT:-8025}"
  echo "  Mailpit SMTP: localhost:${MAILPIT_SMTP_PORT:-1025}"
  echo "  LiteLLM    : localhost:${LITELLM_PORT:-4010}"
  echo "  Temporal   : localhost:${TEMPORAL_GRPC_PORT:-7233}"
  echo "  Temporal UI: localhost:${TEMPORAL_UI_PORT:-8233}"
else
  echo "Docker non disponible, basculement en mode natif..."
  bash "$SCRIPT_DIR/dev-native.sh"
fi
