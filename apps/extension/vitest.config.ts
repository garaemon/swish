import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  // WxtVitest swaps the extension APIs for `fakeBrowser`, so modules that talk
  // to chrome.storage (lib/settings.ts) are testable in a plain node run.
  plugins: [WxtVitest()],
  test: {
    environment: 'node',
    // `.tsx` is included so a future component test is picked up. Without it
    // vitest skips the new file silently instead of reporting no tests found.
    include: ['__tests__/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
