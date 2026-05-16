import type { SupabaseClient } from '@supabase/supabase-js'

export async function markProcessing(
  _supabase: SupabaseClient,
  _itemId: string,
): Promise<void> {
  throw new Error('not implemented')
}

export async function markCompleted(
  _supabase: SupabaseClient,
  _itemId: string,
): Promise<void> {
  throw new Error('not implemented')
}

export async function markFailed(
  _supabase: SupabaseClient,
  _itemId: string,
  _error: unknown,
): Promise<void> {
  throw new Error('not implemented')
}
