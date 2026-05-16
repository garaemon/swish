import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { getSupabaseForUser } from '@/lib/supabase/for-request'

export const runtime = 'nodejs'

export type ItemSummary = {
  id: string
  url: string
  title: string | null
  summaryShort: string | null
  summaryLong: string | null
  processStatus: string
  errorMessage: string | null
  isRead: boolean
  sourceType: string
  createdAt: string
}

function parseLimit(value: string | null): number {
  const n = value ? Number(value) : 50
  if (!Number.isFinite(n)) return 50
  return Math.min(Math.max(Math.trunc(n), 1), 200)
}

function parseIsRead(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    const isRead = parseIsRead(url.searchParams.get('is_read'))
    const supabase = await getSupabaseForUser(user)
    let query = supabase
      .from('items')
      .select(
        'id, url, title, summary_short, summary_long, process_status, error_message, is_read, source_type, created_at',
      )
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (isRead !== null) query = query.eq('is_read', isRead)
    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const items: ItemSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      summaryShort: row.summary_short,
      summaryLong: row.summary_long,
      processStatus: row.process_status ?? 'pending',
      errorMessage: row.error_message,
      isRead: row.is_read ?? false,
      sourceType: row.source_type,
      createdAt: row.created_at ?? '',
    }))
    return Response.json({ items })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
