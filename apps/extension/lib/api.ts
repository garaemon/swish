/**
 * Outbound HTTP for the extension. Mirrors packages/cli/src/http.ts (Bearer
 * POST to `${apiUrl}/api/bookmarks`) but returns a discriminated result
 * instead of throwing, because the background worker maps each case to a
 * badge/notification rather than to stderr strings.
 */
import type {
  BookmarkCreateRequest,
  BookmarkCreateResponse,
} from '@swish/shared';

export type SaveResult =
  | { kind: 'saved'; response: BookmarkCreateResponse }
  | { kind: 'duplicate' }
  | { kind: 'auth_error' }
  | { kind: 'http_error'; status: number }
  | { kind: 'network_error'; message: string };

export type ApiClient = {
  apiUrl: string
  pat: string
};

export async function postBookmark(
  client: ApiClient,
  body: BookmarkCreateRequest,
): Promise<SaveResult> {
  // Strip a trailing slash so users may type the URL with or without one.
  const url = `${client.apiUrl.replace(/\/$/, '')}/api/bookmarks`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${client.pat}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'network_error', message };
  }

  if (response.ok) {
    const data = (await response.json()) as BookmarkCreateResponse;
    return { kind: 'saved', response: data };
  }
  if (response.status === 409) {
    return { kind: 'duplicate' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'auth_error' };
  }
  return { kind: 'http_error', status: response.status };
}
