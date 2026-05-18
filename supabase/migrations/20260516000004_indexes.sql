-- Indexes for the three hot paths:
--   inbox listing: items filtered by user + is_read, sorted by created_at desc.
--   pipeline scanning: items grouped by process_status.
--   PAT verification: personal_access_tokens looked up by user_id (in addition
--     to the primary-key lookup by jti).
create index if not exists items_user_inbox_idx
  on public.items (user_id, is_read, created_at desc);

create index if not exists items_process_status_idx
  on public.items (process_status);

create index if not exists personal_access_tokens_user_idx
  on public.personal_access_tokens (user_id);
