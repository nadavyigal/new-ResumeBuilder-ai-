/**
 * The fixed "today" every repeat-eval run is scored against.
 *
 * Fixtures say "Present" and the scorer resolves it with `new Date()`
 * (`src/lib/ats/analyzers/recency-fit.ts:21`), so without a pinned date the same
 * input scores differently as the calendar advances and two batches a month apart
 * are not comparable. The repeat runner fakes `Date` only, never the timers the
 * OpenAI client and the pipeline's own timeouts rely on.
 *
 * The model is never told the date, so it can still reason about "Present" from its
 * own sense of now. That part cannot be pinned from the harness and is recorded as a
 * known limit, not hidden.
 */
export const EVALUATION_DATE = '2026-09-01';
export const EVALUATION_DATE_MS = Date.parse(`${EVALUATION_DATE}T12:00:00.000Z`);
export const EVALUATION_YEAR = 2026;

/**
 * Jest fake-timer config that fakes Date and nothing else. Passing this to
 * `jest.useFakeTimers` freezes `new Date()` at the evaluation date while real
 * setTimeout, setImmediate and performance.now keep working, so network timeouts,
 * SDK backoff and latency measurement are unaffected.
 */
export const DATE_ONLY_FAKE_TIMERS = {
  now: EVALUATION_DATE_MS,
  doNotFake: [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
  ],
} as const;
