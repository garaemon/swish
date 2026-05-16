const ALLOWED_HEADERS = 'Authorization, Content-Type'
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'

/**
 * Builds CORS response headers that echo the request Origin.
 * Authorization-based endpoints (the bookmarklet) do not use cookies,
 * so allow-credentials is intentionally omitted.
 */
export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', origin ?? '*')
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS)
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  headers.set('Vary', 'Origin')
  return headers
}

/**
 * Returns a 204 preflight response with CORS headers for the request Origin.
 */
export function handleOptions(req: Request): Response {
  const headers = corsHeaders(req.headers.get('origin'))
  return new Response(null, { status: 204, headers })
}
