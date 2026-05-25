import { beforeAll, describe, expect, it } from 'vitest';
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server';

describe('proxy', () => {
  let devUp = false;

  beforeAll(async () => {
    devUp = await isDevServerUp();
  });

  it('redirects unauthenticated requests for protected paths to /login', async () => {
    if (requireDevServer(devUp, 'proxy redirect')) {
      return;
    }
    const response = await fetch(`${APP_URL}/dashboard`, { redirect: 'manual' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('/api/health responds 200 without redirect (proxy matcher excludes /api)', async () => {
    if (requireDevServer(devUp, 'proxy api bypass')) {
      return;
    }
    const response = await fetch(`${APP_URL}/api/health`, { redirect: 'manual' });
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
