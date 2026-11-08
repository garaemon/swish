/**
 * DELETE /api/items/[id]
 * Permanently removes an item. Cascades to item_tags via the FK. 404 when
 * the id is unknown or belongs to another user (symmetric to keep
 * cross-tenant existence undetectable). Authenticated via cookie or
 * `Authorization: Bearer <PAT>`.
 */
import { and, eq } from 'drizzle-orm';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { getDb } from '@/lib/db';
import { items } from '@/lib/db/schema';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!id) {
      return Response.json({ error: 'missing id' }, { status: 400 });
    }
    const db = await getDb();
    const deleted = await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.userId, user.userId)))
      .returning({ id: items.id });
    if (deleted.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
