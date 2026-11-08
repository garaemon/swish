/**
 * PUT /api/items/[id]/read
 * Marks an item as read (archives it). 404 when the id is unknown or
 * belongs to another user — symmetric to keep cross-tenant existence
 * undetectable. Authenticated via cookie or `Authorization: Bearer <PAT>`.
 */
import { and, eq } from 'drizzle-orm';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { getDb } from '@/lib/db';
import { items } from '@/lib/db/schema';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!id) {
      return Response.json({ error: 'missing id' }, { status: 400 });
    }
    const db = await getDb();
    const [updated] = await db
      .update(items)
      .set({ isRead: true })
      .where(and(eq(items.id, id), eq(items.userId, user.userId)))
      .returning({ id: items.id, isRead: items.isRead });
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    return Response.json({ id: updated.id, isRead: updated.isRead });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
