/**
 * URL predicates for the extension, kept in a browser-free module so the pure
 * logic in lib/save.ts stays testable without any extension API. Base-URL
 * normalization lives in `@swish/shared` instead, because the CLI must agree
 * with the extension about what a configured Swish URL means.
 */

/** Reports whether a value is an http(s) URL, the only kind Swish can save. */
export function isHttpUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
