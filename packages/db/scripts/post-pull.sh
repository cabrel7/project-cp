#!/usr/bin/env bash
set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../src/schema" && pwd)"

# 1. Add @ts-nocheck (generated code has circular FK refs drizzle-kit can't avoid)
for f in "$SCHEMA_DIR"/schema.ts "$SCHEMA_DIR"/relations.ts; do
  if [ -f "$f" ] && ! head -1 "$f" | grep -q '@ts-nocheck'; then
    sed -i '1s|^|// @ts-nocheck\n|' "$f"
  fi
done

# 2. Enforce bigint mode (Invariant 1: IDs, Invariant 7: micro-credits)
# Both forms: bigint({ mode: "number" }) and bigint("col_name", { mode: "number" })
sed -i -E '/bigint\(/ s/(bigint\([^)]*mode: )"number"/\1"bigint"/g' "$SCHEMA_DIR/schema.ts"
if grep -Eq 'bigint\([^)]*mode: "number"' "$SCHEMA_DIR/schema.ts"; then
  echo "post-pull: ERROR bigint columns still in number mode" >&2
  exit 1
fi
sed -i '/You can use { mode: "bigint" } if numbers are exceeding js number limitations/d' "$SCHEMA_DIR/schema.ts"

# 3. Replace unknown() with text() (citext, bytea, tsvector etc. — safe fallback)
sed -i 's/unknown(\([^)]*\))/text(\1)/g' "$SCHEMA_DIR/schema.ts"

# 4. Fix partition table generatedAlwaysAsIdentity with null params
sed -i 's/\.generatedAlwaysAsIdentity({ name: "null", startWith: null, increment: null, minValue: null, maxValue: null })/.generatedAlwaysAsIdentity()/g' "$SCHEMA_DIR/schema.ts"

# 5. Remove duplicate relation properties in relations.ts (drizzle-kit bug)
if [ -f "$SCHEMA_DIR/relations.ts" ]; then
  node -e "
const fs = require('fs');
const f = '$SCHEMA_DIR/relations.ts';
let src = fs.readFileSync(f, 'utf8');
// Remove exact duplicate lines (key: value) within object literals
src = src.replace(/^(\t\w+: (?:one|many)\([^)]+(?:,\s*\{[^}]*\})?\)),\n\1,$/gm, '\$1,');
fs.writeFileSync(f, src);
" 2>/dev/null || true
fi

# 6. Remove drizzle-kit migration artifacts (we use dbmate)
rm -f "$SCHEMA_DIR"/*.sql
rm -rf "$SCHEMA_DIR/meta"

echo "post-pull: @ts-nocheck added, bigint mode enforced, unknown→text, partition nulls fixed, dupes cleaned, artifacts cleaned"
