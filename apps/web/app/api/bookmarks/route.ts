import { after } from 'next/server'
import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { corsHeaders, handleOptions } from '@/lib/http/cors'
import { runPipeline } from '@/lib/pipeline/run'
import { getSupabaseForUser } from '@/lib/supabase/for-request'
import { BookmarkInputSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export function OPTIONS(request: Request): Response {
  return handleOptions(request)
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request.headers.get('origin'))
  try {
    const user = await requireUser(request)
    const raw = (await request.json().catch(() => null)) as unknown
    const parsed = BookmarkInputSchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400, headers: cors },
      )
    }
    const supabase = await getSupabaseForUser(user)
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: user.userId,
        url: parsed.data.url,
        title: parsed.data.title ?? null,
        source_type: 'bookmark',
      })
      .select('id')
      .single()
    if (error || !data) {
      return Response.json(
        { error: error?.message ?? 'failed to insert item' },
        { status: 500, headers: cors },
      )
    }
    const itemId = data.id
    after(async () => {
      try {
        await runPipeline({ itemId, userId: user.userId })
      } catch (cause) {
        console.error('runPipeline crashed for item', itemId, cause)
      }
    })
    return Response.json({ id: itemId, status: 'pending' }, { status: 200, headers: cors })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const headers = new Headers(err.response.headers)
      for (const [k, v] of cors) headers.set(k, v)
      return new Response(err.response.body, { status: err.response.status, headers })
    }
    throw err
  }
}
