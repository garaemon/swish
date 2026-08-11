'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Google "G" mark. Inlined rather than served from /public so the button
 * needs no extra asset and no remote-image configuration.
 */
function GoogleMark(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleSignInButton(): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // redirectTo is built from the current origin, not NEXT_PUBLIC_APP_URL:
      // the PKCE code verifier is stored in a cookie on whichever host the
      // user is browsing, so returning to a different host (localhost vs
      // 127.0.0.1) would lose it and fail the exchange. Both local hosts are
      // in additional_redirect_urls in supabase/config.toml.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) {
        setError(oauthError.message);
        setSubmitting(false);
      }
      // On success the browser is already navigating to Google. Leaving
      // `submitting` set keeps the button from flashing back to idle during
      // the redirect.
    } catch (cause) {
      // A network drop would otherwise escape to the error boundary and
      // freeze the page; surface it inline like the password form does.
      setError(cause instanceof Error ? cause.message : 'unexpected sign-in error');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <GoogleMark />
        {submitting ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
