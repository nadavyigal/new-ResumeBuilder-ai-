import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the activation-path E2E.
 *
 * Scope is deliberately narrow. These specs cover the anonymous free ATS check
 * surface -- the first meaningful step of the funnel, and the one the numbers say
 * leaks worst (73 first-seen -> 9 ever upload). They run with NO secrets: the
 * `/api/public/ats-check` call is intercepted, so Supabase and OpenAI are never
 * reached and the result is deterministic.
 *
 * What this does NOT cover, stated so a green run is not over-read: the
 * authenticated optimize -> export path. `/api/optimizations/export` requires a
 * Supabase-authed user, so covering it needs a seeded test account and CI
 * secrets. That is a separate job, not a wider glob here.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
