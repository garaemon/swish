/**
 * DELETE /api/items/[id]
 * Permanently removes an item. Cascades to item_tags via the FK. 404 when
 * the id is unknown or belongs to another user (symmetric to keep
 * cross-tenant existence undetectable). Authenticated via cookie or
 * `Authorization: Bearer <PAT>`.
 */
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { getSupabaseForUser } from '@/lib/supabase/client-for-user';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!id) {
      return Response.json({ error: 'missing id' }, { status: 400 });
    }
    const supabase = await getSupabaseForUser(user);
    const { data, error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('id');
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
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
