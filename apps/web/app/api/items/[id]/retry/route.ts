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
    const { data, error } = await supabase
      .from('items')
      .select('id, user_id')
      .eq('id', id)
      .single()
    if (error || !data) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    if (data.user_id !== user.userId) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    await supabase
      .from('items')
      .update({ process_status: 'pending', error_message: null })
      .eq('id', id)
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
