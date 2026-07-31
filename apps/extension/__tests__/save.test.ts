import { describe, it, expect } from 'vitest';
import { resolveSaveTarget, buildSaveFeedback } from '../lib/save';

describe('resolveSaveTarget', () => {
  it('uses the active tab url and title when no link is given', () => {
    const target = resolveSaveTarget({
      url: 'https://a.test/post',
      title: 'A Post',
    });
    expect(target).toEqual({
      ok: true,
      request: { url: 'https://a.test/post', title: 'A Post' },
    });
  });

  it('omits the title when the tab has none', () => {
    const target = resolveSaveTarget({ url: 'https://a.test' });
    expect(target).toEqual({ ok: true, request: { url: 'https://a.test' } });
  });

  it('prefers linkUrl and saves it without a title', () => {
    const target = resolveSaveTarget(
      { url: 'https://page.test', title: 'Page' },
      'https://link.test/target',
    );
    expect(target).toEqual({
      ok: true,
      request: { url: 'https://link.test/target' },
    });
  });

  it('rejects non-http(s) tab urls', () => {
    expect(resolveSaveTarget({ url: 'chrome://extensions' })).toEqual({
      ok: false,
      reason: 'unsavable',
    });
    expect(resolveSaveTarget({ url: 'about:blank' })).toEqual({
      ok: false,
      reason: 'unsavable',
    });
    expect(resolveSaveTarget(undefined)).toEqual({
      ok: false,
      reason: 'unsavable',
    });
  });

  it('rejects a non-http(s) link url', () => {
    expect(
      resolveSaveTarget({ url: 'https://ok.test' }, 'javascript:void(0)'),
    ).toEqual({ ok: false, reason: 'unsavable' });
  });
});

describe('buildSaveFeedback', () => {
  it('shows a green check with no notification on save', () => {
    const feedback = buildSaveFeedback({
      kind: 'saved',
      response: { id: 'x', status: 'pending' },
    });
    expect(feedback.badgeText).toBe('✓');
    expect(feedback.notification).toBeUndefined();
  });

  it('shows an amber badge with no notification on duplicate', () => {
    const feedback = buildSaveFeedback({ kind: 'duplicate' });
    expect(feedback.badgeText).toBe('∅');
    expect(feedback.notification).toBeUndefined();
  });

  it('notifies on auth, http, and network errors', () => {
    for (const result of [
      { kind: 'auth_error' as const },
      { kind: 'http_error' as const, status: 500 },
      { kind: 'network_error' as const, message: 'down' },
    ]) {
      const feedback = buildSaveFeedback(result);
      expect(feedback.badgeText).toBe('!');
      expect(feedback.notification).toBeDefined();
    }
  });

  it('does not claim a failure when the server accepted the request', () => {
    const feedback = buildSaveFeedback({ kind: 'invalid_response' });
    expect(feedback.badgeText).toBe('?');
    expect(feedback.notification?.message).toContain('Check your inbox');
  });
});
