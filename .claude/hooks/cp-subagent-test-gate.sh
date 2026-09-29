#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# cp-subagent-test-gate.sh — SubagentStop — project-cp (anti « vert menteur »)
# Quand frontend / backend / database termine, relance UNIQUEMENT les contrôles
# du périmètre modifié :
#   - apps/* et packages/*  → biome check + vitest related (par paquet)
#   - db/migrations/*.sql   → squawk (+ tests SQL si DATABASE_URL_TEST est défini)
# Échec → {"decision":"block","reason":…} : l'agent doit corriger avant de rendre la main.
# Monorepo pnpm : les binaires sont résolus par paquet (pnpm exec).
# ══════════════════════════════════════════════════════════════════════
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
AGENT=$(printf '%s' "$INPUT" | jq -r '.agent_type // .subagent_type // empty')
case "$AGENT" in frontend|backend|database) ;; *) exit 0 ;; esac

# Évite une boucle infinie si le gate a déjà bloqué et que l'agent s'arrête à nouveau
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')

DIR=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
[ -z "$DIR" ] && DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$DIR" 2>/dev/null || exit 0
command -v git >/dev/null 2>&1 || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

CHANGED=$( { git diff --name-only 2>/dev/null
             git diff --name-only --staged 2>/dev/null
             git ls-files --others --exclude-standard 2>/dev/null; } | sort -u )
[ -z "$CHANGED" ] && exit 0
FAIL=""

# ── TypeScript / Vue : par paquet ─────────────────────────────────────
if command -v pnpm >/dev/null 2>&1; then
  PKGS=$(echo "$CHANGED" | grep -E '^(apps|packages)/[^/]+/.*\.(ts|tsx|vue|js|mjs)$' \
         | cut -d/ -f1-2 | sort -u)
  for P in $PKGS; do
    [ -f "$P/package.json" ] || continue
    FILES=$(echo "$CHANGED" | grep -E "^$P/.*\.(ts|tsx|vue|js|mjs)$" | while read -r f; do [ -f "$f" ] && echo "$f"; done)
    [ -z "$FILES" ] && continue
    REL=$(echo "$FILES" | sed "s#^$P/##" | tr '\n' ' ')
    # Biome (lint + format) — rapide, sur les fichiers touchés
    if [ -x node_modules/.bin/biome ] || [ -x "$P/node_modules/.bin/biome" ]; then
      OUT=$(pnpm exec biome check $(echo "$FILES" | tr '\n' ' ') 2>&1) || FAIL="${FAIL}
=== BIOME ${P} (échec) ===
$(echo "$OUT" | tail -40)"
    fi
    # Vitest related — seulement les tests liés aux fichiers touchés
    if [ -x "$P/node_modules/.bin/vitest" ] || [ -x node_modules/.bin/vitest ]; then
      OUT=$( cd "$P" && pnpm exec vitest related --run --passWithNoTests $REL 2>&1 ) || FAIL="${FAIL}
=== VITEST ${P} (échec) ===
$(echo "$OUT" | tail -60)"
    fi
  done
fi

# ── Migrations SQL ─────────────────────────────────────────────────────
MIGS=$(echo "$CHANGED" | grep -E '^db/migrations/.*\.sql$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
if [ -n "$MIGS" ]; then
  for M in $MIGS; do
    grep -q -- '-- migrate:up' "$M"   || FAIL="${FAIL}
=== MIGRATION ${M} : section '-- migrate:up' absente ==="
    grep -q -- '-- migrate:down' "$M" || FAIL="${FAIL}
=== MIGRATION ${M} : section '-- migrate:down' absente (retour arrière obligatoire) ==="
  done
  if command -v squawk >/dev/null 2>&1; then
    OUT=$(squawk $(echo "$MIGS" | grep -v '0001_baseline' | tr '\n' ' ') 2>&1) || FAIL="${FAIL}
=== SQUAWK (échec) ===
$(echo "$OUT" | tail -60)"
  fi
  if [ -n "$DATABASE_URL_TEST" ] && command -v dbmate >/dev/null 2>&1; then
    OUT=$(dbmate --url "$DATABASE_URL_TEST" --no-dump-schema up 2>&1) || FAIL="${FAIL}
=== DBMATE UP sur base de test (échec) ===
$(echo "$OUT" | tail -40)"
    if [ -x db/tests/run.sh ]; then
      OUT=$(DATABASE_URL="$DATABASE_URL_TEST" bash db/tests/run.sh 2>&1) || FAIL="${FAIL}
=== TESTS SQL (échec) ===
$(echo "$OUT" | tail -60)"
    fi
  fi
fi

if [ -n "$FAIL" ]; then
  if [ "$ACTIVE" = "true" ]; then
    # Deuxième arrêt consécutif en échec : on ne bloque plus (évite la boucle), on signale.
    MSG=$(printf '%s' "$FAIL" | tail -c 3000)
    jq -cn --arg c "⚠️ Gate de tests project-cp toujours en échec après correction — signaler à l'orchestrateur :$MSG" \
      '{systemMessage:$c}'
    exit 0
  fi
  MSG=$(printf '%s' "$FAIL" | tail -c 4000)
  jq -cn --arg r "Les contrôles du périmètre modifié ÉCHOUENT. La tâche n'est PAS terminée : corrige le code (pas le test, sauf test faux et justifié) puis relance.$MSG" \
    '{decision:"block",reason:$r}'
fi
exit 0
