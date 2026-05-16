#!/usr/bin/env bash
# Build the CLI and run it with --version. Verifies the binary
# is produced and the entry script runs without runtime errors.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pnpm --filter @swish/cli build >/dev/null
out=$(node "$DIR/packages/cli/dist/index.js" --version)
if [[ "$out" != "0.0.1" ]]; then
  echo "expected version 0.0.1, got: $out" >&2
  exit 1
fi
echo "ok: swish CLI builds and reports $out"
