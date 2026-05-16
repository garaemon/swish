#!/usr/bin/env bash
# Regenerate apps/web/lib/supabase/types.ts from the local Supabase schema.
# Pre-condition: `supabase start` has been run and migrations are applied.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$DIR/apps/web/lib/supabase/types.ts"

supabase gen types typescript --local 2>/dev/null > "$TARGET"
echo "wrote $TARGET"
