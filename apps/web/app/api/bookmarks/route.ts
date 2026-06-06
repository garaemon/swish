/**
 * POST /api/bookmarks { url, title? }
 * Saves a URL and schedules the scrape+summarize pipeline. Returns 200
 * with { id, status: 'pending' } within milliseconds; the pipeline runs
 * after the response is flushed via Next.js after(). 23505 (duplicate URL
 * for this user) surfaces as 409 { error: 'already_in_inbox' }.
 *
 * OPTIONS handles the bookmarklet preflight with CORS headers.
 *
 * Authenticated via cookie or `Authorization: Bearer <PAT>`.
 */
import { after } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { corsHeaders, handleOptions } from '@/lib/http/cors';
import { runPipeline } from '@/lib/pipeline/run';
import { getSupabaseForUser } from '@/lib/supabase/client-for-user';
import { BookmarkInputSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export function OPTIONS(request: Request): Response {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request.headers.get('origin'));
  try {
    const user = await requireUser(request);
    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = BookmarkInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400, headers: cors },
      );
    }
    const supabase = await getSupabaseForUser(user);
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: user.userId,
        url: parsed.data.url,
        title: parsed.data.title ?? null,
        source_type: 'bookmark',
      })
      .select('id')
      .single();
    if (error || !data) {
      // 23505 = Postgres unique_violation. items has UNIQUE(user_id, url).
      if (error?.code === '23505') {
        return Response.json(
          { error: 'already_in_inbox' },
          { status: 409, headers: cors },
        );
      }
      return Response.json(
        { error: error?.message ?? 'failed to insert item' },
        { status: 500, headers: cors },
      );
    }
    const itemId = data.id;
    // runPipeline itself catches and marks the item failed via markFailed.
    // The outer try/catch here only fires when markFailed itself throws
    // (e.g. DB unreachable); in that rare case the item stays in
    // processing state and the dashboard's Retry button is the recovery
    // path.
    after(async () => {
      try {
        await runPipeline({ itemId, userId: user.userId });
      } catch (cause) {
        console.error('runPipeline crashed for item', itemId, cause);
      }
    });
    return Response.json({ id: itemId, status: 'pending' }, { status: 200, headers: cors });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const headers = new Headers(err.response.headers);
      for (const [name, value] of cors) {
        headers.set(name, value);
      }
      return new Response(err.response.body, { status: err.response.status, headers });
    }
    throw err;
  }
}
