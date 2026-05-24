-- Indexes for the three hot paths:
--   inbox listing: items filtered by user + is_read, sorted by created_at desc.
--   pipeline scanning: items grouped by process_status.
--   PAT verification: personal_access_tokens looked up by user_id (in addition
--     to the primary-key lookup by jti).

-- The Inbox query is `where user_id = $1 and is_read = false
-- order by created_at desc limit N`. Column order follows the
-- WHERE-then-ORDER-BY shape so the B-tree range scan satisfies both
-- predicate and ordering in a single pass and no separate sort step is
-- needed. The explicit DESC matches the ORDER BY direction; without it
-- the planner could still walk the index but would have to materialise
-- and sort the page slice on every call.
create index if not exists items_user_inbox_idx
  on public.items (user_id, is_read, created_at desc);

-- process_status only takes four values (pending, processing, completed,
-- failed), so naively an index looks wasteful. In practice the distribution
-- is heavily skewed: 'completed' dominates while the other three stay small.
-- Pipeline workers and the retry UI scan the small buckets, where the index
-- is highly selective; queries that touch 'completed' fall back to a seq
-- scan as the planner decides from table statistics. The index gives the
-- planner the option without forcing it.
create index if not exists items_process_status_idx
  on public.items (process_status);

-- Postgres does not auto-create an index on the child side of a FK
-- (unlike MySQL/InnoDB). Without this index, both "list a user's tokens"
-- (where user_id = $1) and the cascade probe triggered by
-- `delete from auth.users` would seq-scan personal_access_tokens. The
-- table's primary-key index covers single-token lookup by jti but does
-- not help user_id filtering.
create index if not exists personal_access_tokens_user_idx
  on public.personal_access_tokens (user_id);
