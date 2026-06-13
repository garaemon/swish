-- Make the privilege set on public tables deterministic for the PostgREST
-- API roles. Older Supabase images auto-granted ALL on public tables to the
-- API roles, while newer ones grant nothing -- which made every query fail
-- with "permission denied" (42501) before the RLS policies in migration 002
-- could filter rows. Revoking first and then granting exactly what each role
-- needs removes that environment dependency.
--
-- authenticated receives only the RLS-aware DML verbs; TRUNCATE, REFERENCES
-- and TRIGGER are withheld because TRUNCATE bypasses row-level security.
-- anon never touches these tables in the app (requests run as authenticated
-- after sign-in), so it keeps no table privileges. service_role is trusted
-- server-side code that already bypasses RLS, so it receives ALL.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Apply the same defaults to tables added by future migrations so they do
-- not silently fall back to the wrong privilege set again.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
