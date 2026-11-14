import { defineConfig } from '@playwright/test';

// End-to-end tests: they start the built app (run `vite build` first, as
// `npm run test:e2e` does) and drive its window. See e2e/support/fixtures.ts.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  // Every test starts its own copy of the app. One at a time keeps the
  // machine usable while they run and the output easy to follow.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
