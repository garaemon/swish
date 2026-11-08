// Test config. No network or external services: database-backed tests use
// an in-memory D1 (Miniflare) built by __tests__/helpers/d1.ts.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` throws at import time outside a Server Component. The
      // build-time guarantee is preserved by next build; under vitest the
      // marker is replaced with a no-op so tests can exercise server modules
      // directly.
      'server-only': path.resolve(__dirname, '__tests__/helpers/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    globals: false,
    // Miniflare boots a workerd process per test database.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
