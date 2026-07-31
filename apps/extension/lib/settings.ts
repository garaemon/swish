/**
 * The extension's persisted state and the rules that guard what may enter it.
 * Two responsibilities live here:
 *
 * - the two `storage.local` items that hold everything the extension remembers,
 * - the options-page validation, kept out of the React component so it is
 *   unit-testable without a DOM.
 */
import { storage } from 'wxt/utils/storage';
import { normalizeApiUrl, type ApiClient } from '@swish/shared';

// Both values live in `local`, not `sync`: the PAT is a bearer secret and
// storage.sync would upload it to Google's servers and fan it out to every
// signed-in Chrome profile. On-device only matches the trust level of the
// bookmarklet (which embeds the PAT in a bookmark).
export const apiUrlItem = storage.defineItem<string | null>('local:apiUrl', {
  fallback: null,
});
export const patItem = storage.defineItem<string | null>('local:pat', {
  fallback: null,
});

/**
 * What the extension persists. It is exactly an `ApiClient`, and aliasing
 * rather than restating it means a field added upstream cannot be missed here.
 */
export type Settings = ApiClient

/**
 * Returns the configured settings, or null if they are missing or no longer
 * acceptable. Null is the signal to open the options page instead of saving.
 *
 * The stored values are re-validated on every read, not trusted because they
 * were validated once on write: a profile configured by an older build predates
 * the https rule, and would otherwise keep sending the PAT in cleartext.
 */
export async function getSettings(): Promise<Settings | null> {
  const [apiUrl, pat] = await Promise.all([
    apiUrlItem.getValue(),
    patItem.getValue(),
  ]);
  if (!apiUrl || !pat) {
    return null;
  }
  const validation = validateSettingsInput(apiUrl, pat);
  return validation.ok ? validation.settings : null;
}

export type SettingsValidation =
  | { ok: true; settings: Settings }
  | { ok: false; message: string }

const INVALID_URL_MESSAGE =
  'Enter a full URL, including https:// (for example https://swish.example.com).';
const INSECURE_URL_MESSAGE =
  'URL must use https:// (http:// is allowed for localhost only).';
const MISSING_TOKEN_MESSAGE = 'Access token is required.';

// Loopback is exempt from the https rule because `pnpm dev` serves Swish over
// plain http and the token never leaves the machine there.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isSecureApiOrigin(url: URL): boolean {
  if (url.protocol === 'https:') {
    return true;
  }
  return url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname);
}

/**
 * Validates the options-page inputs and returns the settings to persist. Split
 * out of the React component so the rules — the only user-input validation in
 * the extension — are unit-testable without a DOM.
 *
 * Rejecting plain http for remote hosts matters: every save puts the PAT in an
 * `Authorization` header, and a PAT grants full write access to the inbox.
 */
export function validateSettingsInput(
  rawUrl: string,
  rawToken: string,
): SettingsValidation {
  const apiUrl = normalizeApiUrl(rawUrl);
  if (!URL.canParse(apiUrl)) {
    return { ok: false, message: INVALID_URL_MESSAGE };
  }
  if (!isSecureApiOrigin(new URL(apiUrl))) {
    return { ok: false, message: INSECURE_URL_MESSAGE };
  }
  const pat = rawToken.trim();
  if (!pat) {
    return { ok: false, message: MISSING_TOKEN_MESSAGE };
  }
  return { ok: true, settings: { apiUrl, pat } };
}
