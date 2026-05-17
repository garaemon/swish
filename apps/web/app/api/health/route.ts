// Public health probe; intentionally returns 200 without authenticating so
// load balancers and scripts/verify/web-up.sh can poll it.
export const runtime = 'nodejs'

export function GET(): Response {
  return Response.json({ status: 'ok' })
}
