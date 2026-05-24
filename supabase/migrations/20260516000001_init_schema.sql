-- Initial Swish schema: 7 tables that together model bookmarks, RSS feeds,
-- per-user AI settings, tag membership, and Personal Access Tokens. Every
-- table is owned by a `profiles.id` that mirrors `auth.users.id`. Row-level
-- security policies and the auth-signup trigger land in the next two
-- migrations.
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  created_at timestamp with time zone default now()
);

-- AI defaults match the constants exported from @swish/shared/defaults
-- (added in a later PR). When changing a default here, ship a paired
-- migration that updates the column default — SQL cannot import the TS
-- value at apply time.
create table public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  ai_provider text default 'gemini',
  ai_model text default 'gemini-2.5-flash',
  -- encrypted_api_key stores the AES-256-GCM envelope produced by
  -- lib/crypto/aes.ts (`v1:iv:ct:tag`). It is never decrypted at rest;
  -- only the pipeline that needs to call the model reads it.
  encrypted_api_key text,
  ai_summary_language text default 'English',
  ai_custom_prompt text,
  updated_at timestamp with time zone default now()
);

create table public.personal_access_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  expires_at timestamp with time zone,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table public.feeds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  xml_url text not null,
  site_url text,
  title text,
  last_fetched_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  unique (user_id, xml_url)
);

create table public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  title text,
  content_text text,
  summary_short text,
  summary_long text,
  process_status text default 'pending' check (
    process_status in ('pending', 'processing', 'completed', 'failed')
  ),
  error_message text,
  source_type text not null check (source_type in ('bookmark', 'rss')),
  feed_id uuid references public.feeds(id) on delete set null,
  is_read boolean default false,
  is_archived boolean default false,
  saved_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique (user_id, url)
);

create table public.tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, name)
);

create table public.item_tags (
  item_id uuid references public.items(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (item_id, tag_id)
);
