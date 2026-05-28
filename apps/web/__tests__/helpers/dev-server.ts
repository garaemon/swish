export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Checks whether the Next.js dev server is reachable. Integration tests
 * call this in `beforeAll` and then guard each test body with
 * `requireDevServer(devUp, name)` so a missing dev server is surfaced as
 * a console.warn instead of a silent green pass.
 */
export async function isDevServerUp(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Returns true (and emits a console.warn) when the dev server is not
 * reachable. Tests use this to short-circuit while keeping the skip
 * visible in the test report:
 *
 *   if (requireDevServer(devUp, 'GET /api/items')) return
 */
export function requireDevServer(devUp: boolean, name: string): boolean {
  if (!devUp) {
    console.warn(`SKIP ${name}: dev server unreachable at ${APP_URL}`);
    return true;
  }
  return false;
}

/**
 * Promise-based sleep. Extracted so test files do not duplicate
 * `new Promise((resolve) => setTimeout(resolve, ms))`.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
