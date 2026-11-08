'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireSessionUserId } from '@/lib/auth/session';
import { getDb, type Db } from '@/lib/db';
import { items, itemTags, tags } from '@/lib/db/schema';

async function ensureTag(db: Db, userId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (trimmed === '') {
    throw new Error('tag name must not be empty');
  }
  // Upsert by (user_id, name) — the unique constraint makes this atomic and
  // avoids the select-then-insert race that would otherwise raise a UNIQUE
  // violation on two near-simultaneous "Add tag X" actions. The no-op SET is
  // what makes RETURNING yield the existing row on conflict.
  const [row] = await db
    .insert(tags)
    .values({ userId, name: trimmed })
    .onConflictDoUpdate({ target: [tags.userId, tags.name], set: { name: trimmed } })
    .returning({ id: tags.id });
  if (!row) {
    throw new Error('failed to upsert tag');
  }
  return row.id;
}

// D1 has no row-level security, so each function verifies parent item
// ownership before touching item_tags. Tag ids are likewise only accepted
// when they belong to the caller (ensureTag scopes by user, removeTag filters
// on the item which is already verified to be the caller's).
async function assertItemOwned(db: Db, userId: string, itemId: string): Promise<void> {
  const row = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .get();
  if (!row) {
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
  const db = await getDb();
  await assertItemOwned(db, userId, itemId);
  const tagId = await ensureTag(db, userId, tagName);
  await db.insert(itemTags).values({ itemId, tagId }).onConflictDoNothing();
  revalidatePath(`/items/${itemId}`);
  return { tagId };
}

export async function removeTag(itemId: string, tagId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = await getDb();
  await assertItemOwned(db, userId, itemId);
  await db
    .delete(itemTags)
    .where(and(eq(itemTags.itemId, itemId), eq(itemTags.tagId, tagId)));
  revalidatePath(`/items/${itemId}`);
}
