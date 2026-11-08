/**
 * Items move through one of these state transitions on the pipeline:
 *
 *   pending     <- initial state when a row is inserted
 *   pending     -> processing  (markProcessing)
 *   processing  -> completed   (markCompleted, summaries persisted)
 *   processing  -> failed      (markFailed, error_message set)
 *   failed      -> pending     (retry endpoint resets the row)
 *
 * The legal values are constrained by the CHECK constraint on
 * items.process_status (see lib/db/schema.ts). markProcessing and
 * markCompleted clear error_message so retries cleanly reset state.
 *
 * Every update filters by (id, user_id) so that a caller bug cannot flip
 * another user's row by passing a mismatched (itemId, userId) pair. D1 has
 * no row-level security, so this filter is the only guard.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { items } from '@/lib/db/schema';

/**
 * The legal process_status values, constrained by the CHECK constraint on
 * items.process_status.
 */
export const ProcessStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type ProcessStatus = (typeof ProcessStatus)[keyof typeof ProcessStatus];

function ownedItem(itemId: string, userId: string) {
  return and(eq(items.id, itemId), eq(items.userId, userId));
}

export async function markProcessing(db: Db, itemId: string, userId: string): Promise<void> {
  await db
    .update(items)
    .set({ processStatus: ProcessStatus.Processing, errorMessage: null })
    .where(ownedItem(itemId, userId));
}

export async function markCompleted(db: Db, itemId: string, userId: string): Promise<void> {
  await db
    .update(items)
    .set({ processStatus: ProcessStatus.Completed, errorMessage: null })
    .where(ownedItem(itemId, userId));
}

export async function markFailed(
  db: Db,
  itemId: string,
  userId: string,
  cause: unknown,
): Promise<void> {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown error';
  await db
    .update(items)
    .set({ processStatus: ProcessStatus.Failed, errorMessage: message })
    .where(ownedItem(itemId, userId));
}
