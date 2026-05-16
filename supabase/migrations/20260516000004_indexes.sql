create index if not exists items_user_inbox_idx
  on public.items (user_id, is_read, created_at desc);

create index if not exists items_process_status_idx
  on public.items (process_status);

create index if not exists personal_access_tokens_user_idx
  on public.personal_access_tokens (user_id);
