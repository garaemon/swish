import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { issuePat } from '@/lib/auth/pat'
import { getSupabaseForUser } from '@/lib/supabase/for-request'
import { TokenCreateSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export type TokenSummary = {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request)
    const supabase = await getSupabaseForUser(user)
    const { data, error } = await supabase
      .from('personal_access_tokens')
      .select('id, name, created_at, expires_at, last_used_at')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const tokens: TokenSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at ?? '',
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    }))
    return Response.json({ tokens })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request)
    const raw = (await request.json().catch(() => null)) as unknown
    const parsed = TokenCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const supabase = await getSupabaseForUser(user)
    const issued = await issuePat({
      userId: user.userId,
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays,
      supabase,
    })
    return Response.json(issued, { status: 201 })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
