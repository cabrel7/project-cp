#!/usr/bin/env bash
set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../src/schema" && pwd)"

# 1. Enforce bigint mode (Invariant 1: IDs, Invariant 7: micro-credits)
sed -i 's/bigint({ mode: "number" })/bigint({ mode: "bigint" })/g' "$SCHEMA_DIR/schema.ts"
sed -i '/You can use { mode: "bigint" } if numbers are exceeding js number limitations/d' "$SCHEMA_DIR/schema.ts"

# 2. Remove drizzle-kit migration artifacts (we use dbmate)
rm -f "$SCHEMA_DIR"/*.sql
rm -rf "$SCHEMA_DIR/meta"

echo "post-pull: bigint mode enforced, artifacts cleaned"
