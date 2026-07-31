import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';
import { apiUrlItem, patItem } from '../lib/settings';
import { UNSAVABLE_NOTIFICATION } from '../lib/save';
import {
  BADGE_CLEAR_MS,
  cancelAllBadgeClears,
  handleSave,
  scheduleBadgeClear,
} from '../entrypoints/background';
import { stubFetch } from './stub-fetch';

const TAB = { id: 7, url: 'https://a.test', title: 'A' };

/** A fresh 200 per test: a Response body can only be read once. */
function createSavedResponse(): Response {
  return new Response(JSON.stringify({ id: 'x', status: 'pending' }), {
    status: 200,
  });
}

beforeEach(() => {
  fakeBrowser.reset();
  // background.ts keeps its badge timers in module state, which fakeBrowser
  // does not touch; a timer left over from an earlier case fires during a later
  // one and clears a badge that case is still asserting on.
  cancelAllBadgeClears();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function storeSettings() {
  await apiUrlItem.setValue('https://swish.example.com');
  await patItem.setValue('tok-123');
}

/** Titles of the notifications raised so far, in order. */
function notifiedTitles(create: { mock: { calls: unknown[][] } }): string[] {
  return create.mock.calls.map((call) => (call[0] as { title: string }).title);
}

describe('handleSave', () => {
  it('opens the options page and saves nothing when settings are missing', async () => {
    const openOptionsPage = vi.fn(() => Promise.resolve());
    vi.spyOn(browser.runtime, 'openOptionsPage').mockImplementation(
      openOptionsPage,
    );
    const fetchMock = stubFetch(createSavedResponse());

    await handleSave(TAB, undefined);

    expect(openOptionsPage).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the success badge on the saving tab after a save', async () => {
    await storeSettings();
    stubFetch(createSavedResponse());

    await handleSave(TAB, undefined);

    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('✓');
  });

  it('shows the success badge again on a second save', async () => {
    await storeSettings();
    stubFetch(createSavedResponse());
    await handleSave(TAB, undefined);

    stubFetch(createSavedResponse());
    await handleSave(TAB, undefined);

    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('✓');
  });

  it('still shows the badge when the notification cannot be raised', async () => {
    await storeSettings();
    stubFetch(new Response('{}', { status: 401 }));
    vi.spyOn(browser.notifications, 'create').mockRejectedValue(
      new Error('Unable to download all specified images'),
    );

    await handleSave(TAB, undefined);

    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('!');
  });

  it('rejects a non-http page without contacting the server', async () => {
    await storeSettings();
    const fetchMock = stubFetch(createSavedResponse());
    const create = vi.spyOn(browser.notifications, 'create');

    await handleSave({ id: 7, url: 'chrome://extensions' }, undefined);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifiedTitles(create)).toEqual([UNSAVABLE_NOTIFICATION.title]);
  });

  it('tells the user their token was rejected on a 401', async () => {
    await storeSettings();
    stubFetch(new Response('{}', { status: 401 }));
    const create = vi.spyOn(browser.notifications, 'create');

    await handleSave(TAB, undefined);

    expect(notifiedTitles(create)).toEqual(['Swish: token rejected']);
  });

  it('warns that the save may have succeeded when the reply is unreadable', async () => {
    await storeSettings();
    stubFetch(new Response('<html>captive portal</html>', { status: 200 }));
    const create = vi.spyOn(browser.notifications, 'create');

    await handleSave(TAB, undefined);

    expect(notifiedTitles(create)).toEqual(['Swish: unexpected reply']);
  });

  it('opens the options page when the stored url is no longer acceptable', async () => {
    // A profile configured before the https rule existed.
    await apiUrlItem.setValue('http://swish.example.com');
    await patItem.setValue('tok-123');
    const openOptionsPage = vi.fn(() => Promise.resolve());
    vi.spyOn(browser.runtime, 'openOptionsPage').mockImplementation(
      openOptionsPage,
    );
    const fetchMock = stubFetch(createSavedResponse());

    await handleSave(TAB, undefined);

    expect(openOptionsPage).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('scheduleBadgeClear', () => {
  it('clears the badge once the delay elapses', async () => {
    vi.useFakeTimers();
    await browser.action.setBadgeText({ text: '✓', tabId: TAB.id });

    scheduleBadgeClear(TAB.id);
    await vi.advanceTimersByTimeAsync(BADGE_CLEAR_MS);

    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('');
  });

  it('cancels the pending clear so a second save keeps its badge', async () => {
    vi.useFakeTimers();
    await browser.action.setBadgeText({ text: '✓', tabId: TAB.id });
    scheduleBadgeClear(TAB.id);

    // A second save on the same tab, before the first timer fires.
    await vi.advanceTimersByTimeAsync(BADGE_CLEAR_MS - 500);
    scheduleBadgeClear(TAB.id);

    // The first timer's deadline passes; only the second one may clear.
    await vi.advanceTimersByTimeAsync(600);
    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('✓');

    await vi.advanceTimersByTimeAsync(BADGE_CLEAR_MS);
    expect(await browser.action.getBadgeText({ tabId: TAB.id })).toBe('');
  });
});
