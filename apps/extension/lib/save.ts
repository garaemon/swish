/**
 * Pure save-flow logic, deliberately free of any browser API so it can be
 * unit-tested directly. The background worker wires these into
 * chrome.tabs / chrome.action / chrome.notifications.
 */
import type { BookmarkCreateRequest } from '@swish/shared';
import type { SaveResult } from './api';

export type TabInput = {
  url?: string
  title?: string
};

export type SaveTarget =
  | { ok: true; request: BookmarkCreateRequest }
  | { ok: false; reason: 'unsavable' };

function isHttpUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/**
 * Builds the bookmark request for a save trigger. When `linkUrl` is set (a
 * right-click on a link) it wins and is saved without a title — the pipeline
 * fills the title from the fetched page. Otherwise the active tab's url+title
 * are used. Non-http(s) targets (chrome://, about:, the Web Store) are
 * rejected; activeTab wouldn't grant access there anyway.
 */
export function resolveSaveTarget(
  tab: TabInput | undefined,
  linkUrl?: string,
): SaveTarget {
  if (linkUrl) {
    if (!isHttpUrl(linkUrl)) {
      return { ok: false, reason: 'unsavable' };
    }
    return { ok: true, request: { url: linkUrl } };
  }
  if (!isHttpUrl(tab?.url)) {
    return { ok: false, reason: 'unsavable' };
  }
  const request: BookmarkCreateRequest = { url: tab.url };
  if (tab.title) {
    request.title = tab.title;
  }
  return { ok: true, request };
}

export type Outcome = {
  badgeText: string
  badgeColor: string
  notification?: { title: string; message: string }
};

const GREEN = '#16a34a';
const AMBER = '#d97706';
const RED = '#dc2626';

/** Maps an API result to badge text/color and an optional error notification. */
export function outcomeForResult(result: SaveResult): Outcome {
  switch (result.kind) {
    case 'saved':
      return { badgeText: '✓', badgeColor: GREEN };
    case 'duplicate':
      return { badgeText: '∅', badgeColor: AMBER };
    case 'auth_error':
      return {
        badgeText: '!',
        badgeColor: RED,
        notification: {
          title: 'Swish: token rejected',
          message:
            'Your access token was rejected. Update it in the extension options.',
        },
      };
    case 'http_error':
      return {
        badgeText: '!',
        badgeColor: RED,
        notification: {
          title: 'Swish: save failed',
          message: `The server returned an error (HTTP ${result.status}).`,
        },
      };
    case 'network_error':
      return {
        badgeText: '!',
        badgeColor: RED,
        notification: {
          title: 'Swish: network error',
          message: `Could not reach Swish: ${result.message}`,
        },
      };
  }
}

/** Notification shown when the current page cannot be saved. */
export const UNSAVABLE_NOTIFICATION = {
  title: 'Swish: can’t save this page',
  message: 'Only http(s) pages can be saved to Swish.',
};
