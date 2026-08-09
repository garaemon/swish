export type ShortcutSetupInput = {
  apiUrl: string
  pat: string
}

/**
 * Name of the shared "Save to Swish" shortcut template. The setup deep link
 * targets the shortcut by name, so renaming the installed shortcut breaks
 * the Finish-setup button (docs/ios-shortcut-template.md calls this out).
 */
export const SHORTCUT_NAME = 'Save to Swish';

/**
 * Prefix that marks a shortcut run as a configuration run. The template
 * branches on it: input starting with this prefix carries the config JSON
 * to persist; anything else is treated as a URL to save.
 */
export const SHORTCUT_CONFIG_PREFIX = 'swish-config:';

/**
 * Builds the `shortcuts://run-shortcut` deep link that runs the installed
 * template once in configuration mode, handing it the endpoint and the
 * Authorization header as JSON. The shortcut stores both in a file so the
 * user never has to paste anything.
 *
 * The link only works on-device (iOS/iPadOS resolves the `shortcuts:`
 * scheme locally); the PAT never leaves the device through it.
 */
export function buildShortcutSetupUrl(input: ShortcutSetupInput): string {
  if (!input.apiUrl) {
    throw new Error('apiUrl is required');
  }
  if (!input.pat) {
    throw new Error('pat is required');
  }
  if (!/^https?:\/\//i.test(input.apiUrl)) {
    throw new Error('apiUrl must start with http:// or https://');
  }
  const trimmedUrl = input.apiUrl.replace(/\/$/, '');
  const config = JSON.stringify({
    endpoint: `${trimmedUrl}/api/bookmarks`,
    authorization: `Bearer ${input.pat}`,
  });
  const text = `${SHORTCUT_CONFIG_PREFIX}${config}`;
  const params = new URLSearchParams({
    name: SHORTCUT_NAME,
    input: 'text',
    text,
  });
  return `shortcuts://run-shortcut?${params.toString()}`;
}
