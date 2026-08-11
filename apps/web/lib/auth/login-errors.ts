/**
 * Copy for the failures /auth/callback can hand back to /login.
 *
 * Only these codes cross the URL boundary. Google's own `error_description`
 * is attacker-influenceable text; rendering it verbatim would let an
 * arbitrary message appear as first-party UI copy, so the callback logs the
 * provider's text server-side and forwards a code instead.
 */

export const LOGIN_ERROR_MESSAGES = {
  oauth_failed: 'Google sign-in was cancelled or did not complete. Please try again.',
  missing_code: 'Sign-in did not complete. Please try again.',
  exchange_failed: 'Could not complete sign-in. Please try again.',
  signup_not_allowed:
    'This Google account is not allowed to create a Swish account. Ask the owner to add your address to the allow-list.',
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES

/**
 * Maps a `?error=` value to display copy. Unknown or absent codes return null
 * so the login page simply renders no banner.
 */
export function loginErrorMessage(code: string | undefined | null): string | null {
  if (!code) {
    return null;
  }
  if (Object.hasOwn(LOGIN_ERROR_MESSAGES, code)) {
    return LOGIN_ERROR_MESSAGES[code as LoginErrorCode];
  }
  return null;
}
