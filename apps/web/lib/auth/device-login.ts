import 'server-only';
import { type IssuePatResult, issuePat } from './pat';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Why the failure reason is an enum rather than the GoTrue message: GoTrue
 * distinguishes "Invalid login credentials" from "Email not confirmed", which
 * tells an unauthenticated caller whether an account exists and what state it
 * is in. Callers map these reasons to fixed response bodies instead.
 */
export type DeviceLoginReason =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unavailable'

export class DeviceLoginError extends Error {
  readonly reason: DeviceLoginReason;

  constructor(reason: DeviceLoginReason) {
    super(reason);
    this.name = 'DeviceLoginError';
    this.reason = reason;
  }
}

/**
 * Lifetime of a PAT minted for a device. A module constant on purpose: the
 * device-login endpoint is unauthenticated, so it must not expose the
 * caller-controlled `expiresInDays` that POST /api/tokens accepts (which
 * TokenCreateSchema allows to reach five years).
 */
export const DEVICE_PAT_EXPIRES_IN_DAYS = 365;

/** Name recorded in personal_access_tokens when the client sends no deviceName. */
const DEFAULT_DEVICE_NAME = 'ios';

export type DeviceLoginInput = {
  email: string
  password: string
  deviceName?: string
}

/**
 * Verifies an email + password against Supabase Auth and, on success, mints a
 * long-lived PAT for the device.
 *
 * The device stores only the returned PAT — never the password — so every
 * subsequent request goes through the unchanged Bearer path in
 * lib/auth/guard.ts. The result is deliberately the same shape as
 * POST /api/tokens returns, and `id` lets the client revoke its own token via
 * DELETE /api/tokens/[id] when the user signs out.
 *
 * Lives here rather than inline in the route handler so it is covered by
 * __tests__/integration/auth/device-login.test.ts, which runs in CI. The
 * HTTP-level tests cannot: CI starts Supabase but never `next dev`, so every
 * test guarded by requireDevServer() is skipped there.
 */
export async function loginWithPassword(
  input: DeviceLoginInput,
): Promise<IssuePatResult> {
  const anon = createSupabaseAnonClient();

  const { data, error } = await anon.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) {
    throw new DeviceLoginError(mapSignInError(error.status));
  }
  if (!data.user) {
    throw new DeviceLoginError('invalid_credentials');
  }

  const issued = await issuePat({
    userId: data.user.id,
    name: input.deviceName ?? DEFAULT_DEVICE_NAME,
    expiresInDays: DEVICE_PAT_EXPIRES_IN_DAYS,
    supabase: createSupabaseServiceClient(),
  });

  // The scope matters: supabase-js defaults signOut() to `scope: 'global'`,
  // which revokes *every* refresh token the user holds — signing in from the
  // phone would silently log them out of the web app. 'local' drops only the
  // session created above. Failure here leaks one refresh token that expires
  // on its own, so it must not fail the login.
  try {
    await anon.auth.signOut({ scope: 'local' });
  } catch {
    // Intentionally ignored; see above.
  }

  return issued;
}

function mapSignInError(status: number | undefined): DeviceLoginReason {
  if (status === 429) {
    return 'rate_limited';
  }
  if (status === 400 || status === 401 || status === 403) {
    return 'invalid_credentials';
  }
  return 'unavailable';
}
