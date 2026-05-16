# Swish

Personal RSS / bookmark manager focused on Inbox Zero. Built with Next.js 16 (App Router) + Supabase + Gemini, designed to run locally during development and deploy to Supabase Cloud + Vercel without code changes.

See [`Project Blueprint_ Swish.md`](Project%20Blueprint_%20Swish.md) for the full design.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript |
| DB + Auth | Supabase (PostgreSQL + GoTrue + RLS) |
| AI | Gemini (BYOK; user-supplied API key is AES-256-GCM encrypted at rest) |
| Background jobs | `next/server` `after()` (works in `next dev` and on Vercel without changes) |
| Scraping | `@mozilla/readability` + `jsdom` |
| CLI | `commander`, built with `tsup` as a pnpm workspace package |
| Tests | Vitest (unit + integration), Playwright (manual smoke) |

## Repository layout

```
swish/
├── apps/web/            # Next.js app (UI + API)
├── packages/cli/        # swish add CLI
├── packages/shared/     # API DTOs + bookmarklet template
├── supabase/migrations/ # Source-of-truth SQL migrations
└── scripts/             # verify/* shell helpers + db-types regen
```

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker (used by the local Supabase stack)
- Supabase CLI v2+

Install the Supabase CLI (the npm package is not pnpm 11 compatible; use the binary):

```bash
curl -fsSL -o /tmp/supabase.tar.gz \
  https://github.com/supabase/cli/releases/download/v2.98.2/supabase_linux_amd64.tar.gz
tar xzf /tmp/supabase.tar.gz -C /tmp
mkdir -p ~/.local/bin && mv /tmp/supabase ~/.local/bin/supabase
chmod +x ~/.local/bin/supabase
```

## First-time setup

```bash
# 1. Install workspace dependencies.
pnpm install

# 2. Start the local Supabase stack (PostgreSQL + GoTrue + Studio).
supabase start

# 3. Apply the migrations.
supabase db reset

# 4. Generate DB types.
./scripts/db-types.sh

# 5. Configure apps/web/.env.local:
#    - NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (from `supabase status -o env`)
#    - SUPABASE_SERVICE_ROLE_KEY=...        (from `supabase status -o env`)
#    - MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
#    - JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
#    - NEXT_PUBLIC_APP_URL=http://localhost:3000

# 6. Start the dev server.
pnpm --filter web dev    # http://localhost:3000

# 7. Create a user. The simplest path is the Supabase Studio at
#    http://127.0.0.1:54323 -> Authentication -> Users -> Add user
#    (mark email as confirmed).
```

## Daily use

1. Sign in at `/login`.
2. On `/settings`, paste your Gemini API key (stored AES-encrypted) and tweak the model / language / custom prompt.
3. Save a URL via:
   - the `+ Add URL` button on `/dashboard`, or
   - the bookmarklet generated alongside a fresh PAT on `/settings`, or
   - the CLI:
     ```bash
     pnpm --filter @swish/cli build && pnpm --filter @swish/cli link --global
     swish login    # paste a PAT created on /settings
     swish add https://example.com
     ```
4. Items appear in the inbox; the background pipeline scrapes, summarises, and persists `summary_short` + `summary_long`. Click the title to read; click "Mark read" to archive.

## Tests

```bash
pnpm -r lint                          # tsc + eslint
pnpm -r test                          # unit tests (no DB / network)
pnpm --filter web test:integration    # requires `supabase start` and (mostly) `pnpm dev` running
pnpm -r build                         # production build
```

Helpers under `scripts/verify/`:

- `web-up.sh` — checks `/api/health` returns 200.
- `supabase-up.sh` — checks the Supabase API + DB ports respond.
- `cli-smoke.sh` — builds the CLI and runs `--version`.

## Deploy

Code is structured so the deploy step touches no source files:

1. Provision a Supabase Cloud project.
2. `supabase link --project-ref <ref>` then `supabase db push`.
3. Configure the same env vars on Vercel (`MASTER_KEY` and `JWT_SECRET` MUST be fresh values, not the local ones).
4. `vercel deploy`.

## Key design notes

- **Hybrid auth**: Web UI uses Supabase cookies (RLS scoped by `auth.uid()`); CLI and bookmarklet use a Bearer PAT (HS256 JWT, `jti = personal_access_tokens.id`; revocation is `delete row`). `requireUser` (`lib/auth/guard.ts`) prefers Authorization header over cookie.
- **API key at rest**: AES-256-GCM with a versioned envelope (`v1:iv:ct:tag`) backed by `MASTER_KEY`. The plaintext never leaves the server.
- **Background pipeline**: `after()` from `next/server` schedules `runPipeline(itemId, userId)` so the response returns within milliseconds. The orchestrator marks `processing`, scrapes via Readability, decrypts the per-user Gemini key, summarises, and marks `completed` or `failed`. Vercel-compatible without a code change.
- **Migrations**: raw SQL in `supabase/migrations/` keeps local Docker and Cloud byte-identical.
