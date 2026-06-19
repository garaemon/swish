import { readConfig } from '../config';
import { BookmarkRequestError, postBookmark } from '../http';

/**
 * Implements `swish add <url>`.
 *
 * Exit codes:
 *   0 — success or "already in inbox" (treated as a no-op for idempotent
 *       re-runs from scripts).
 *   1 — no CLI config found (user must run `swish login`).
 *   2 — URL fails validation (not parseable or not http(s)).
 *   3 — server responded with a 4xx error other than 409.
 *   4 — server responded with a 5xx error.
 */
export async function addCommand(url: string): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error('No CLI config found. Run `swish login` first.');
    process.exit(1);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`Not a valid URL: ${url}`);
    process.exit(2);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.error(`Only http(s) URLs are supported (got ${parsed.protocol}).`);
    process.exit(2);
  }
  try {
    const result = await postBookmark(config, { url });
    console.log(`Saved item ${result.id} (status: ${result.status})`);
  } catch (cause) {
    if (cause instanceof BookmarkRequestError) {
      if (cause.status === 409) {
        console.log('Already in inbox.');
        return;
      }
      console.error(cause.message);
      process.exit(cause.status >= 500 ? 4 : 3);
    }
    throw cause;
  }
}
