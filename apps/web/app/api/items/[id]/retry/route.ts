/**
 * POST /api/items/[id]/retry
 * Resets the item's process_status back to pending, clears any prior
 * error_message, and re-schedules the pipeline via after(). 404 when the
 * id is unknown or belongs to another user. Authenticated via cookie or
 * `Authorization: Bearer <PAT>`.
 */
import { after } from 'next/server'
import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { runPipeline } from '@/lib/pipeline/run'
import { getSupabaseForUser } from '@/lib/supabase/for-request'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const supabase = await getSupabaseForUser(user)

    // Filter by both id and user_id so the service-role PAT path cannot
    // accidentally touch another user's item. Returning 404 (rather than
    // 403) for cross-tenant access avoids leaking that the id exists.
    const { data: updated, error: updateError } = await supabase
      .from('items')
      .update({ process_status: 'pending', error_message: null })
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('id')
      .maybeSingle()
    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    after(async () => {
      try {
        await runPipeline({ itemId: id, userId: user.userId })
      } catch (cause) {
        console.error('retry runPipeline crashed for item', id, cause)
      }
    })
    return Response.json({ id, status: 'pending' })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
