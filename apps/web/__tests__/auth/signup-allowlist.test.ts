import { describe, expect, it } from 'vitest';
import { isSignupAllowed, parseSignupAllowlist } from '@/lib/auth/signup-allowlist';

describe('parseSignupAllowlist', () => {
  it('returns an empty list for unset, empty, or separator-only values', () => {
    expect(parseSignupAllowlist(undefined)).toEqual([]);
    expect(parseSignupAllowlist('')).toEqual([]);
    expect(parseSignupAllowlist(',  ,')).toEqual([]);
  });

  it('trims and lower-cases entries', () => {
    expect(parseSignupAllowlist(' Me@Example.COM , @Other.org ')).toEqual([
      'me@example.com',
      '@other.org',
    ]);
  });
});

describe('isSignupAllowed', () => {
  it('allows anyone when no list is configured', () => {
    expect(isSignupAllowed('stranger@example.com', undefined)).toBe(true);
    expect(isSignupAllowed('stranger@example.com', '')).toBe(true);
    // Even an unknown identity: without a list there is nothing to enforce.
    expect(isSignupAllowed(null, undefined)).toBe(true);
  });

  it('matches an exact address regardless of case or padding', () => {
    expect(isSignupAllowed('Me@Example.com', ' me@example.com ')).toBe(true);
    expect(isSignupAllowed('  me@example.com  ', 'me@example.com')).toBe(true);
  });

  it('rejects an address that is not listed', () => {
    expect(isSignupAllowed('someone@example.com', 'me@example.com')).toBe(false);
  });

  it('matches a domain entry written with a leading @', () => {
    expect(isSignupAllowed('anyone@example.com', '@example.com')).toBe(true);
  });

  it('treats a bare domain entry the same as @domain', () => {
    expect(isSignupAllowed('anyone@example.com', 'example.com')).toBe(true);
  });

  it('does not match subdomains or lookalike domains', () => {
    expect(isSignupAllowed('a@sub.example.com', '@example.com')).toBe(false);
    expect(isSignupAllowed('a@notexample.com', '@example.com')).toBe(false);
    expect(isSignupAllowed('a@example.com.evil.io', '@example.com')).toBe(false);
  });

  it('honours any entry in a multi-entry list', () => {
    const list = 'me@example.com, @company.test';
    expect(isSignupAllowed('me@example.com', list)).toBe(true);
    expect(isSignupAllowed('someone@company.test', list)).toBe(true);
    expect(isSignupAllowed('someone@elsewhere.test', list)).toBe(false);
  });

  it('fails closed on a missing address once a list is configured', () => {
    expect(isSignupAllowed(null, '@example.com')).toBe(false);
    expect(isSignupAllowed(undefined, '@example.com')).toBe(false);
    expect(isSignupAllowed('', '@example.com')).toBe(false);
  });

  it('rejects a value with no domain part', () => {
    expect(isSignupAllowed('nodomain', '@example.com')).toBe(false);
  });
});
