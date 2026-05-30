/**
 * GET  /api/tokens         List the auth user's personal access tokens.
 * POST /api/tokens         Issue a new PAT; the raw JWT is returned exactly once.
 * Both endpoints accept cookie or `Authorization: Bearer <PAT>`.
 */
import type { TokenSummaryDto } from '@swish/shared';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { issuePat } from '@/lib/auth/pat';
import { getSupabaseForUser } from '@/lib/supabase/client-for-user';
import { TokenCreateSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const supabase = await getSupabaseForUser(user);
    const { data, error } = await supabase
      .from('personal_access_tokens')
      .select('id, name, created_at, expires_at, last_used_at')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const tokens: TokenSummaryDto[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      // DB default `now()` guarantees created_at; the generated type is
      // nullable. See identical rationale in /api/items.
      createdAt: row.created_at as string,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    }));
    return Response.json({ tokens });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = TokenCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const supabase = await getSupabaseForUser(user);
    const issued = await issuePat({
      userId: user.userId,
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays,
      supabase,
    });
    return Response.json(issued, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
