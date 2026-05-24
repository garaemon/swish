-- handle_new_user fires when GoTrue inserts into auth.users. It mirrors the
-- new id into public.profiles and seeds user_settings with column defaults
-- so the rest of the app can rely on each user having exactly one row in
-- both tables from signup time. Settings PUT also upserts as belt-and-braces.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
-- security definer runs the body as the function owner (postgres / migration
-- runner), not the caller (supabase_auth_admin). The caller has no direct
-- INSERT grant on public.profiles or public.user_settings, and RLS on those
-- tables would block writes from auth.uid() = null at signup time — security
-- definer bypasses both. set search_path = public is the standard hardening
-- that pairs with it: pin the schema lookup so a search_path attack cannot
-- redirect the inserts to a malicious same-named table.
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
