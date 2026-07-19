<p align="center">
  <img src="assets/icon.svg" alt="Swish icon" width="160" />
</p>

# Swish

Personal RSS / bookmark manager focused on Inbox Zero. Built with Next.js + Supabase + Gemini, designed to run locally during development and deploy to Supabase Cloud + Cloudflare Workers with only environment-variable changes.

Hosting runs on Cloudflare Workers via the [OpenNext](https://opennext.js.org/cloudflare) adapter; Supabase (Postgres + Auth + RLS) stays as the data layer in both local and production.

See [`Project_Blueprint_Swish.md`](Project_Blueprint_Swish.md) for the full design and [issue #1](https://github.com/garaemon/swish/issues/1) for the PR roadmap landing this on `main` in reviewable slices.

## Repository layout

```
swish/
├── package.json           workspace root
├── pnpm-workspace.yaml    apps/* + packages/*
└── Project_Blueprint_Swish.md
```

## Prerequisites (for the eventual full stack)

- Node.js 22+
- pnpm 11+
- Docker (used by the local Supabase stack once `supabase` is wired up)
- Supabase CLI v2+ — install the binary directly:

  ```bash
  curl -fsSL -o /tmp/supabase.tar.gz \
    https://github.com/supabase/cli/releases/download/v2.98.2/supabase_linux_amd64.tar.gz
  tar xzf /tmp/supabase.tar.gz -C /tmp
  mkdir -p ~/.local/bin && mv /tmp/supabase ~/.local/bin/supabase
  chmod +x ~/.local/bin/supabase
  ```

## Local check

```bash
pnpm install      # resolve workspace (currently no member packages yet)
```

## Deployment (Cloudflare Workers)

Hosting uses the OpenNext Cloudflare adapter. The web app lives in `apps/web`.

Prerequisites:

- A Cloudflare account, and `wrangler login` (or a `CLOUDFLARE_API_TOKEN`) for
  deploy. The Workers AI `toMarkdown` binding used for scraping is remote-only,
  so even local `next dev` / `preview` needs Cloudflare credentials to run the
  scrape pipeline.

Public (non-secret) values — `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` — are needed both at
build time (`next build` inlines `NEXT_PUBLIC_*` into the client bundle) and at
runtime (server code re-reads them). Provide them to the build environment and
as Cloudflare Worker `vars`. See `.env.example` for the full list.

Secrets are set with `wrangler secret put` (run from `apps/web`):

```bash
cd apps/web
wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # full DB access, bypasses RLS
wrangler secret put MASTER_KEY                  # AES-256-GCM master key
wrangler secret put JWT_SECRET                  # PAT signing secret (HS256)
```

Build, preview locally on workerd, and deploy:

```bash
pnpm --filter web preview   # build + run on local workerd
pnpm --filter web deploy    # build + deploy to Cloudflare
```
