const ALLOWED_HEADERS = 'Authorization, Content-Type';
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

/**
 * Builds CORS response headers that echo the request Origin.
 * Authorization-based endpoints (the bookmarklet) do not use cookies,
 * so allow-credentials is intentionally omitted.
 *
 * TODO: in production, restrict allowed origins to NEXT_PUBLIC_APP_URL
 * and an explicit allowlist. Today any origin that has somehow obtained
 * a user's PAT can post to /api/bookmarks; acceptable for a local PoC
 * but worth tightening before public deploy.
 */
export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin ?? '*');
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Vary', 'Origin');
  return headers;
}

/**
 * Returns a 204 preflight response with CORS headers for the request Origin.
 */
export function handleOptions(req: Request): Response {
  const headers = corsHeaders(req.headers.get('origin'));
  return new Response(null, { status: 204, headers });
}
