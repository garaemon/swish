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
├── apps/web/              Next.js app (OpenNext on Cloudflare Workers)
├── apps/ios/              native iOS app + share extension (XcodeGen)
├── packages/              shared workspace packages (cli, shared)
├── supabase/              local stack config + SQL migrations
├── scripts/               helper scripts (db type generation)
├── mise.toml              pinned CLI tools (supabase, wrangler)
├── package.json           workspace root
├── pnpm-workspace.yaml    apps/* + packages/*
└── Project_Blueprint_Swish.md
```

## iOS app (share sheet)

`apps/ios/` is a native app whose only feature is saving a shared link: pick
Swish from any app's share sheet and the URL is posted to `/api/bookmarks` in
the background.

Sign-in is email + password — the same Supabase account the web app uses. The
app trades those credentials once via `POST /api/auth/token` for a personal
access token, keeps only the token (in a keychain item shared with the share
extension), and never stores the password. Tokens appear under Settings →
Personal access tokens on the web and can be revoked from either side.

Building it needs macOS with Xcode and `brew install xcodegen`; the Xcode
project is generated rather than committed. See
[`apps/ios/README.md`](apps/ios/README.md).

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker (used by the local Supabase stack)
- [mise](https://mise.jdx.dev/) — provides the Supabase CLI and wrangler
  versions pinned in `mise.toml`:

  ```bash
  mise install
  mise exec -- supabase --version
  mise exec -- wrangler --version
  ```

## Local check

```bash
pnpm install
pnpm lint
pnpm test
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

The deploy build reads `apps/web/.env.local`, so point its values at
production before deploying. In particular, set `NEXT_PUBLIC_APP_URL` to the
public URL (for example `https://swish.example.com`), not `localhost` — the
bookmarklet template embeds it.

Secrets are set with `wrangler secret put` (run from `apps/web`):

```bash
cd apps/web
mise exec -- wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # full DB access, bypasses RLS
mise exec -- wrangler secret put MASTER_KEY                  # AES-256-GCM master key
mise exec -- wrangler secret put JWT_SECRET                  # PAT signing secret (HS256)
```

### Database migrations

Link the repo to the Supabase Cloud project once, then push the SQL
migrations in `supabase/migrations/`:

```bash
mise exec -- supabase link --project-ref <project-ref>
mise exec -- supabase db push
```

`supabase db push --dry-run` lists pending migrations without applying them.

### Rate limiting `/api/auth/token`

`POST /api/auth/token` trades an email + password for a personal access token
so native clients can sign in. Supabase's own per-IP sign-in limit sees the
Worker's egress IP rather than the caller's, which collapses it into one bucket
shared by every request. Add a Cloudflare WAF rate-limiting rule on that path
(for example 10 requests per minute per IP) when deploying publicly.

### Build and deploy

Build, preview locally on workerd, and deploy:

```bash
pnpm --filter web run preview   # build + run on local workerd
pnpm --filter web run deploy    # build + deploy to Cloudflare
```

The `run` keyword is required: `pnpm deploy` is a pnpm built-in command, so
`pnpm --filter web deploy` invokes that built-in instead of the package
script and fails with `ERR_PNPM_INVALID_DEPLOY_TARGET`.

### User accounts

The app has no self-service signup flow by design; the login page only signs
in existing users. Create accounts from the Supabase Dashboard:

1. Open Authentication → Users → "Add user" → "Create new user".
2. Enter an email and password, and enable "Auto Confirm User".

A database trigger (`handle_new_user`) seeds `profiles` and `user_settings`
for every new auth user, so no further setup is needed.
