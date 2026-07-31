/**
 * Outbound HTTP layer for the CLI. Wraps `fetch` with a Bearer-auth POST to
 * `${apiUrl}/api/bookmarks`. Keep server-internal error messages out of the
 * stderr so terminal session sharing does not leak DB-level details.
 */
import {
  buildBookmarkPostRequest,
  type ApiClient,
  type BookmarkCreateRequest,
  type BookmarkCreateResponse,
} from '@swish/shared';

export type { ApiClient };

export class BookmarkRequestError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = 'BookmarkRequestError';
    this.status = status;
    this.body = body;
  }
}

/**
 * POSTs the given bookmark to `apiUrl`. Throws BookmarkRequestError for any
 * non-2xx response. The body is parsed as the canonical
 * `BookmarkCreateResponse` but its shape is NOT validated at runtime —
 * trust the server's contract.
 *
 * 4xx error bodies (e.g. validation messages) are exposed in
 * `BookmarkRequestError.body` so the caller can map them to user-friendly
 * messages; 5xx bodies are dropped so internal stack traces never reach
 * stderr.
 */
export async function postBookmark(
  client: ApiClient,
  body: BookmarkCreateRequest,
): Promise<BookmarkCreateResponse> {
  const { url, init } = buildBookmarkPostRequest(client, body);
  const response = await fetch(url, init);
  if (!response.ok) {
    const exposeBody = response.status >= 400 && response.status < 500;
    const text = exposeBody ? await response.text().catch(() => '') : '';
    const summary = exposeBody && text
      ? `POST ${url} -> ${response.status}: ${text.slice(0, 300)}`
      : `POST ${url} -> ${response.status}`;
    throw new BookmarkRequestError(response.status, text, summary);
  }
  return (await response.json()) as BookmarkCreateResponse;
}
