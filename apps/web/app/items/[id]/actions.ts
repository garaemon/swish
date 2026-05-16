'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

async function requireSessionUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return data.user.id
}

async function ensureTag(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('tag name must not be empty')
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .eq('name', trimmed)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name: trimmed })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('failed to create tag')
  return data.id
}

export async function addTag(itemId: string, tagName: string): Promise<void> {
  const userId = await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  const tagId = await ensureTag(supabase, userId, tagName)
  await supabase
    .from('item_tags')
    .upsert({ item_id: itemId, tag_id: tagId }, { onConflict: 'item_id,tag_id' })
  revalidatePath(`/items/${itemId}`)
}

export async function removeTag(itemId: string, tagId: string): Promise<void> {
  await requireSessionUserId()
  const supabase = await createSupabaseServerClient()
  await supabase
    .from('item_tags')
    .delete()
    .eq('item_id', itemId)
    .eq('tag_id', tagId)
  revalidatePath(`/items/${itemId}`)
}
