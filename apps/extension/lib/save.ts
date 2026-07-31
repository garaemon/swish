/**
 * Pure save-flow logic, deliberately free of any browser API so it can be
 * unit-tested directly. The background worker wires these into
 * chrome.tabs / chrome.action / chrome.notifications.
 */
import type { BookmarkCreateRequest } from '@swish/shared';
import type { SaveResult } from './api';
import { isHttpUrl } from './url';

export type TabInput = {
  url?: string
  title?: string
}

export type SaveTarget =
  | { ok: true; request: BookmarkCreateRequest }
  | { ok: false; reason: 'unsavable' }

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

/** How one save attempt is reported back to the user on the toolbar icon. */
export type SaveFeedback = {
  badgeText: string
  badgeColor: string
  notification?: { title: string; message: string }
}

const SAVED_BADGE_COLOR = '#16a34a';
const DUPLICATE_BADGE_COLOR = '#d97706';
const ERROR_BADGE_COLOR = '#dc2626';

/** Maps an API result to badge text/color and an optional error notification. */
export function buildSaveFeedback(result: SaveResult): SaveFeedback {
  switch (result.kind) {
    case 'saved':
      return { badgeText: '✓', badgeColor: SAVED_BADGE_COLOR };
    case 'duplicate':
      return { badgeText: '∅', badgeColor: DUPLICATE_BADGE_COLOR };
    case 'auth_error':
      return {
        badgeText: '!',
        badgeColor: ERROR_BADGE_COLOR,
        notification: {
          title: 'Swish: token rejected',
          message:
            'Your access token was rejected. Update it in the extension options.',
        },
      };
    case 'http_error':
      return {
        badgeText: '!',
        badgeColor: ERROR_BADGE_COLOR,
        notification: {
          title: 'Swish: save failed',
          message: `The server returned an error (HTTP ${result.status}).`,
        },
      };
    case 'invalid_response':
      return {
        badgeText: '?',
        badgeColor: ERROR_BADGE_COLOR,
        notification: {
          title: 'Swish: unexpected reply',
          message:
            'The server accepted the request but replied with something Swish could not read. Check your inbox to see whether the page was saved.',
        },
      };
    case 'network_error':
      return {
        badgeText: '!',
        badgeColor: ERROR_BADGE_COLOR,
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
