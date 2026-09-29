#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

DB="${1:-${POSTGRES_DB:-cp_dev}}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-cp_owner}"
# psql lit PGPASSWORD ; on la dérive de .env (jamais en dur), sans invite interactive.
if [ -z "${PGPASSWORD:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export PGPASSWORD="$POSTGRES_PASSWORD"
fi

echo "=== Tests SQL project-cp ==="
echo "Base : ${DB} (${PGHOST}:${PGPORT}, user: ${PGUSER})"
echo ""

TESTS_DIR="$SCRIPT_DIR"
PASS=0
FAIL=0

for test_file in "$TESTS_DIR"/[0-9][0-9][0-9]_*.sql; do
  [ -f "$test_file" ] || continue
  fname="$(basename "$test_file")"
  echo -n "  $fname ... "
  output=$(psql -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" \
    -v ON_ERROR_STOP=1 -f "$test_file" 2>&1) && rc=0 || rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "OK"
    PASS=$((PASS + 1))
  else
    echo "ÉCHEC"
    FAIL=$((FAIL + 1))
    echo "--- Sortie détaillée ---"
    echo "$output"
    echo "------------------------"
  fi
done

echo ""
echo "Résultat : $PASS réussi(s), $FAIL échoué(s)."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
