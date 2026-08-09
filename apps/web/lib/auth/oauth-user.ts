/**
 * Tells apart "this OAuth sign-in just created the account" from "an existing
 * user signed in". Pure so both branches are cheap to test — the decision
 * gates a destructive rollback in lib/auth/oauth-signup-gate.ts.
 *
 * GoTrue has no "created by this request" flag on the exchange response, so
 * this combines two signals and requires both:
 *
 *   1. the user row is younger than NEW_USER_WINDOW_MS, and
 *   2. the account carries exactly one identity, the provider we just used.
 *
 * (2) is what protects established accounts: when the provider returns a
 * verified email that matches an existing user, GoTrue links the new identity
 * onto that user instead of creating a second one. Such a user keeps their
 * original created_at and ends up with two or more identities, so they fail
 * both checks and are treated as returning.
 *
 * Failure modes, deliberately asymmetric:
 *
 * - False negative (a genuinely new user read as returning): possible when
 *   the database and the worker clocks differ by more than the window. The
 *   result is one account that skipped the allow-list; it can be deleted from
 *   the Supabase Dashboard. Recoverable.
 * - False positive (a returning user read as new) is the only path to data
 *   loss, because the caller deletes what it believes it just created. Check
 *   (2) is what makes it near-impossible: an account that exists yet has a
 *   single, freshly created OAuth identity and a row younger than a minute is
 *   one that was, in fact, just created. The residual case is an account
 *   created in the Dashboard and signed into within the same minute, before
 *   any other identity is attached to it.
 */

const NEW_USER_WINDOW_MS = 60_000;

export type OAuthIdentityLike = {
  provider: string
}

export type OAuthUserLike = {
  created_at: string
  identities?: OAuthIdentityLike[] | null
}

export function isFreshOAuthSignup(
  user: OAuthUserLike,
  provider: string,
  now: number = Date.now(),
): boolean {
  const identities = user.identities;
  // Absent identities means "unknown", not "none". Callers re-fetch through
  // the admin API rather than guess; returning false here keeps the unknown
  // case away from the delete path.
  if (!Array.isArray(identities) || identities.length !== 1) {
    return false;
  }
  if (identities[0].provider !== provider) {
    return false;
  }

  const createdAt = Date.parse(user.created_at);
  if (Number.isNaN(createdAt)) {
    return false;
  }
  const age = now - createdAt;
  return age >= 0 && age < NEW_USER_WINDOW_MS;
}
