/**
 * Environment subset used to decide whether Cloudflare remote bindings can be
 * enabled during `next dev`.
 */
export type CloudflareCredentialEnv = {
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  // Index signature so `process.env` (NodeJS.ProcessEnv) is assignable.
  [key: string]: string | undefined
}

// `.env.local` stores Cloudflare credentials as 1Password references
// (op://...). They only resolve to real values when the dev server is
// launched via `op run --env-file .env.local -- pnpm dev`. A plain
// `pnpm dev` receives the literal reference strings, and wrangler then
// fails to open the remote-binding proxy session with a confusing
// Cloudflare API error at every startup.
const ONE_PASSWORD_REFERENCE_PREFIX = 'op://';

/**
 * Returns true when both Cloudflare credentials are present and resolved to
 * real values (not unresolved 1Password `op://` references). Used to decide
 * whether `initOpenNextCloudflareForDev` should enable remote bindings.
 */
export function hasResolvedCloudflareCredentials(env: CloudflareCredentialEnv): boolean {
  return (
    isResolvedCredential(env.CLOUDFLARE_API_TOKEN) &&
    isResolvedCredential(env.CLOUDFLARE_ACCOUNT_ID)
  );
}

function isResolvedCredential(value: string | undefined): boolean {
  return Boolean(value) && !value!.startsWith(ONE_PASSWORD_REFERENCE_PREFIX);
}
