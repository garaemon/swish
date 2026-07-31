/**
 * The wire format every Swish API client shares. The CLI and the Chrome
 * extension POST the same bookmark to the same endpoint with the same
 * credentials; only their error handling differs. Building the request here
 * keeps the endpoint path, auth scheme, and URL normalization identical, so the
 * two clients cannot silently diverge on what a configured URL means.
 */
import type { BookmarkCreateRequest } from './types';

/** Credentials for one Swish server: its base URL and a personal access token. */
export type ApiClient = {
  apiUrl: string
  pat: string
}

/**
 * Strips surrounding whitespace and trailing slashes from a configured Swish
 * URL, so users may type it with or without one and every caller can join a
 * path with a single `/`.
 */
export function normalizeApiUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

/** The absolute URL and `fetch` options for one bookmark POST. */
export type BookmarkPostRequest = {
  url: string
  init: RequestInit
}

/**
 * Builds the `fetch` arguments for creating one bookmark. Callers own the
 * response: the CLI throws on non-2xx, the extension maps it to badge feedback.
 */
export function buildBookmarkPostRequest(
  client: ApiClient,
  body: BookmarkCreateRequest,
): BookmarkPostRequest {
  return {
    url: `${normalizeApiUrl(client.apiUrl)}/api/bookmarks`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${client.pat}`,
      },
      body: JSON.stringify(body),
    },
  };
}
