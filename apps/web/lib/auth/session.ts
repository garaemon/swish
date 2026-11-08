import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from './better-auth';

export type SessionUser = {
  userId: string
  email: string | null
}

/**
 * Resolves the Better Auth session from the request cookies and returns the
 * user, or null if no valid session is present.
 *
 * `requestHeaders` lets route handlers pass `request.headers` directly; when
 * omitted (pages / server actions) the Next.js request headers are used.
 */
export async function getSessionUser(requestHeaders?: Headers): Promise<SessionUser | null> {
  // Read the request headers *before* touching the Cloudflare context:
  // headers() marks the page as dynamic, so `next build` never tries to
  // prerender it (which would try to open the D1 binding at build time).
  const headers = requestHeaders ?? (await nextHeaders());
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return { userId: session.user.id, email: session.user.email ?? null };
}

/**
 * Server action / page helper: requires a logged-in user and returns just
 * the user id. Redirects to /login otherwise (terminating the request).
 */
export async function requireSessionUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  return user.userId;
}
