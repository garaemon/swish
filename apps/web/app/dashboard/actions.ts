'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requireSessionUserId } from '@/lib/auth/session'
import { runPipeline } from '@/lib/pipeline/run'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BookmarkInputSchema } from '@/lib/validation/schemas'

export async function markRead(itemId: string): Promise<void> {
  const userId = await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('items')
    .update({ is_read: true })
    .eq('id', itemId)
    .eq('user_id', userId)
  if (error) throw error
  revalidatePath('/dashboard')
}

export async function retryItem(itemId: string): Promise<void> {
  const userId = await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('items')
    .update({ process_status: 'pending', error_message: null })
    .eq('id', itemId)
    .eq('user_id', userId)
  if (error) throw error
  after(async () => {
    try {
      await runPipeline({ itemId, userId })
    } catch (cause) {
      console.error('dashboard retry runPipeline crashed', itemId, cause)
    }
  })
  revalidatePath('/dashboard')
}

export type AddBookmarkResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function addBookmark(rawUrl: string): Promise<AddBookmarkResult> {
  const userId = await requireSessionUserId()
  const parsed = BookmarkInputSchema.safeParse({ url: rawUrl })
  if (!parsed.success) {
    return { ok: false, error: 'invalid url' }
  }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: userId,
      url: parsed.data.url,
      source_type: 'bookmark',
    })
    .select('id')
    .single()
  if (error || !data) {
    // 23505 = Postgres unique_violation. items has UNIQUE(user_id, url).
    if (error?.code === '23505') {
      return { ok: false, error: 'already in inbox' }
    }
    return { ok: false, error: error?.message ?? 'failed to insert' }
  }
  const itemId = data.id
  after(async () => {
    try {
      await runPipeline({ itemId, userId })
    } catch (cause) {
      console.error('addBookmark runPipeline crashed', itemId, cause)
    }
  })
  revalidatePath('/dashboard')
  return { ok: true, id: itemId }
}
