/**
 * GET /api/items?limit&is_read=true|false
 *
 * Returns the auth user's items, newest first. Authenticated via cookie or
 * `Authorization: Bearer <PAT>`. Response items use the shared
 * @swish/shared ItemSummaryDto shape so the CLI / future clients share the
 * contract.
 */
import type { ItemSummaryDto } from '@swish/shared';
import { and, desc, eq } from 'drizzle-orm';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { getDb } from '@/lib/db';
import { items } from '@/lib/db/schema';

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
function asProcessStatus(value: string): ItemSummaryDto['processStatus'] {
  if (value === 'processing' || value === 'completed' || value === 'failed') {
    return value;
  }
  if (value !== 'pending') {
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
    const db = await getDb();
    const conditions = [eq(items.userId, user.userId)];
    if (isRead !== null) {
      conditions.push(eq(items.isRead, isRead));
    }
    let rows;
    try {
      rows = await db
        .select({
          id: items.id,
          url: items.url,
          title: items.title,
          summaryShort: items.summaryShort,
          summaryLong: items.summaryLong,
          processStatus: items.processStatus,
          errorMessage: items.errorMessage,
          isRead: items.isRead,
          sourceType: items.sourceType,
          createdAt: items.createdAt,
        })
        .from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(limit);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'failed to load items' },
        { status: 500 },
      );
    }
    const body: ItemSummaryDto[] = rows.map((row) => ({
      ...row,
      processStatus: asProcessStatus(row.processStatus),
      sourceType: asSourceType(row.sourceType),
    }));
    return Response.json({ items: body });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
