-- Grant table privileges to the PostgREST API roles. Newer Supabase CLI /
-- Postgres images stopped auto-granting privileges on migration-created
-- public tables, so every API query failed with "permission denied" (42501)
-- before the RLS policies in migration 002 could filter rows. These grants
-- make RLS the actual gatekeeper instead of a blanket table-level denial.
--
-- authenticated only receives the RLS-aware DML verbs; TRUNCATE and
-- REFERENCES are withheld because TRUNCATE bypasses row-level security.
-- service_role is trusted server-side code that already bypasses RLS, so it
-- receives ALL.
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Apply the same defaults to tables added by future migrations so they do
-- not silently fall back to "permission denied" again.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
