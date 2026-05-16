import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { getSupabaseForUser } from '@/lib/supabase/for-request'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const supabase = await getSupabaseForUser(user)
    const { data, error } = await supabase
      .from('items')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('id, is_read')
      .maybeSingle()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ id: data.id, isRead: data.is_read })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
