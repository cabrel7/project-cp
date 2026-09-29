#!/bin/bash
# Demarre PostgreSQL et Redis en natif (sans Docker) pour les sessions cloud.
# Idempotent : ne recree rien si deja lance.
# Usage : bash infra/scripts/dev-native.sh        (demarrer)
#         bash infra/scripts/dev-native.sh stop    (arreter)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

POSTGRES_DB="${POSTGRES_DB:-cp_dev}"
POSTGRES_USER="${POSTGRES_USER:-cp_owner}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-cp_owner_dev}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"

LOCAL_DIR="$ROOT_DIR/.local"
PGDATA="$LOCAL_DIR/pg-data"
REDIS_DIR="$LOCAL_DIR/redis-data"
PID_DIR="$LOCAL_DIR/pids"
LOG_DIR="$LOCAL_DIR/logs"

# PostgreSQL ne peut pas tourner en root ; on utilise l'utilisateur systeme "postgres".
PG_RUNAS=""
if [ "$(id -u)" -eq 0 ]; then
  if id postgres >/dev/null 2>&1; then
    PG_RUNAS="su -s /bin/bash postgres -c"
  else
    echo "ERROR: PostgreSQL ne peut pas tourner en root et l'utilisateur 'postgres' est absent."
    exit 1
  fi
fi

run_pg() {
  if [ -n "$PG_RUNAS" ]; then
    $PG_RUNAS "$*"
  else
    eval "$@"
  fi
}

# ── stop ────────────────────────────────────────────────────────────────
if [ "${1:-}" = "stop" ]; then
  echo "Stopping native dev infrastructure..."
  PG_BIN=""
  for v in 18 17 16 15; do
    [ -x "/usr/lib/postgresql/$v/bin/pg_ctl" ] && PG_BIN="/usr/lib/postgresql/$v/bin" && break
  done
  if [ -n "$PG_BIN" ] && [ -f "$PGDATA/postmaster.pid" ]; then
    run_pg "$PG_BIN/pg_ctl -D $PGDATA stop -m fast" 2>/dev/null && echo "PostgreSQL stopped." || echo "PostgreSQL was not running."
  fi
  if [ -f "$PID_DIR/redis.pid" ]; then
    kill "$(cat "$PID_DIR/redis.pid")" 2>/dev/null && echo "Redis stopped." || echo "Redis was not running."
    rm -f "$PID_DIR/redis.pid"
  fi
  exit 0
fi

# ── start ───────────────────────────────────────────────────────────────
mkdir -p "$PID_DIR" "$LOG_DIR" "$REDIS_DIR"

# Trouver les binaires PostgreSQL
PG_BIN=""
PG_VER=""
for v in 18 17 16 15; do
  if [ -x "/usr/lib/postgresql/$v/bin/initdb" ]; then
    PG_BIN="/usr/lib/postgresql/$v/bin"
    PG_VER="$v"
    break
  fi
done
if [ -z "$PG_BIN" ]; then
  echo "ERROR: aucune installation PostgreSQL trouvee dans /usr/lib/postgresql/*/bin."
  exit 1
fi

echo "=== project-cp dev infrastructure (native) ==="
echo ""

# ── PostgreSQL ──────────────────────────────────────────────────────────
if pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -q 2>/dev/null; then
  echo "PostgreSQL $PG_VER : deja lance sur le port $POSTGRES_PORT."
else
  if [ ! -d "$PGDATA/base" ]; then
    echo "Initialisation du repertoire de donnees PostgreSQL $PG_VER..."
    # Le repertoire doit appartenir a l'utilisateur PG
    if [ -n "$PG_RUNAS" ]; then
      chown postgres:postgres "$LOCAL_DIR"
    fi
    run_pg "$PG_BIN/initdb -D $PGDATA --username=$POSTGRES_USER --auth=trust --encoding=UTF8 --locale=C" >/dev/null
    run_pg "tee -a $PGDATA/postgresql.conf >/dev/null" <<EOCONF
port = $POSTGRES_PORT
unix_socket_directories = '/tmp'
listen_addresses = '127.0.0.1'
EOCONF
    run_pg "tee $PGDATA/pg_hba.conf >/dev/null" <<'EOHBA'
local   all   all                 trust
host    all   all   127.0.0.1/32  trust
host    all   all   ::1/128       trust
EOHBA
  fi

  echo "Demarrage de PostgreSQL $PG_VER..."
  # Creer les sous-repertoires avec les bons droits
  if [ -n "$PG_RUNAS" ]; then
    chown -R postgres:postgres "$PGDATA"
    mkdir -p "$LOG_DIR" && chown postgres:postgres "$LOG_DIR"
  fi
  run_pg "$PG_BIN/pg_ctl -D $PGDATA -l $LOG_DIR/pg.log start" >/dev/null
  for _ in $(seq 1 30); do
    pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -q 2>/dev/null && break
    sleep 0.5
  done

  if ! pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -q 2>/dev/null; then
    echo "ERROR: PostgreSQL n'a pas demarre. Voir $LOG_DIR/pg.log"
    exit 1
  fi

  psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres \
    -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" >/dev/null 2>&1 || true

  if ! psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres \
    -tc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" 2>/dev/null | grep -q 1; then
    psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres \
      -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;" >/dev/null
  fi

  # Installer pgvector si le paquet est disponible mais pas installe
  PGVECTOR_PKG="postgresql-${PG_VER}-pgvector"
  if ! dpkg -l "$PGVECTOR_PKG" 2>/dev/null | grep -q "^ii"; then
    if apt-cache show "$PGVECTOR_PKG" >/dev/null 2>&1; then
      echo "Installation de $PGVECTOR_PKG..."
      apt-get install -y --no-install-recommends "$PGVECTOR_PKG" >/dev/null 2>&1 || \
        echo "WARN: impossible d'installer $PGVECTOR_PKG — l'extension vector sera indisponible."
    fi
  fi

  if ! psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -tc "SELECT 1 FROM pg_roles WHERE rolname = 'cp_rw'" 2>/dev/null | grep -q 1; then
    echo "Creation des roles, utilisateurs et extensions (init-dev.sh)..."
    export PGHOST=127.0.0.1 PGPORT="$POSTGRES_PORT"
    export POSTGRES_USER POSTGRES_DB
    export CP_DB_PASSWORD_RW="${CP_DB_PASSWORD_RW:-cp_rw_dev}"
    export CP_DB_PASSWORD_AUTH="${CP_DB_PASSWORD_AUTH:-cp_auth_dev}"
    export CP_DB_PASSWORD_ADMIN="${CP_DB_PASSWORD_ADMIN:-cp_admin_dev}"
    export CP_DB_PASSWORD_RO="${CP_DB_PASSWORD_RO:-cp_readonly_dev}"
    bash "$ROOT_DIR/infra/postgres/init-dev.sh"
  else
    echo "Roles et extensions deja initialises."
  fi

  echo "PostgreSQL $PG_VER : pret sur le port $POSTGRES_PORT."
fi

# ── Redis ───────────────────────────────────────────────────────────────
if redis-cli -h 127.0.0.1 -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  echo "Redis : deja lance sur le port $REDIS_PORT."
else
  if ! command -v redis-server >/dev/null 2>&1; then
    echo "ERROR: redis-server non installe."
    exit 1
  fi
  echo "Demarrage de Redis..."
  redis-server \
    --port "$REDIS_PORT" \
    --bind 127.0.0.1 \
    --daemonize yes \
    --pidfile "$PID_DIR/redis.pid" \
    --dir "$REDIS_DIR" \
    --appendonly yes \
    --maxmemory 256mb \
    --maxmemory-policy noeviction \
    --logfile "$LOG_DIR/redis.log" >/dev/null
  echo "Redis : pret sur le port $REDIS_PORT."
fi

# ── Services absents ────────────────────────────────────────────────────
echo ""
echo "Services prets :"
echo "  PostgreSQL $PG_VER : 127.0.0.1:$POSTGRES_PORT"
echo "  Redis            : 127.0.0.1:$REDIS_PORT"
echo ""
echo "Services non disponibles en mode natif :"
echo "  SeaweedFS (S3)   : non requis avant P1 (stockage fichiers)"
echo "  Mailpit (SMTP)   : non requis avant P2 (emails)"
echo "  LiteLLM          : non requis avant P4 (gateway IA)"
echo "  Temporal         : non requis avant P2 (agents)"
echo ""
echo "Arreter : bash infra/scripts/dev-native.sh stop"
