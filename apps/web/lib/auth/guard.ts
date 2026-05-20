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
 * Authenticates an incoming request via the Supabase cookie session.
 * PAT (Bearer) support is added in a later PR; this slice covers Web UI
 * only.
 */
export async function requireUser(_req: Request): Promise<AuthedUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return { userId: user.userId, via: 'cookie' };
}
