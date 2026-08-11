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
├── packages/              shared workspace packages (cli, shared)
├── supabase/              local stack config + SQL migrations
├── scripts/               helper scripts (db type generation)
├── mise.toml              pinned CLI tools (supabase, wrangler)
├── package.json           workspace root
├── pnpm-workspace.yaml    apps/* + packages/*
└── Project_Blueprint_Swish.md
```

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

`ALLOWED_SIGNUP_EMAILS` is optional and read at runtime by the OAuth callback.
It is not sensitive, so set it as a Cloudflare Worker `var` rather than a
secret. Leaving it unset means anyone with a Google account can create an
account on the deployed instance — see "User accounts" below.

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

The login page offers "Continue with Google" and an email + password form.

Google sign-in also creates accounts. Who may create one is controlled by the
optional `ALLOWED_SIGNUP_EMAILS` environment variable — a comma-separated list
of full addresses (`me@example.com`) or domains (`@example.com`):

- unset or empty: anyone with a Google account can sign up;
- set: only matching addresses can create an account. A rejected sign-in is
  rolled back (the auth user is deleted again) and the browser lands back on
  `/login` with an explanatory message.

Existing users always sign in, whether or not their address is on the list.

The allow-list covers Google sign-in only. Supabase still accepts email +
password signups through its own API, so it is not a complete lock on account
creation — see the `TODO (signup bypass)` note in `supabase/config.toml`.

Accounts can also be created by hand from the Supabase Dashboard:

1. Open Authentication → Users → "Add user" → "Create new user".
2. Enter an email and password, and enable "Auto Confirm User".

A database trigger (`handle_new_user`) seeds `profiles` and `user_settings`
for every new auth user — including ones created through Google — so no
further setup is needed.

### Google sign-in setup

Supabase, not the app, talks to Google. Both the local stack and the hosted
project need their own OAuth client configuration.

1. Google Cloud Console → APIs & Services → Credentials → "Create
   credentials" → OAuth client ID → *Web application*.
2. Add the **Supabase** callback as an authorized redirect URI:
   - local: `http://127.0.0.1:54321/auth/v1/callback`
   - production: `https://<project-ref>.supabase.co/auth/v1/callback`

   The app's own `/auth/callback` route is a `redirectTo` target handled by
   Supabase; it does not belong in the Google console.
3. Local stack — export the credentials the Supabase CLI substitutes into
   `supabase/config.toml`, then restart so the change is picked up:

   ```bash
   export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   mise exec -- supabase stop && mise exec -- supabase start
   ```

4. Production — `supabase/config.toml` does not reach the hosted project
   unless you run `supabase config push`, so configure it in the Dashboard:
   Authentication → Providers → Google (enable, paste the client ID and
   secret) and Authentication → URL Configuration (Site URL =
   `NEXT_PUBLIC_APP_URL`, Redirect URLs += `https://<app-host>/**`).

   Leave the Email provider enabled. Turning it off disables password
   *sign-in* as well as signup, locking out every existing user.
