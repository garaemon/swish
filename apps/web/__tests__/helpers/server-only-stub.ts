// Empty replacement for the `server-only` build-time marker so vitest can
// import modules that rely on `import 'server-only'`. The real marker
// throws at import time when bundled into a Client Component module; under
// the test runner there is no such distinction, so a no-op file is safe
// and lets us exercise service-role code directly.
export {};
