#!/usr/bin/env bash
# Verify the local Supabase stack is reachable.
# Pre-condition: `supabase start` has been run.
set -euo pipefail

URL="${SWISH_SUPABASE_URL:-http://127.0.0.1:54321}"

# /rest/v1/ requires an API key; just check that the host responds.
status=$(curl -sS -o /dev/null -w '%{http_code}' "$URL")
case "$status" in
  200|301|302|404) ;;
  *)
    echo "expected reachable status from $URL, got $status" >&2
    exit 1
    ;;
esac

if ! nc -z 127.0.0.1 54322 >/dev/null 2>&1; then
  echo "supabase db port 54322 is closed" >&2
  exit 1
fi

echo "ok: supabase API at $URL and db at 127.0.0.1:54322 are up"
