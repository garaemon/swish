'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { requireSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db/errors';
import { items } from '@/lib/db/schema';
import { runPipeline } from '@/lib/pipeline/run';
import { BookmarkInputSchema } from '@/lib/validation/schemas';

export async function markRead(itemId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = await getDb();
  await db
    .update(items)
    .set({ isRead: true })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  revalidatePath('/dashboard');
}

export async function deleteItem(itemId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = await getDb();
  await db.delete(items).where(and(eq(items.id, itemId), eq(items.userId, userId)));
  revalidatePath('/dashboard');
}

export async function retryItem(itemId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const db = await getDb();
  await db
    .update(items)
    .set({ processStatus: 'pending', errorMessage: null })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  after(async () => {
    try {
      await runPipeline({ itemId, userId });
    } catch (cause) {
      console.error('dashboard retry runPipeline crashed', itemId, cause);
    }
  });
  revalidatePath('/dashboard');
}

export type AddBookmarkResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function addBookmark(rawUrl: string): Promise<AddBookmarkResult> {
  const userId = await requireSessionUserId();
  const parsed = BookmarkInputSchema.safeParse({ url: rawUrl });
  if (!parsed.success) {
    return { ok: false, error: 'invalid url' };
  }
  const db = await getDb();
  let itemId: string;
  try {
    const [inserted] = await db
      .insert(items)
      .values({ userId, url: parsed.data.url, sourceType: 'bookmark' })
      .returning({ id: items.id });
    itemId = inserted.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'already in inbox' };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'failed to insert' };
  }
  after(async () => {
    try {
      await runPipeline({ itemId, userId });
    } catch (cause) {
      console.error('addBookmark runPipeline crashed', itemId, cause);
    }
  });
  revalidatePath('/dashboard');
  return { ok: true, id: itemId };
}
