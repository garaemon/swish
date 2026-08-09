import { describe, expect, it } from 'vitest';
import { isFreshOAuthSignup, type OAuthUserLike } from '@/lib/auth/oauth-user';

const NOW = Date.parse('2026-08-09T12:00:00.000Z');

function userAgedMs(ms: number, identities: OAuthUserLike['identities']): OAuthUserLike {
  return { created_at: new Date(NOW - ms).toISOString(), identities };
}

describe('isFreshOAuthSignup', () => {
  it('is true for a just-created row with only the provider identity', () => {
    const user = userAgedMs(2_000, [{ provider: 'google' }]);
    expect(isFreshOAuthSignup(user, 'google', NOW)).toBe(true);
  });

  it('is false when the account carries another identity', () => {
    // GoTrue links Google onto an existing email/password user when the
    // verified address matches. Deleting that user would be data loss, so
    // this is the case the identity check exists for.
    const user = userAgedMs(2_000, [{ provider: 'email' }, { provider: 'google' }]);
    expect(isFreshOAuthSignup(user, 'google', NOW)).toBe(false);
  });

  it('is false when the single identity is a different provider', () => {
    const user = userAgedMs(2_000, [{ provider: 'github' }]);
    expect(isFreshOAuthSignup(user, 'google', NOW)).toBe(false);
  });

  it('is false for an established row', () => {
    const user = userAgedMs(90 * 24 * 60 * 60 * 1000, [{ provider: 'google' }]);
    expect(isFreshOAuthSignup(user, 'google', NOW)).toBe(false);
  });

  it('is false when identities are unknown or empty', () => {
    expect(isFreshOAuthSignup(userAgedMs(1_000, undefined), 'google', NOW)).toBe(false);
    expect(isFreshOAuthSignup(userAgedMs(1_000, null), 'google', NOW)).toBe(false);
    expect(isFreshOAuthSignup(userAgedMs(1_000, []), 'google', NOW)).toBe(false);
  });

  it('is false for an unparseable created_at', () => {
    const user: OAuthUserLike = {
      created_at: 'not-a-date',
      identities: [{ provider: 'google' }],
    };
    expect(isFreshOAuthSignup(user, 'google', NOW)).toBe(false);
  });

  it('is false at and beyond the window, and for a future timestamp', () => {
    expect(isFreshOAuthSignup(userAgedMs(60_000, [{ provider: 'google' }]), 'google', NOW))
      .toBe(false);
    expect(isFreshOAuthSignup(userAgedMs(59_999, [{ provider: 'google' }]), 'google', NOW))
      .toBe(true);
    expect(isFreshOAuthSignup(userAgedMs(-5_000, [{ provider: 'google' }]), 'google', NOW))
      .toBe(false);
  });
});
