import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { isFreshOAuthSignup } from './oauth-user';
import { isSignupAllowed } from './signup-allowlist';

export type SignupGateResult = 'allowed' | 'rejected'

const OAUTH_PROVIDER = 'google';

/**
 * Applies ALLOWED_SIGNUP_EMAILS to an OAuth sign-in that has already been
 * exchanged for a session.
 *
 * Returning users are always allowed — the allow-list gates account creation,
 * not sign-in. Only an account this very request created is checked, and a
 * rejected one is rolled back: the auth.users row is deleted (profiles,
 * user_settings, items and tokens follow via ON DELETE CASCADE) and the
 * freshly minted session cookies are cleared.
 *
 * TODO (atomicity): this is check-then-delete, not a transaction. Between
 * exchangeCodeForSession() and admin.deleteUser() the account exists and the
 * handle_new_user trigger has already seeded profiles/user_settings. If the
 * worker dies inside that window the row survives, and because the next
 * sign-in reads as "returning" the allow-list is bypassed for that address
 * from then on. Accepted for now. The atomic fix is GoTrue's
 * before_user_created hook (there is a commented-out
 * [auth.hook.before_user_created] stanza in supabase/config.toml), which
 * rejects before the auth.users INSERT — but it requires the allow-list to
 * live in SQL rather than in an environment variable.
 */
export async function enforceSignupAllowlist(
  supabase: SupabaseClient,
  user: User,
): Promise<SignupGateResult> {
  // Created on first use so the common "existing user signs in" path never
  // touches the service-role key.
  let service: SupabaseClient | null = null;
  const serviceClient = (): SupabaseClient => {
    service ??= createSupabaseServiceClient();
    return service;
  };

  let identities = user.identities;
  if (!identities) {
    // The exchange response may omit identities. Re-read through the admin
    // API rather than guess: isFreshOAuthSignup() treats "unknown" as
    // "returning", which would silently disable the allow-list.
    const { data } = await serviceClient().auth.admin.getUserById(user.id);
    identities = data.user?.identities;
  }

  if (!isFreshOAuthSignup({ ...user, identities }, OAUTH_PROVIDER)) {
    return 'allowed';
  }
  if (isSignupAllowed(user.email, getServerEnv().ALLOWED_SIGNUP_EMAILS)) {
    return 'allowed';
  }

  const { error: deleteError } = await serviceClient().auth.admin.deleteUser(user.id);
  if (deleteError) {
    // Log and carry on: signing the caller out matters more than the rollback
    // succeeding, and an orphaned row is recoverable from the Dashboard.
    console.error('failed to roll back disallowed signup', user.id, deleteError.message);
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // signOut posts to /logout, which can fail now that the user is gone.
    // The cookie sweep below is what actually ends the session.
  }
  // Belt and braces: a leftover sb-*-auth-token would make every subsequent
  // request fail getUser() in middleware.ts and look like a redirect loop.
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name);
    }
  }

  return 'rejected';
}
