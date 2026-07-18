import { storage } from 'wxt/utils/storage';

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

export type Settings = {
  apiUrl: string
  pat: string
};

/**
 * Returns the configured settings, or null if either value is missing. A
 * missing setting is the signal to open the options page instead of trying
 * to save.
 */
export async function getSettings(): Promise<Settings | null> {
  const [apiUrl, pat] = await Promise.all([
    apiUrlItem.getValue(),
    patItem.getValue(),
  ]);
  if (!apiUrl || !pat) {
    return null;
  }
  return { apiUrl, pat };
}
