'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSessionUserId } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>

async function ensureTag(
  supabase: Client,
  userId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  if (trimmed === '') {
    throw new Error('tag name must not be empty');
  }
  // Upsert by (user_id, name) — the unique constraint makes this atomic and
  // avoids the select-then-insert race that would otherwise produce 23505
  // on two near-simultaneous "Add tag X" actions.
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      { user_id: userId, name: trimmed },
      { onConflict: 'user_id,name', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (error || !data) {
    throw error ?? new Error('failed to upsert tag');
  }
  return data.id;
}

// addTag / removeTag both rely on the cookie-scoped Supabase client whose
// RLS policy on item_tags requires the parent item to belong to auth.uid().
// To make the safety local (so a future migration to PAT-scoped server
// actions does not silently widen access), each function verifies the
// parent item ownership before touching item_tags.
async function assertItemOwned(
  supabase: Client,
  userId: string,
  itemId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('item not found');
  }
}

/**
 * Adds a tag to an item. Returns the real tags.id so the client can use it
 * as the optimistic-row id — calling removeTag with that id will match the
 * DB row instead of silently deleting nothing.
 */
export async function addTag(itemId: string, tagName: string): Promise<{ tagId: string }> {
  const userId = await requireSessionUserId();
  const supabase = await createSupabaseServerClient();
  await assertItemOwned(supabase, userId, itemId);
  const tagId = await ensureTag(supabase, userId, tagName);
  const { error } = await supabase
    .from('item_tags')
    .upsert({ item_id: itemId, tag_id: tagId }, { onConflict: 'item_id,tag_id' });
  if (error) {
    throw error;
  }
  revalidatePath(`/items/${itemId}`);
  return { tagId };
}

export async function removeTag(itemId: string, tagId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const supabase = await createSupabaseServerClient();
  await assertItemOwned(supabase, userId, itemId);
  const { error } = await supabase
    .from('item_tags')
    .delete()
    .eq('item_id', itemId)
    .eq('tag_id', tagId);
  if (error) {
    throw error;
  }
  revalidatePath(`/items/${itemId}`);
}
