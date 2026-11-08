import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

function requestFor(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe('middleware', () => {
  it('redirects to /login when there is no session cookie', () => {
    const response = middleware(requestFor('/dashboard'));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });

  it('lets public pages through without a cookie', () => {
    for (const path of ['/login', '/signup']) {
      expect(middleware(requestFor(path)).headers.get('location')).toBeNull();
    }
  });

  it('lets requests with a session cookie through', () => {
    const response = middleware(requestFor('/dashboard', 'better-auth.session_token=abc.def'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('accepts the __Secure- prefixed cookie used over HTTPS', () => {
    const response = middleware(requestFor('/dashboard', '__Secure-better-auth.session_token=abc.def'));
    expect(response.headers.get('location')).toBeNull();
  });
});
