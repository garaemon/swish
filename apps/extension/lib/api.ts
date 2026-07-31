/**
 * Outbound HTTP for the extension. The request itself comes from
 * `@swish/shared`, the same builder the CLI uses; what differs is the error
 * contract. The CLI throws, this returns a discriminated result, because the
 * background worker maps each case to a badge/notification rather than to
 * stderr strings.
 */
import {
  buildBookmarkPostRequest,
  type ApiClient,
  type BookmarkCreateRequest,
  type BookmarkCreateResponse,
} from '@swish/shared';

/**
 * Every way one save attempt can end. `invalid_response` is deliberately
 * distinct from `http_error`: the server accepted the request, so the bookmark
 * probably exists, and telling the user it failed would push them into a
 * pointless retry.
 */
export type SaveResult =
  | { kind: 'saved'; response: BookmarkCreateResponse }
  | { kind: 'duplicate' }
  | { kind: 'auth_error' }
  | { kind: 'http_error'; status: number }
  | { kind: 'invalid_response' }
  | { kind: 'network_error'; message: string }

/**
 * POSTs one bookmark to `${apiUrl}/api/bookmarks` with Bearer auth.
 *
 * Never rejects. Every failure — an unreachable server, a body that is not
 * JSON, any non-2xx status — comes back as a `SaveResult`, because both call
 * sites discard the promise and a rejection would leave the click with no
 * feedback at all. Results map as follows:
 *
 * - 2xx with a JSON body: `saved`,
 * - 2xx with an unreadable body: `invalid_response`,
 * - 409: `duplicate`,
 * - 401 or 403: `auth_error`,
 * - any other status: `http_error`,
 * - a thrown `fetch`: `network_error`.
 */
export async function saveBookmark(
  client: ApiClient,
  body: BookmarkCreateRequest,
): Promise<SaveResult> {
  const { url, init } = buildBookmarkPostRequest(client, body);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'network_error', message };
  }

  if (response.ok) {
    // A captive portal, proxy, or interstitial can answer 200 with HTML, and a
    // rejected json() here would escape the "never rejects" contract.
    try {
      const data = (await response.json()) as BookmarkCreateResponse;
      return { kind: 'saved', response: data };
    } catch {
      return { kind: 'invalid_response' };
    }
  }
  if (response.status === 409) {
    return { kind: 'duplicate' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'auth_error' };
  }
  return { kind: 'http_error', status: response.status };
}
