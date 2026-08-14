/**
 * POST /api/auth/token { email, password, deviceName? }
 * Signs in against Supabase Auth and returns a long-lived PAT for a native
 * client. Responds 201 { id, token, expiresAt } — the same shape as
 * POST /api/tokens — so the device can store the token and, on sign-out,
 * revoke it via DELETE /api/tokens/[id].
 *
 * This is the one unauthenticated write route in the app, so three things it
 * deliberately does NOT do:
 *
 * 1. No requireUser(): this is the entry point that mints the credential.
 * 2. No CORS / no OPTIONS (unlike /api/bookmarks, which the bookmarklet needs).
 *    Allowing cross-origin calls would let any web page drive password
 *    attempts from a visitor's browser. Native clients send no Origin.
 * 3. Never logs the request body. A `console.error(err, raw)` here would put
 *    plaintext passwords into Cloudflare Workers Logs.
 *
 * TODO (rate limiting): Supabase's per-IP sign-in limit sees this Worker's
 * egress IP, not the device's, so proxying collapses that limit into a single
 * bucket shared by every caller — an attacker gets no per-source throttle and
 * can exhaust the bucket to lock the real user out. Forwarding X-Forwarded-For
 * does not help; the hosted Supabase edge overwrites it. Put a Cloudflare WAF
 * rate-limiting rule on this path at deploy time, or add a Workers Rate
 * Limiting binding keyed on CF-Connecting-IP.
 */
import { DeviceLoginError, loginWithPassword } from '@/lib/auth/device-login';
import { DeviceLoginSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

/** Maps a DeviceLoginError reason to its wire status + error code. */
const REASON_RESPONSES = {
  invalid_credentials: { status: 401, error: 'invalid_credentials' },
  rate_limited: { status: 429, error: 'rate_limited' },
  unavailable: { status: 503, error: 'auth_unavailable' },
} as const;

export async function POST(request: Request): Promise<Response> {
  const raw = (await request.json().catch(() => null)) as unknown;
  const parsed = DeviceLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const issued = await loginWithPassword(parsed.data);
    return Response.json(issued, { status: 201 });
  } catch (err) {
    if (err instanceof DeviceLoginError) {
      const { status, error } = REASON_RESPONSES[err.reason];
      return Response.json({ error }, { status });
    }
    throw err;
  }
}
