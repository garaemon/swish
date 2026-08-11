import { NextResponse } from 'next/server';
import { enforceSignupAllowlist } from '@/lib/auth/oauth-signup-gate';
import { sanitizeRedirectPath } from '@/lib/auth/redirect-target';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback — the return leg of the Supabase OAuth (PKCE) flow.
 *
 * The browser client starts the flow in app/login/_components/google-button.tsx
 * and stores the PKCE code verifier in a cookie; this handler trades the
 * `code` query parameter for a session and writes the auth cookies. It must
 * stay public (see PUBLIC_PATHS in middleware.ts) because the caller has no
 * session until the exchange completes.
 *
 * Always answers with a redirect: to `next` (default /dashboard) on success,
 * or to /login?error=<code> on failure. The codes are listed in
 * lib/auth/login-errors.ts.
 */

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Redirects are built from the request's own origin rather than from
  // NEXT_PUBLIC_APP_URL: the session cookies set a few lines below are scoped
  // to the host the browser actually used, so bouncing to a different host
  // here would drop them. The origin is trustworthy because GoTrue only
  // redirects to URLs matching its configured allow-list.
  const origin = url.origin;
  const fail = (code: string): Response =>
    NextResponse.redirect(new URL(`/login?error=${code}`, origin));

  // Google and GoTrue report user-facing failures (consent denied, provider
  // misconfigured) as query parameters on a 302, not as a non-2xx status.
  const providerError = url.searchParams.get('error');
  if (providerError) {
    console.warn(
      'oauth callback returned an error',
      providerError,
      url.searchParams.get('error_description'),
    );
    return fail('oauth_failed');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return fail('missing_code');
  }

  const next = sanitizeRedirectPath(url.searchParams.get('next'));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.warn('exchangeCodeForSession failed', error?.message);
    return fail('exchange_failed');
  }

  const gate = await enforceSignupAllowlist(supabase, data.user);
  if (gate === 'rejected') {
    return fail('signup_not_allowed');
  }

  return NextResponse.redirect(new URL(next, origin));
}
