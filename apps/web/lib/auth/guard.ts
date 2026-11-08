import { getDb } from '@/lib/db';
import { verifyPat } from './pat';
import { getSessionUser } from './session';

export type AuthedUser = {
  userId: string
  via: 'cookie' | 'pat'
}

/**
 * Thrown by requireUser when neither cookie nor PAT auth succeeded.
 * Carries a prebuilt 401 Response so route handlers can `return err.response`
 * without rebuilding the JSON body.
 */
export class UnauthorizedError extends Error {
  readonly response: Response;

  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.response = Response.json({ error: 'unauthorized' }, { status: 401 });
  }
}

/**
 * Authenticates an incoming request via either:
 *   1. an `Authorization: Bearer <PAT>` header (CLI / bookmarklet / external),
 *   2. or the Better Auth cookie session (Web UI).
 *
 * Bearer is preferred so that automated callers do not depend on cookies.
 * Intended as the auth gate for protected /api/* route handlers.
 *
 * The returned userId is the only tenancy boundary: D1 has no row-level
 * security, so every query downstream must filter by it.
 *
 * TODO (CSRF): cookie-authenticated state-changing API routes (PUT
 * /api/items/[id]/read, POST /api/items/[id]/retry, PUT /api/settings,
 * POST/DELETE /api/tokens, POST /api/bookmarks) have no Origin check.
 * Server actions used from pages get automatic CSRF protection from
 * Next.js; route handlers do not. Before any public deploy, restrict the
 * cookie path to same-origin requests (or move cookie-based mutation
 * exclusively through server actions).
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    try {
      const db = await getDb();
      const { userId } = await verifyPat(authHeader, db);
      return { userId, via: 'pat' };
    } catch {
      throw new UnauthorizedError('invalid pat');
    }
  }
  const user = await getSessionUser(req.headers);
  if (!user) {
    throw new UnauthorizedError();
  }
  return { userId: user.userId, via: 'cookie' };
}
