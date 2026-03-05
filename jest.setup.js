// Learn more: https://github.com/testing-library/jest-dom
// Make this setup resilient when jsdom helpers are not installed
try {
  require('@testing-library/jest-dom');
} catch {
  // Optional dependency for DOM-based tests; safe to ignore for API/contract tests
}

// Speed up tests that would otherwise invoke Puppeteer/Storage
if (!process.env.BENCH_SKIP_PDF) {
  process.env.BENCH_SKIP_PDF = '1';
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
}
