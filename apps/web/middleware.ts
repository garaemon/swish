import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env';

// Intentionally uses the `middleware` file convention (Edge), not the newer
// Next.js 16 `proxy` (Node.js proxy runtime): the OpenNext Cloudflare adapter
// does not support `proxy`. `next dev` therefore logs a "middleware is
// deprecated, use proxy" warning — expected until OpenNext supports it. Revert
// this file to `proxy.ts` once it does.

// /auth covers the Supabase OAuth callback (app/auth/callback/route.ts). It
// has to stay public: the caller holds no session until that handler trades
// the authorization code for one.
const PUBLIC_PATHS = ['/login', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );
}

/**
 * Runs on every UI route. Refreshes the Supabase auth cookie if needed
 * and redirects unauthenticated users to /login for protected paths.
 *
 * When `getUser()` triggers a token refresh, @supabase/ssr writes the new
 * cookies into the response via `setAll`. If we then redirect, those new
 * cookies must be copied onto the redirect response — otherwise the user is
 * sent to /login even though their session was refreshable.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const env = getServerEnv();

  const cookieHandlers: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        // Mutating request.cookies makes the new cookie visible to any other
        // middleware logic that re-reads cookies in this same invocation;
        // response.cookies propagates it back to the browser.
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }
    },
  };

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieHandlers },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed Supabase cookies set during getUser().
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

// Matches every UI route. Excludes /api/* (routes handle their own auth),
// Next.js static and image assets, the favicon, and common public image
// extensions so the middleware does not run getUser() once per <img> request.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|map)$).*)',
  ],
};
