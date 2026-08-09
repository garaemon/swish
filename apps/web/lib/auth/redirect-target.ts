/**
 * Open-redirect guard for the `next` query parameter on /auth/callback.
 * The value survives a round trip through Google, so it is attacker-supplied
 * by the time we read it back.
 */

export const DEFAULT_REDIRECT = '/dashboard';

// Control characters (including CR/LF) would let a crafted value tamper with
// the Location header. Rejected outright rather than stripped.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Returns a same-origin path safe to hand to NextResponse.redirect(), or
 * DEFAULT_REDIRECT when the input is missing or not a plain local path.
 *
 * Only strings starting with a single "/" pass. "//host" and "/\host" are
 * rejected because browsers resolve both as protocol-relative, cross-origin
 * URLs. The value is not decoded: "/%2F%2Fevil.com" resolves under our own
 * origin as a path, so it is harmless.
 */
export function sanitizeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) {
    return DEFAULT_REDIRECT;
  }
  if (raw.startsWith('//') || raw.startsWith('/\\')) {
    return DEFAULT_REDIRECT;
  }
  if (raw.includes('\\') || CONTROL_CHARS.test(raw)) {
    return DEFAULT_REDIRECT;
  }
  return raw;
}
