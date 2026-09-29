#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# setup-cloud.sh — prépare une session Claude Code cloud (ou une machine neuve)
# pour project-cp. Idempotent. N'installe RIEN de global dans ~/.claude.
#
#   bash .claude/scripts/setup-cloud.sh           # complet
#   bash .claude/scripts/setup-cloud.sh --quick   # rapide (appelé par le hook SessionStart)
#
# - Chromium : préinstallé en cloud (/opt/pw-browsers) → JAMAIS 'playwright install'.
# - ffmpeg, jq, postgresql-client : via apt si absents (registres autorisés par le proxy).
# - dbmate, squawk : via npm (paquets 'dbmate' et 'squawk-cli') si absents.
# - Dépendances : pnpm install --frozen-lockfile si pnpm-lock.yaml et pas de node_modules.
# ══════════════════════════════════════════════════════════════════════
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$DIR" || exit 0
ok(){ echo "✓ $1"; }; warn(){ echo "⚠ $1"; }
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"
APT_UPDATED=0
apt_i(){ command -v apt-get >/dev/null 2>&1 || return 1
  [ $APT_UPDATED -eq 0 ] && { $SUDO apt-get update -y >/dev/null 2>&1 || true; APT_UPDATED=1; }
  $SUDO apt-get install -y --no-install-recommends "$@" >/dev/null 2>&1; }

# jq (hooks)
command -v jq >/dev/null 2>&1 && ok "jq" || { apt_i jq && ok "jq installé" || warn "jq absent (hooks inactifs)"; }

# Node + pnpm (corepack)
if command -v node >/dev/null 2>&1; then ok "node $(node -v)"
  if ! command -v pnpm >/dev/null 2>&1; then
    (corepack enable >/dev/null 2>&1 && corepack prepare pnpm@latest --activate >/dev/null 2>&1) \
      || npm i -g pnpm >/dev/null 2>&1
    command -v pnpm >/dev/null 2>&1 && ok "pnpm installé" || warn "pnpm non installable"
  else ok "pnpm $(pnpm -v)"; fi
else warn "node absent"; fi

# ffmpeg (skill cp-ffmpeg / débogage vidéo e2e)
command -v ffmpeg >/dev/null 2>&1 && ok "ffmpeg" || { apt_i ffmpeg && ok "ffmpeg installé" || warn "ffmpeg non installé"; }

# Chromium Playwright — vérification seulement
if [ -d /opt/pw-browsers ]; then ok "chromium préinstallé (/opt/pw-browsers)"
elif [ -d "$HOME/.cache/ms-playwright" ]; then ok "chromium (~/.cache/ms-playwright)"
else warn "chromium absent — en LOCAL seulement : pnpm exec playwright install chromium"; fi

if [ $QUICK -eq 0 ]; then
  # psql (tests SQL)
  command -v psql >/dev/null 2>&1 && ok "psql" || { apt_i postgresql-client && ok "psql installé" || warn "psql non installé"; }
  # dbmate / squawk
  command -v dbmate >/dev/null 2>&1 && ok "dbmate" || { npm i -g dbmate >/dev/null 2>&1 && ok "dbmate installé" || warn "dbmate non installé"; }
  command -v squawk >/dev/null 2>&1 && ok "squawk" || { npm i -g squawk-cli >/dev/null 2>&1 && ok "squawk installé" || warn "squawk non installé"; }
fi

# Dépendances du monorepo
if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
  if [ ! -d node_modules ] || [ $QUICK -eq 0 ]; then
    pnpm install --frozen-lockfile >/dev/null 2>&1 && ok "pnpm install" || warn "pnpm install en échec (lancer à la main pour voir l'erreur)"
  else ok "node_modules présent"; fi
else ok "pas encore de pnpm-lock.yaml (monorepo non initialisé)"; fi

# Docker
command -v docker >/dev/null 2>&1 && ok "docker" || warn "docker absent : Testcontainers indisponible → tests d'intégration DB via DATABASE_URL_TEST si fourni"

# Infrastructure native (PostgreSQL + Redis) en mode complet
if [ $QUICK -eq 0 ]; then
  # Installer pgvector si PG est présent mais pgvector non installé
  PG_VER=""
  for v in 18 17 16 15; do
    [ -x "/usr/lib/postgresql/$v/bin/initdb" ] && PG_VER="$v" && break
  done
  if [ -n "$PG_VER" ]; then
    PGVEC_PKG="postgresql-${PG_VER}-pgvector"
    if ! dpkg -l "$PGVEC_PKG" 2>/dev/null | grep -q "^ii"; then
      apt_i "$PGVEC_PKG" && ok "$PGVEC_PKG installé" || warn "$PGVEC_PKG non installé"
    else ok "$PGVEC_PKG"; fi
  fi

  # Démarrer l'infra native si Docker daemon absent
  if ! docker info >/dev/null 2>&1 && [ -f "$DIR/infra/scripts/dev-native.sh" ]; then
    echo ""
    echo "Docker daemon absent — démarrage de l'infra native (PostgreSQL + Redis)..."
    bash "$DIR/infra/scripts/dev-native.sh"
  fi
fi
exit 0
