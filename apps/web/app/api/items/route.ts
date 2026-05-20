/**
 * GET /api/items?limit&is_read=true|false
 *
 * Returns the auth user's items, newest first. Authenticated via cookie or
 * `Authorization: Bearer <PAT>`. Response items use the shared
 * @swish/shared ItemSummaryDto shape so the CLI / future clients share the
 * contract.
 */
import type { ItemSummaryDto } from '@swish/shared';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { getSupabaseForUser } from '@/lib/supabase/for-request';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parses ?limit=N into [1, MAX_LIMIT], falling back to DEFAULT_LIMIT for
 * missing or non-finite values. Truncates fractional input.
 */
function parseLimit(value: string | null): number {
  const parsed = value ? Number(value) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

function parseIsRead(value: string | null): boolean | null {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return null;
}

// The DB CHECK constraint on items.process_status restricts values to
// (pending, processing, completed, failed). The fallback only fires if a
// future migration loosens that constraint; warn loudly so the drift is
// visible.
function asProcessStatus(value: string | null): ItemSummaryDto['processStatus'] {
  if (value === 'processing' || value === 'completed' || value === 'failed') {
    return value;
  }
  if (value !== null && value !== 'pending') {
    console.warn(`Unexpected items.process_status value: ${value}`);
  }
  return 'pending';
}

// The DB CHECK constraint on items.source_type restricts values to
// (bookmark, rss). Same drift caveat as asProcessStatus.
function asSourceType(value: string): ItemSummaryDto['sourceType'] {
  if (value === 'rss') {
    return 'rss';
  }
  if (value !== 'bookmark') {
    console.warn(`Unexpected items.source_type value: ${value}`);
  }
  return 'bookmark';
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const isRead = parseIsRead(url.searchParams.get('is_read'));
    const supabase = await getSupabaseForUser(user);
    let query = supabase
      .from('items')
      .select(
        'id, url, title, summary_short, summary_long, process_status, error_message, is_read, source_type, created_at',
      )
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (isRead !== null) {
      query = query.eq('is_read', isRead);
    }
    const { data, error } = await query;
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const items: ItemSummaryDto[] = (data ?? []).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      summaryShort: row.summary_short,
      summaryLong: row.summary_long,
      // DB default seeds 'pending' but the generated type is nullable.
      processStatus: asProcessStatus(row.process_status),
      errorMessage: row.error_message,
      isRead: row.is_read ?? false,
      sourceType: asSourceType(row.source_type),
      // DB default `now()` guarantees a value; the generated type only
      // marks it nullable. Cast rather than ?? '' so a future schema
      // change surfaces as a runtime error instead of a junk DTO.
      createdAt: row.created_at as string,
    }));
    return Response.json({ items });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
