/**
 * Better Auth endpoints (sign-in, sign-up, sign-out, get-session, ...).
 * The auth instance is built per request because the D1 binding it uses is
 * request-scoped on Cloudflare Workers.
 */
import { getAuth } from '@/lib/auth/better-auth';

export const runtime = 'nodejs';

async function handler(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
