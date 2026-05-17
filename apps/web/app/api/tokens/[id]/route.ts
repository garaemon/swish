/**
 * DELETE /api/tokens/[id]
 * Revokes a PAT belonging to the auth user. 404 when the id is unknown
 * or belongs to another user. Subsequent uses of the revoked JWT fail
 * verification (verifyPat looks up the row by jti). Authenticated via
 * cookie or `Authorization: Bearer <PAT>`.
 */
import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { getSupabaseForUser } from '@/lib/supabase/for-request'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const supabase = await getSupabaseForUser(user)
    // Delete + returning so we can distinguish "revoked" from "no such id".
    const { data, error } = await supabase
      .from('personal_access_tokens')
      .delete()
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('id')
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
