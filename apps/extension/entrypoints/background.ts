import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getSettings } from '../lib/settings';
import { postBookmark } from '../lib/api';
import {
  resolveSaveTarget,
  outcomeForResult,
  UNSAVABLE_NOTIFICATION,
  type Outcome,
} from '../lib/save';

const SAVE_MENU_ID = 'swish-save';
const INBOX_MENU_ID = 'swish-open-inbox';
const BADGE_CLEAR_MS = 2500;

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

  // Toolbar click and the _execute_action keyboard shortcut both land here
  // (no popup is declared, so action.onClicked fires for both).
  browser.action.onClicked.addListener((tab) => {
    void handleSave(tab, undefined);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === SAVE_MENU_ID) {
      void handleSave(tab, info.linkUrl);
    } else if (info.menuItemId === INBOX_MENU_ID) {
      void openInbox();
    }
  });
});

async function handleSave(
  tab: { id?: number; url?: string; title?: string } | undefined,
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

  const result = await postBookmark(settings, target.request);
  await applyOutcome(outcomeForResult(result), tab?.id);
}

async function openInbox(): Promise<void> {
  const settings = await getSettings();
  if (!settings) {
    await browser.runtime.openOptionsPage();
    return;
  }
  // Root "/" redirects to the inbox (/dashboard) when signed in, or /login
  // otherwise — see apps/web/app/page.tsx — so no path is hardcoded here.
  const url = `${settings.apiUrl.replace(/\/$/, '')}/`;
  await browser.tabs.create({ url });
}

async function applyOutcome(
  outcome: Outcome,
  tabId: number | undefined,
): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color: outcome.badgeColor });
  await browser.action.setBadgeText({ text: outcome.badgeText, tabId });
  if (outcome.notification) {
    await notify(outcome.notification);
  }
  setTimeout(() => {
    void browser.action.setBadgeText({ text: '', tabId });
  }, BADGE_CLEAR_MS);
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
