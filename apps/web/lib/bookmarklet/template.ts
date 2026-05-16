export type BookmarkletInput = {
  apiUrl: string
  pat: string
}

/**
 * Builds a `javascript:` URL that POSTs the current page to /api/bookmarks
 * with the given PAT. Returned string is safe to use as an anchor href.
 */
export function buildBookmarklet(_input: BookmarkletInput): string {
  throw new Error('not implemented')
}
