import { beforeAll, describe, expect, it } from 'vitest';
import { APP_URL, isDevServerUp, requireDevServer } from '../../helpers/dev-server';

/**
 * Covers everything about the Google sign-in flow that can be exercised
 * without a real Google account: the callback route's failure branches, its
 * redirect hygiene, and the login page markup.
 *
 * The consent screen and the successful code exchange cannot be automated
 * here — they are on the manual checklist in README.md ("Google sign-in
 * setup").
 */
describe('google sign-in callback', () => {
  let devUp = false;

  beforeAll(async () => {
    devUp = await isDevServerUp();
  });

  it('redirects to /login when no code is present', async () => {
    if (requireDevServer(devUp, 'GET /auth/callback')) {
      return;
    }
    const response = await fetch(`${APP_URL}/auth/callback`, { redirect: 'manual' });
    // 307 also proves middleware.ts lets /auth/* through unauthenticated:
    // an intercepted request would land on /login without an error code.
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=missing_code');
  });

  it('maps a provider error to a code without echoing its message', async () => {
    if (requireDevServer(devUp, 'GET /auth/callback?error=')) {
      return;
    }
    const response = await fetch(
      `${APP_URL}/auth/callback?error=access_denied&error_description=User%20denied%20access`,
      { redirect: 'manual' },
    );
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/login?error=oauth_failed');
    expect(location).not.toContain('denied');
  });

  it('rejects a bogus code against the real GoTrue instance', async () => {
    if (requireDevServer(devUp, 'GET /auth/callback?code=')) {
      return;
    }
    const response = await fetch(`${APP_URL}/auth/callback?code=not-a-real-code`, {
      redirect: 'manual',
    });
    expect(response.headers.get('location')).toContain('/login?error=exchange_failed');
  });

  it('never redirects off-origin, whatever `next` says', async () => {
    if (requireDevServer(devUp, 'GET /auth/callback?next=')) {
      return;
    }
    const response = await fetch(
      `${APP_URL}/auth/callback?code=not-a-real-code&next=https%3A%2F%2Fevil.com`,
      { redirect: 'manual' },
    );
    const location = response.headers.get('location') ?? '';
    expect(new URL(location, APP_URL).origin).toBe(new URL(APP_URL).origin);
  });

  it('renders the Google button on the login page', async () => {
    if (requireDevServer(devUp, 'GET /login')) {
      return;
    }
    const html = await (await fetch(`${APP_URL}/login`)).text();
    expect(html).toContain('Continue with Google');
  });

  it('renders the allow-list rejection message from the error code', async () => {
    if (requireDevServer(devUp, 'GET /login?error=signup_not_allowed')) {
      return;
    }
    const html = await (await fetch(`${APP_URL}/login?error=signup_not_allowed`)).text();
    expect(html).toContain('not allowed to create a Swish account');
  });
});
