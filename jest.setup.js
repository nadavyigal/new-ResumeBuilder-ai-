// Learn more: https://github.com/testing-library/jest-dom
// Make this setup resilient when jsdom helpers are not installed
try {
  require('@testing-library/jest-dom');
} catch {
  // Optional dependency for DOM-based tests; safe to ignore for API/contract tests
}

const { TextDecoder, TextEncoder } = require('util');
const { ReadableStream, TransformStream, WritableStream } = require('stream/web');

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}

if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}

let undiciFetch;
let UndiciHeaders;
let UndiciRequest;
let UndiciResponse;

try {
  ({
    fetch: undiciFetch,
    Headers: UndiciHeaders,
    Request: UndiciRequest,
    Response: UndiciResponse,
  } = require('undici'));
} catch {
  // Node 18+ exposes these globals; keep API/contract tests runnable without undici installed.
}

if (!global.fetch) {
  global.fetch = undiciFetch;
}

if (!global.Headers) {
  global.Headers = UndiciHeaders;
}

if (!global.Request) {
  global.Request = UndiciRequest;
}

if (!global.Response) {
  global.Response = UndiciResponse;
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
