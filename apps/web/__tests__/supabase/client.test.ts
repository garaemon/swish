import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnvCache } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

function setValidEnv(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.MASTER_KEY = 'cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfdmFsdWVfMTIz';
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
}

describe('supabase client factories', () => {
  const original = { ...process.env };

  beforeEach(() => {
    setValidEnv();
    resetServerEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetServerEnvCache();
    vi.restoreAllMocks();
  });

  it('createSupabaseBrowserClient returns a SupabaseClient instance', () => {
    const client = createSupabaseBrowserClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });

  it('createSupabaseBrowserClient throws if env vars are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createSupabaseBrowserClient()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('createSupabaseServiceClient returns a SupabaseClient instance', () => {
    const client = createSupabaseServiceClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('createSupabaseServiceClient throws if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetServerEnvCache();
    expect(() => createSupabaseServiceClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
