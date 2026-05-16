'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { runPipeline } from '@/lib/pipeline/run'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BookmarkInputSchema } from '@/lib/validation/schemas'

async function requireSessionUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return data.user.id
}

export async function markRead(itemId: string): Promise<void> {
  const userId = await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  await supabase
    .from('items')
    .update({ is_read: true })
    .eq('id', itemId)
    .eq('user_id', userId)
  revalidatePath('/dashboard')
}

export async function retryItem(itemId: string): Promise<void> {
  const userId = await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  await supabase
    .from('items')
    .update({ process_status: 'pending', error_message: null })
    .eq('id', itemId)
    .eq('user_id', userId)
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
