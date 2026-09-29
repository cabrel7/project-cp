#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# cp-guard-pretool.sh — PreToolUse (Write|Edit|MultiEdit) — project-cp
# Bloque une écriture qui violerait un invariant AVANT qu'elle touche le disque.
# Règles : $CLAUDE_PROJECT_DIR/.claude/guard-rules.tsv
# Format TSV : GLOBS_INCLUS <TAB> GLOBS_EXCLUS(- si aucun) <TAB> REGEX(grep -E) <TAB> MESSAGE
# exit 2 = blocage (le message stderr revient à l'agent, qui doit corriger).
#
# Coexistence avec le système global v4 : si le hook global guard-pretool.sh est
# déjà déclaré dans ~/.claude/settings.json, il lit CE MÊME fichier de règles →
# ce hook se retire pour éviter le double contrôle. En session cloud (pas de
# ~/.claude du système v4), c'est lui qui fait le travail.
# ══════════════════════════════════════════════════════════════════════
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0

GLOBAL_SET="$HOME/.claude/settings.json"
if [ -f "$GLOBAL_SET" ] && grep -q 'hooks/guard-pretool.sh' "$GLOBAL_SET" 2>/dev/null \
   && [ -f "$HOME/.claude/hooks/guard-pretool.sh" ]; then
  exit 0
fi

FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0
# Write → content ; Edit → new_string ; MultiEdit → edits[].new_string
CONTENT=$(printf '%s' "$INPUT" | jq -r '
  .tool_input.content
  // .tool_input.new_string
  // ((.tool_input.edits // []) | map(.new_string // "") | join("\n"))
  // empty')
[ -z "$CONTENT" ] && exit 0

RULES="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/guard-rules.tsv"
[ -f "$RULES" ] || exit 0

TMP=$(mktemp); printf '%s' "$CONTENT" > "$TMP"
VIOL=""
while IFS=$'\t' read -r globs excludes regex msg; do
  case "$globs" in ''|'#'*) continue ;; esac
  [ -z "$regex" ] && continue
  matched=0; IFS=',' read -ra GL <<< "$globs"
  for g in "${GL[@]}"; do g=$(echo "$g" | xargs); case "$FILE" in $g) matched=1; break ;; esac; done
  [ "$matched" -eq 0 ] && continue
  if [ -n "$excludes" ] && [ "$excludes" != "-" ]; then
    skip=0; IFS=',' read -ra EX <<< "$excludes"
    for e in "${EX[@]}"; do e=$(echo "$e" | xargs); case "$FILE" in $e) skip=1; break ;; esac; done
    [ "$skip" -eq 1 ] && continue
  fi
  if grep -nE -- "$regex" "$TMP" >/dev/null 2>&1; then
    L=$(grep -nE -- "$regex" "$TMP" | cut -d: -f1 | head -20 | paste -sd, -)
    VIOL="${VIOL}
[${msg}] lignes: ${L}"
  fi
done < "$RULES"
rm -f "$TMP"

if [ -n "$VIOL" ]; then
  echo "BLOQUÉ — violations d'invariants project-cp dans $FILE. Corrige AVANT d'écrire (ne contourne jamais la règle) :$VIOL
Référence : CLAUDE.md (INVARIANTS) et .claude/guard-rules.tsv" >&2
  exit 2
fi
exit 0
