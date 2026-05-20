/**
 * Items move through one of these state transitions on the pipeline:
 *
 *   pending     <- initial state when a row is inserted
 *   pending     -> processing  (markProcessing)
 *   processing  -> completed   (markCompleted, summaries persisted)
 *   processing  -> failed      (markFailed, error_message set)
 *   failed      -> pending     (retry endpoint resets the row)
 *
 * The legal values are constrained by the CHECK constraint in the
 * 20260516000001_init_schema.sql migration. markProcessing and
 * markCompleted clear error_message so retries cleanly reset state.
 *
 * Every update filters by (id, user_id) even though the service-role
 * client bypasses RLS, so that a caller bug cannot flip another user's
 * row by passing a mismatched (itemId, userId) pair. Defense in depth.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>

export async function markProcessing(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'processing', error_message: null })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

export async function markCompleted(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'completed', error_message: null })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

export async function markFailed(
  supabase: Client,
  itemId: string,
  userId: string,
  cause: unknown,
): Promise<void> {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown error';
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'failed', error_message: message })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}
