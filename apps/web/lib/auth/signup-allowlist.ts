/**
 * Allow-list that gates *new account creation*. Pure and side-effect free so
 * the matching rules stay easy to test; the enforcement (rollback, cookie
 * clearing) lives in lib/auth/oauth-signup-gate.ts.
 *
 * The raw value comes from the ALLOWED_SIGNUP_EMAILS env var. Operators write
 * either full addresses or domains, so both forms are accepted.
 */

/**
 * Normalises the raw env value into lower-cased, trimmed entries.
 * An unset, empty, or all-whitespace value yields an empty list, which
 * isSignupAllowed() reads as "no restriction".
 */
export function parseSignupAllowlist(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) {
    return null;
  }
  return email.slice(at + 1);
}

/**
 * True when `email` may create a new account.
 *
 * - empty allow-list  → everyone (open signup, the default)
 * - "@example.com" or "example.com" → that exact domain only. Subdomains do
 *   not match: "@example.com" must not admit "a@evil.example.com", and a
 *   suffix comparison would also wrongly admit "a@notexample.com".
 * - anything else → exact, case-insensitive address match
 *
 * A missing email fails closed once a list is configured: the whole point of
 * the list is to check an address, so an identity we cannot check is refused.
 */
export function isSignupAllowed(
  email: string | null | undefined,
  raw: string | undefined,
): boolean {
  const allowlist = parseSignupAllowlist(raw);
  if (allowlist.length === 0) {
    return true;
  }
  if (!email) {
    return false;
  }

  const normalised = email.trim().toLowerCase();
  const domain = domainOf(normalised);

  return allowlist.some((entry) => {
    if (entry.startsWith('@')) {
      return domain !== null && domain === entry.slice(1);
    }
    if (!entry.includes('@')) {
      // Bare domain: operators reach for "example.com" as often as
      // "@example.com", so treat the two spellings alike.
      return domain !== null && domain === entry;
    }
    return normalised === entry;
  });
}
