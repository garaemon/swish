import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Root route. proxy.ts treats "/" as a protected path (the matcher only
 * excludes /api, _next assets, and common static extensions) and would
 * already redirect anonymous visitors to /login. This component handles
 * the signed-in case explicitly: send authed users to /dashboard,
 * everyone else still falls through to /login.
 */
export default async function Home(): Promise<never> {
  const user = await getSessionUser();
  redirect(user ? '/dashboard' : '/login');
}
