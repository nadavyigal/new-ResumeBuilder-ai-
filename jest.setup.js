// Learn more: https://github.com/testing-library/jest-dom
// Make this setup resilient when jsdom helpers are not installed
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@testing-library/jest-dom');
} catch {
  // Optional dependency for DOM-based tests; safe to ignore for API/contract tests
}

// Speed up tests that would otherwise invoke Puppeteer/Storage
if (!process.env.BENCH_SKIP_PDF) {
  process.env.BENCH_SKIP_PDF = '1';
}
