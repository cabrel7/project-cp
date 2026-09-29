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

echo "Starting project-cp dev infrastructure..."
docker compose -f "$ROOT_DIR/infra/docker-compose.dev.yml" \
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} \
  --project-name cp-dev \
  up -d --wait

echo ""
echo "Services ready:"
echo "  PostgreSQL : localhost:${POSTGRES_PORT:-5432}"
echo "  Redis      : localhost:${REDIS_PORT:-6379}"
echo "  MinIO API  : localhost:${MINIO_API_PORT:-9000}"
echo "  MinIO UI   : localhost:${MINIO_CONSOLE_PORT:-9001}"
echo "  Mailpit UI : localhost:${MAILPIT_UI_PORT:-8025}"
echo "  Mailpit SMTP: localhost:${MAILPIT_SMTP_PORT:-1025}"
echo "  LiteLLM    : localhost:${LITELLM_PORT:-4010}"
echo "  Temporal   : localhost:${TEMPORAL_GRPC_PORT:-7233}"
echo "  Temporal UI: localhost:${TEMPORAL_UI_PORT:-8233}"
