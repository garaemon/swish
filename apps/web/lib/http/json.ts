/**
 * Returns a 501 Not Implemented JSON response with a stable shape.
 * Used as a placeholder during top-down scaffolding.
 */
export function notImplemented(name: string): Response {
  return Response.json(
    { error: 'not_implemented', endpoint: name },
    { status: 501 },
  )
}
