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

The app has no self-service signup flow by design; the login page only signs
in existing users. Create accounts from the Supabase Dashboard:

1. Open Authentication → Users → "Add user" → "Create new user".
2. Enter an email and password, and enable "Auto Confirm User".

A database trigger (`handle_new_user`) seeds `profiles` and `user_settings`
for every new auth user, so no further setup is needed.

## Browser extension (Chrome)

`apps/extension` is a minimal, save-only Chrome extension (Manifest V3, built
with [WXT](https://wxt.dev) + React). It's the richer replacement for the
bookmarklet: clicking the toolbar icon, pressing the shortcut, or using the
right-click menu saves the current page to your Swish inbox via the same
`POST /api/bookmarks` + Personal Access Token flow.

- **Save**: click the toolbar icon (or press `Alt+Shift+S`, or right-click →
  *Save to Swish*, which also works on a link to save it without opening it).
  Feedback is shown as a badge on the icon:
  - green `✓` — saved,
  - amber `∅` — already in inbox,
  - red `!` — error, with a notification explaining what went wrong,
  - red `?` — the server replied with something Swish could not read; check
    your inbox to see whether the page was saved.
- **Open inbox**: right-click the toolbar icon → *Open Swish inbox*.
- **Setup**: on first save with no settings, the options page opens. Enter your
  deployed Swish URL (the `NEXT_PUBLIC_APP_URL`) and a Personal Access Token
  issued in the web app under **Settings → API tokens**. Both are stored in
  `chrome.storage.local` (on-device only — the token is a secret and is never
  synced). The URL must use `https://`; plain `http://` is accepted only for
  `localhost`, `127.0.0.1`, and `[::1]`, because every save sends the token in
  an `Authorization` header.

The extension needs **no host permissions**: `POST /api/bookmarks` already
serves permissive CORS (see `apps/web/lib/http/cors.ts`), so the background
service worker's request is accepted as-is and the extension installs with no
"read your data on all websites" warning.

Develop and build:

```bash
pnpm --filter @swish/extension dev     # launches Chrome with the extension + HMR
pnpm --filter @swish/extension build   # outputs apps/extension/.output/chrome-mv3
pnpm --filter @swish/extension zip      # zip for Chrome Web Store upload
```

To load it manually: build, then open `chrome://extensions`, enable *Developer
mode*, click *Load unpacked*, and select `apps/extension/.output/chrome-mv3`.
Rebind the keyboard shortcut at `chrome://extensions/shortcuts`.
