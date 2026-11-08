import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPublicEnv, getServerEnv, resetServerEnvCache } from '@/lib/env';

const REQUIRED_ENV_KEYS = [
  'MASTER_KEY',
  'JWT_SECRET',
  'BETTER_AUTH_SECRET',
  'SIGNUP_ALLOWED_EMAILS',
  'NEXT_PUBLIC_APP_URL',
  'GEMINI_API_ENDPOINT',
] as const;

function setValidEnv(): void {
  process.env.BETTER_AUTH_SECRET = 'a-very-long-better-auth-secret-of-32-chars';
  process.env.MASTER_KEY = 'cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfdmFsdWVfMTIz';
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
}

function clearEnv(): void {
  for (const key of REQUIRED_ENV_KEYS) {
    delete process.env[key];
  }
}

describe('getServerEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearEnv();
    resetServerEnvCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetServerEnvCache();
  });

  it('returns parsed env when all variables are set', () => {
    setValidEnv();
    const env = getServerEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    expect(env.MASTER_KEY).toBeTruthy();
  });

  it('throws "Invalid server environment" listing MASTER_KEY when missing', () => {
    setValidEnv();
    delete process.env.MASTER_KEY;
    resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/^Invalid server environment:[\s\S]*MASTER_KEY/);
  });

  it('throws listing JWT_SECRET when too short', () => {
    setValidEnv();
    process.env.JWT_SECRET = 'short';
    resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/Invalid server environment:[\s\S]*JWT_SECRET/);
  });

  it('throws listing NEXT_PUBLIC_APP_URL when malformed', () => {
    setValidEnv();
    process.env.NEXT_PUBLIC_APP_URL = 'not-a-url';
    resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/Invalid server environment:[\s\S]*NEXT_PUBLIC_APP_URL/);
  });

  it('throws listing BETTER_AUTH_SECRET when too short', () => {
    setValidEnv();
    process.env.BETTER_AUTH_SECRET = 'short';
    resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/Invalid server environment:[\s\S]*BETTER_AUTH_SECRET/);
  });

  it('accepts optional GEMINI_API_ENDPOINT when present and a URL', () => {
    setValidEnv();
    process.env.GEMINI_API_ENDPOINT = 'https://example.test/v1/models';
    const env = getServerEnv();
    expect(env.GEMINI_API_ENDPOINT).toBe('https://example.test/v1/models');
  });
});

describe('getPublicEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearEnv();
    resetServerEnvCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetServerEnvCache();
  });

  it('returns only the NEXT_PUBLIC_* subset', () => {
    setValidEnv();
    const env = getPublicEnv();
    expect(env).toEqual({
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
  });

  it('throws "Invalid public environment" when a NEXT_PUBLIC_* is missing', () => {
    setValidEnv();
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(() => getPublicEnv()).toThrow(/^Invalid public environment:[\s\S]*NEXT_PUBLIC_APP_URL/);
  });
});
