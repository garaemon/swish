import { describe, expect, it } from 'vitest';
import { LOGIN_ERROR_MESSAGES, loginErrorMessage } from '@/lib/auth/login-errors';

describe('loginErrorMessage', () => {
  it('maps every known code to non-empty copy', () => {
    for (const code of Object.keys(LOGIN_ERROR_MESSAGES)) {
      expect(loginErrorMessage(code)).toBeTruthy();
    }
  });

  it('returns null for an absent code', () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage('')).toBeNull();
  });

  it('returns null for an unknown code rather than echoing it', () => {
    expect(loginErrorMessage('something_else')).toBeNull();
    // Prototype keys must not leak through the lookup.
    expect(loginErrorMessage('toString')).toBeNull();
    expect(loginErrorMessage('constructor')).toBeNull();
  });
});
