-- Row-level security: every public table is scoped to its owning user via
-- auth.uid(). profiles only allows SELECT and UPDATE because INSERT happens
-- through the handle_new_user trigger (migration 003) and we never DELETE
-- profiles directly — the cascade from auth.users handles user removal.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.personal_access_tokens enable row level security;
alter table public.feeds enable row level security;
alter table public.items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can manage own settings" on public.user_settings
  for all using (auth.uid() = user_id);

create policy "Users can manage own tokens" on public.personal_access_tokens
  for all using (auth.uid() = user_id);

create policy "Users can manage own feeds" on public.feeds
  for all using (auth.uid() = user_id);

create policy "Users can manage own items" on public.items
  for all using (auth.uid() = user_id);

create policy "Users can manage own tags" on public.tags
  for all using (auth.uid() = user_id);

create policy "Users can manage own item_tags" on public.item_tags
  for all using (
    exists (
      select 1 from public.items
      where items.id = item_tags.item_id
        and items.user_id = auth.uid()
    )
  );
