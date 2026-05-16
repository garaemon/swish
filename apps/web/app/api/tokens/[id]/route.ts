import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { revokePat } from '@/lib/auth/pat'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireUser(request)
    const { id } = await context.params
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const supabase = await createSupabaseServerClient()
    await revokePat(id, user.userId, supabase)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
