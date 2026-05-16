# Swish

Personal RSS / bookmark manager focused on Inbox Zero. Built with Next.js + Supabase + Gemini, intended to run locally during development and deploy to Supabase Cloud + Vercel without code changes.

See `Project Blueprint_ Swish.md` for the full design.

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker (used by the local Supabase stack)
- Supabase CLI v2+ — install the binary directly (the npm package is not pnpm 11 compatible):

  ```bash
  curl -fsSL -o /tmp/supabase.tar.gz \
    https://github.com/supabase/cli/releases/download/v2.98.2/supabase_linux_amd64.tar.gz
  tar xzf /tmp/supabase.tar.gz -C /tmp
  mkdir -p ~/.local/bin && mv /tmp/supabase ~/.local/bin/supabase
  chmod +x ~/.local/bin/supabase
  ```

## First-time setup

```bash
pnpm install
supabase start
```

`supabase start` prints anon / service-role keys and the JWT secret. Copy them into `apps/web/.env.local` (see `.env.example` for the full key list).

Generate the AES master key and the PAT JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # MASTER_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"  # JWT_SECRET
```

## Running

```bash
pnpm --filter web dev          # Next.js dev server on http://localhost:3000
```

## Tests

```bash
pnpm -r test                   # unit tests in every workspace
./scripts/verify/web-up.sh     # liveness probe against a running dev server
./scripts/verify/supabase-up.sh
```
