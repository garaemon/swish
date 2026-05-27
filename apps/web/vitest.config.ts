// Unit-test config (no DB / network access). Integration tests are added
// in a later PR with their own config; the exclude below is set up here
// so a future `__tests__/integration` folder is automatically kept out of
// the unit run.
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
    exclude: ['__tests__/**/integration/**'],
    globals: false,
  },
});
