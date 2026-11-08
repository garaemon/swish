import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// Intentionally uses the `middleware` file convention (Edge), not the newer
// Next.js 16 `proxy` (Node.js proxy runtime): the OpenNext Cloudflare adapter
// does not support `proxy`. `next dev` therefore logs a "middleware is
// deprecated, use proxy" warning — expected until OpenNext supports it. Revert
// this file to `proxy.ts` once it does.

const PUBLIC_PATHS = ['/login', '/signup'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );
}

/**
 * Runs on every UI route and redirects visitors without a Better Auth session
 * cookie to /login.
 *
 * This is an optimistic check: it only looks for the cookie and does not hit
 * the database, so it stays cheap on every navigation. Pages and server
 * actions still validate the session for real via getSessionUser(), which is
 * what actually gates data access.
 */
export function middleware(request: NextRequest): NextResponse {
  const hasSessionCookie = Boolean(getSessionCookie(request));
  if (!hasSessionCookie && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Matches every UI route. Excludes /api/* (routes handle their own auth),
// Next.js static and image assets, the favicon, and common public image
// extensions so the middleware does not run once per <img> request.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|map)$).*)',
  ],
};
