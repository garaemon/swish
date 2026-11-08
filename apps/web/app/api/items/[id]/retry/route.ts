/**
 * POST /api/items/[id]/retry
 * Resets the item's process_status back to pending, clears any prior
 * error_message, and re-schedules the pipeline via after(). 404 when the
 * id is unknown or belongs to another user. Authenticated via cookie or
 * `Authorization: Bearer <PAT>`.
 */
import { after } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { items } from '@/lib/db/schema';
import { runPipeline } from '@/lib/pipeline/run';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!id) {
      return Response.json({ error: 'missing id' }, { status: 400 });
    }
    const db = await getDb();

    // Filter by both id and user_id: D1 has no row-level security, so this
    // is what keeps the request from touching another user's item.
    // Returning 404 (rather than 403) for cross-tenant access avoids leaking
    // that the id exists.
    const [updated] = await db
      .update(items)
      .set({ processStatus: 'pending', errorMessage: null })
      .where(and(eq(items.id, id), eq(items.userId, user.userId)))
      .returning({ id: items.id });
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    after(async () => {
      try {
        await runPipeline({ itemId: id, userId: user.userId });
      } catch (cause) {
        console.error('retry runPipeline crashed for item', id, cause);
      }
    });
    return Response.json({ id, status: 'pending' });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
