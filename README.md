# Swish

Personal RSS / bookmark manager focused on Inbox Zero. Built with Next.js + Supabase + Gemini, designed to run locally during development and deploy to Supabase Cloud + Vercel without code changes.

See [`Project Blueprint_ Swish.md`](Project%20Blueprint_%20Swish.md) for the full design and [issue #1](https://github.com/garaemon/swish/issues/1) for the PR roadmap landing this on `main` in reviewable slices.

## Repository layout

```
swish/
├── package.json           workspace root
├── pnpm-workspace.yaml    apps/* + packages/*
└── Project Blueprint_ Swish.md
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
