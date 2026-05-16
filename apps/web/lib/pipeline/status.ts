import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type Client = SupabaseClient<Database>

export async function markProcessing(supabase: Client, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'processing', error_message: null })
    .eq('id', itemId)
  if (error) throw error
}

export async function markCompleted(supabase: Client, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'completed', error_message: null })
    .eq('id', itemId)
  if (error) throw error
}

export async function markFailed(
  supabase: Client,
  itemId: string,
  cause: unknown,
): Promise<void> {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown error'
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'failed', error_message: message })
    .eq('id', itemId)
  if (error) throw error
}
