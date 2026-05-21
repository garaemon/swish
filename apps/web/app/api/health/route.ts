// Public health probe; intentionally returns 200 without authenticating so
// load balancers and operational health checks can poll it.
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ status: 'ok' });
}
