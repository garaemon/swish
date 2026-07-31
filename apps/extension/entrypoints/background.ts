/**
 * The MV3 service worker: the only file in the extension that touches browser
 * APIs. Three triggers funnel into one `handleSave` path:
 *
 * - a toolbar click,
 * - the `Alt+Shift+S` shortcut, which fires `action.onClicked` through
 *   `_execute_action` because no popup is declared,
 * - the page/link context menu.
 *
 * Every decision — which URL to save, and how a result maps to badge and
 * notification — lives in lib/save.ts so it stays testable without a browser.
 * This file only performs the side effects: badge, notification, tab creation.
 */
import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { normalizeApiUrl } from '@swish/shared';
import { getSettings } from '../lib/settings';
import { saveBookmark, type SaveResult } from '../lib/api';
import {
  resolveSaveTarget,
  buildSaveFeedback,
  UNSAVABLE_NOTIFICATION,
  type SaveFeedback,
  type TabInput,
} from '../lib/save';

/** The active tab as the listeners see it: a save target plus its badge id. */
type SaveTab = TabInput & { id?: number }

const SAVE_MENU_ID = 'swish-save';
const INBOX_MENU_ID = 'swish-open-inbox';
export const BADGE_CLEAR_MS = 2500;

// Keyed by tab id (undefined for the global badge) so a second save on the
// same tab cancels the previous clear instead of wiping the new badge early.
const badgeClearTimers = new Map<
  number | undefined,
  ReturnType<typeof setTimeout>
>();

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: SAVE_MENU_ID,
      title: 'Save to Swish',
      contexts: ['page', 'link'],
    });
    browser.contextMenus.create({
      id: INBOX_MENU_ID,
      title: 'Open Swish inbox',
      // Right-click on the toolbar icon.
      contexts: ['action'],
    });
  });

  browser.action.onClicked.addListener((tab) => {
    runInBackground(handleSave(tab, undefined));
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === SAVE_MENU_ID) {
      runInBackground(handleSave(tab, info.linkUrl));
    } else if (info.menuItemId === INBOX_MENU_ID) {
      runInBackground(openInbox());
    }
  });
});

// Extension event listeners cannot await, so any rejection the flow does not
// handle itself — storage reads, openOptionsPage, notifications, tab creation —
// would otherwise vanish as an unhandled rejection with nothing in the log to
// explain why the click did nothing.
function runInBackground(work: Promise<void>): void {
  work.catch((error: unknown) => {
    console.error('Swish: background task failed', error);
  });
}

/**
 * Runs one save: resolves the target, posts it, and reports the result. Opens
 * the options page instead when the extension is not configured yet, which is
 * the path every new user hits on their first click.
 */
export async function handleSave(
  tab: SaveTab | undefined,
  linkUrl: string | undefined,
): Promise<void> {
  const settings = await getSettings();
  if (!settings) {
    await browser.runtime.openOptionsPage();
    return;
  }

  const target = resolveSaveTarget(tab, linkUrl);
  if (!target.ok) {
    await notify(UNSAVABLE_NOTIFICATION);
    return;
  }

  // saveBookmark promises not to reject, but this is the one step where a
  // rejection would cost the user their feedback entirely, so it is guarded
  // rather than trusted.
  const result = await saveBookmark(settings, target.request).catch(
    (err): SaveResult => ({
      kind: 'network_error',
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  await applySaveFeedback(buildSaveFeedback(result), tab?.id);
}

async function openInbox(): Promise<void> {
  const settings = await getSettings();
  if (!settings) {
    await browser.runtime.openOptionsPage();
    return;
  }
  // Root "/" redirects to the inbox (/dashboard) when signed in, or /login
  // otherwise — see apps/web/app/page.tsx — so no path is hardcoded here.
  const url = `${normalizeApiUrl(settings.apiUrl)}/`;
  await browser.tabs.create({ url });
}

async function applySaveFeedback(
  feedback: SaveFeedback,
  tabId: number | undefined,
): Promise<void> {
  // The notification goes first because it is the only feedback channel that
  // survives the tab being closed while the request was still in flight. It is
  // still best-effort: notifications.create rejects when the icon fails to load
  // or the OS suppresses it, and that must not cost the user the badge too.
  if (feedback.notification) {
    await notify(feedback.notification).catch((error: unknown) => {
      console.error('Swish: notification failed', error);
    });
  }
  // Both calls must be scoped to the same tab: setBadgeBackgroundColor without
  // a tabId changes the default for every tab, so a failure elsewhere would
  // repaint an already-displayed success tick red.
  await browser.action
    .setBadgeBackgroundColor({ color: feedback.badgeColor, tabId })
    .catch(ignoreVanishedTab);
  await browser.action
    .setBadgeText({ text: feedback.badgeText, tabId })
    .catch(ignoreVanishedTab);
  scheduleBadgeClear(tabId);
}

/**
 * Schedules the badge to clear, replacing any pending clear for the same tab.
 *
 * BADGE_CLEAR_MS is far below the MV3 idle timeout, so the worker is very
 * unlikely to be evicted before the timer fires; chrome.alarms would be immune
 * but has a one-minute minimum, which is far too coarse for this badge.
 */
export function scheduleBadgeClear(tabId: number | undefined): void {
  const pending = badgeClearTimers.get(tabId);
  if (pending !== undefined) {
    clearTimeout(pending);
  }
  const timer = setTimeout(() => {
    badgeClearTimers.delete(tabId);
    void browser.action
      .setBadgeText({ text: '', tabId })
      .catch(ignoreVanishedTab);
  }, BADGE_CLEAR_MS);
  badgeClearTimers.set(tabId, timer);
}

// Every badge write rejects with "No tab with id" once its tab is closed, which
// happens routinely within the 2.5 s badge window. There is nothing left to
// paint, so this is expected rather than an error worth surfacing or logging.
function ignoreVanishedTab(): void {}

/**
 * Cancels every pending badge clear. Tests share this module across cases, and
 * a timer left running from one case would fire during the next one.
 */
export function cancelAllBadgeClears(): void {
  for (const timer of badgeClearTimers.values()) {
    clearTimeout(timer);
  }
  badgeClearTimers.clear();
}

async function notify(content: {
  title: string
  message: string
}): Promise<void> {
  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/96.png'),
    title: content.title,
    message: content.message,
  });
}
