#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# cp-session-start.sh — SessionStart — project-cp
# 1. Session cloud (CLAUDE_CODE_REMOTE=true) : prépare l'environnement
#    (.claude/scripts/setup-cloud.sh --quick) et exporte les variables utiles.
# 2. Injecte PROJECT_STATE.md (sauf si le hook global v4 le fait déjà).
# 3. Injecte un état de l'outillage (node, pnpm, ffmpeg, Chromium Playwright, dbmate, squawk).
# ══════════════════════════════════════════════════════════════════════
cat >/dev/null 2>&1
DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$DIR" 2>/dev/null || exit 0

SETUP_LOG=""
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -x "$DIR/.claude/scripts/setup-cloud.sh" ]; then
  SETUP_LOG=$(bash "$DIR/.claude/scripts/setup-cloud.sh" --quick 2>&1 | tail -25)
fi

# Variables persistées pour la session (Chromium préinstallé en cloud)
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  if [ -d /opt/pw-browsers ]; then
    { echo "export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers"
      echo "export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"; } >> "$CLAUDE_ENV_FILE"
  fi
fi

# État du projet — pas de double injection si le hook global v4 est actif
STATE=""
GLOBAL_SET="$HOME/.claude/settings.json"
if ! { [ -f "$GLOBAL_SET" ] && grep -q 'hooks/session-start.sh' "$GLOBAL_SET" 2>/dev/null; }; then
  [ -f "$DIR/PROJECT_STATE.md" ] && STATE=$(head -c 4000 "$DIR/PROJECT_STATE.md")
fi

# Outillage
t(){ command -v "$1" >/dev/null 2>&1 && echo "✓ $1" || echo "✗ $1"; }
PW="✗ chromium"
if [ -d "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" ] || [ -d /opt/pw-browsers ]; then PW="✓ chromium (/opt/pw-browsers — NE PAS lancer 'playwright install')"
elif [ -d "$HOME/.cache/ms-playwright" ]; then PW="✓ chromium (~/.cache/ms-playwright)"; fi
TOOLS="$(t node) · $(t pnpm) · $(t ffmpeg) · ${PW} · $(t dbmate) · $(t squawk) · $(t psql) · $(t docker)"
ENVK="local"; [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && ENVK="cloud"

CTX="project-cp — session ${ENVK}. Outillage : ${TOOLS}"
[ -n "$SETUP_LOG" ] && CTX="${CTX}
Préparation cloud :
${SETUP_LOG}"
[ -n "$STATE" ] && CTX="${CTX}

État du projet (PROJECT_STATE.md) — source de vérité :
${STATE}"
CTX="${CTX}

Rappel : lire CLAUDE.md ; documentation dans docs/reference/ (00-index.md d'abord) ; skills du projet .claude/skills/cp-* ; un outil manquant = le signaler, ne pas contourner."

jq -cn --arg c "$CTX" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
exit 0
