/**
 * Returns CORS headers that echo the request Origin for the bookmark API,
 * which is hit from arbitrary origins via the bookmarklet.
 */
export function corsHeaders(_origin: string | null): Headers {
  throw new Error('not implemented')
}

/**
 * Handles an OPTIONS preflight request with the appropriate CORS headers.
 */
export function handleOptions(_req: Request): Response {
  throw new Error('not implemented')
}
