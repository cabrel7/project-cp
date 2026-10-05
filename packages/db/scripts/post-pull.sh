#!/usr/bin/env bash
set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../src/schema" && pwd)"

# 1. Add @ts-nocheck on schema.ts and relations.ts
# Reason: the generated schema has circular FK references that TypeScript cannot resolve.
for f in "$SCHEMA_DIR"/schema.ts "$SCHEMA_DIR"/relations.ts; do
  if [ -f "$f" ] && ! head -1 "$f" | grep -q '@ts-nocheck'; then
    sed -i '1s|^|// @ts-nocheck — generated circular FK refs\n|' "$f"
  fi
done

# 2. Enforce bigint mode (Invariant 1: IDs, Invariant 7: micro-credits)
sed -i -E '/bigint\(/ s/(bigint\([^)]*mode: )"number"/\1"bigint"/g' "$SCHEMA_DIR/schema.ts"
if grep -Eq 'bigint\([^)]*mode: "number"' "$SCHEMA_DIR/schema.ts"; then
  echo "post-pull: ERROR bigint columns still in number mode" >&2
  exit 1
fi
sed -i '/You can use { mode: "bigint" } if numbers are exceeding js number limitations/d' "$SCHEMA_DIR/schema.ts"

# 3. Replace unknown() with text() (citext, tsvector — safe string fallback)
sed -i 's/unknown(\([^)]*\))/text(\1)/g' "$SCHEMA_DIR/schema.ts"

# 4. Replace bytea TODO comments with clearer marker
sed -i "s|// TODO: failed to parse database type 'bytea'|// customType: bytea (mapped to text; cast to Buffer at app layer)|g" "$SCHEMA_DIR/schema.ts"

# 5. Replace citext TODO comments with clearer marker
sed -i "s|// TODO: failed to parse database type 'citext'|// customType: citext (mapped to text; case-insensitive at DB layer)|g" "$SCHEMA_DIR/schema.ts"

# 6. Replace tstzrange TODO comments with clearer marker
sed -i "s|// TODO: failed to parse database type 'tstzrange'|// customType: tstzrange (mapped to text; parse as [start, end] at app layer)|g" "$SCHEMA_DIR/schema.ts"

# 7. Replace bytea/citext/tstzrange text() calls with proper customType imports
node "$(dirname "${BASH_SOURCE[0]}")/replace-custom-types.mjs" "$SCHEMA_DIR/schema.ts"

# 8. Fix partition table generatedAlwaysAsIdentity with null params
sed -i 's/\.generatedAlwaysAsIdentity({ name: "null", startWith: null, increment: null, minValue: null, maxValue: null })/.generatedAlwaysAsIdentity()/g' "$SCHEMA_DIR/schema.ts"

# 9. Remove duplicate relation properties in relations.ts (generated code bug)
if [ -f "$SCHEMA_DIR/relations.ts" ]; then
  node -e "
const fs = require('fs');
const f = '$SCHEMA_DIR/relations.ts';
let src = fs.readFileSync(f, 'utf8');
src = src.replace(/^(\t\w+: (?:one|many)\([^)]+(?:,\s*\{[^}]*\})?\)),\n\1,$/gm, '\$1,');
fs.writeFileSync(f, src);
"
fi

# 10. Drop RLS policies from the generated schema.
# drizzle-kit pull lists policies in an unspecified order and only emits `using` on the first
# one of a table, so the output changes from one database to another (flaky CI drift check).
# Drizzle is read-only here (invariant 3): RLS lives in the SQL migrations and is covered by the
# SQL tests (T1-T22) and the RLS integration tests of this package.
node "$(dirname "${BASH_SOURCE[0]}")/strip-policies.mjs" "$SCHEMA_DIR/schema.ts"
if grep -q 'pgPolicy' "$SCHEMA_DIR/schema.ts"; then
  echo "post-pull: ERROR pgPolicy still present in schema.ts" >&2
  exit 1
fi

# 11. Remove generated migration artifacts (we use dbmate) but keep hand-written files
rm -f "$SCHEMA_DIR"/*.sql
rm -rf "$SCHEMA_DIR/meta"

echo "post-pull: @ts-nocheck added, bigint enforced, unknown→text, bytea/citext/tstzrange replaced with customType imports, partition nulls fixed, dupes cleaned, RLS policies dropped (SQL is the source), artifacts cleaned"
