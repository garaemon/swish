#!/usr/bin/env bash
# Verify the Next.js dev server is reachable and /api/health returns 200.
# Pre-condition: `pnpm --filter web dev` is running.
set -euo pipefail

URL="${SWISH_WEB_URL:-http://localhost:3000}"

status=$(curl -sS -o /dev/null -w '%{http_code}' "$URL/api/health")
if [[ "$status" != "200" ]]; then
  echo "expected 200 from $URL/api/health, got $status" >&2
  exit 1
fi
echo "ok: $URL/api/health -> $status"
