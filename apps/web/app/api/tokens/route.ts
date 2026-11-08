/**
 * GET  /api/tokens         List the auth user's personal access tokens.
 * POST /api/tokens         Issue a new PAT; the raw JWT is returned exactly once.
 * Both endpoints accept cookie or `Authorization: Bearer <PAT>`.
 */
import type { TokenSummaryDto } from '@swish/shared';
import { desc, eq } from 'drizzle-orm';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { issuePat } from '@/lib/auth/pat';
import { getDb } from '@/lib/db';
import { personalAccessTokens } from '@/lib/db/schema';
import { TokenCreateSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const db = await getDb();
    let tokens: TokenSummaryDto[];
    try {
      tokens = await db
        .select({
          id: personalAccessTokens.id,
          name: personalAccessTokens.name,
          createdAt: personalAccessTokens.createdAt,
          expiresAt: personalAccessTokens.expiresAt,
          lastUsedAt: personalAccessTokens.lastUsedAt,
        })
        .from(personalAccessTokens)
        .where(eq(personalAccessTokens.userId, user.userId))
        .orderBy(desc(personalAccessTokens.createdAt));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'failed to load tokens' },
        { status: 500 },
      );
    }
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
    const issued = await issuePat({
      userId: user.userId,
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays,
      db: await getDb(),
    });
    return Response.json(issued, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
