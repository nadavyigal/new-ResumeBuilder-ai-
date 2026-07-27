/**
 * The journey score contract (WP-45 D8)
 *
 * Reproduces the 2026-07-27 report: one resume, one job, three different score
 * pairs shown to one user — 39 → 46, then 39 → 40, then 29 → 60.
 */

import {
  isImpossibleMeasurement,
  resolveJourneyScores,
  type JourneyBaseline,
} from '../journey-score';
import type { SubScores } from '../types';

/** The original-side subscores actually persisted for the reported run. */
const THE_REPORTED_NON_MEASUREMENT: Partial<SubScores> = {
  recency_fit: 50,
  keyword_exact: 0,
  keyword_phrase: 0,
  title_alignment: 20,
  metrics_presence: 0,
  semantic_relevance: 0,
  format_parseability: 100,
  section_completeness: 0,
};

/** A genuinely weak resume, which must still be accepted as a real score. */
const A_REALLY_BAD_RESUME: Partial<SubScores> = {
  recency_fit: 50,
  keyword_exact: 4,
  keyword_phrase: 0,
  title_alignment: 10,
  metrics_presence: 0,
  semantic_relevance: 31,
  format_parseability: 62,
  section_completeness: 25,
};

describe('refusing measurements that cannot be true', () => {
  it('rejects the exact subscores that produced the reported 29', () => {
    // Four analyzers at zero AND perfect format parseability is what an empty
    // document scores. The user's resume was 3376 characters.
    expect(isImpossibleMeasurement(THE_REPORTED_NON_MEASUREMENT)).toBe(true);
  });

  it('accepts a genuinely low-scoring resume', () => {
    // The guard must not become a floor on bad news.
    expect(isImpossibleMeasurement(A_REALLY_BAD_RESUME)).toBe(false);
  });

  it('rejects a missing measurement outright', () => {
    expect(isImpossibleMeasurement(null)).toBe(true);
    expect(isImpossibleMeasurement(undefined)).toBe(true);
  });

  it('does not reject on a zero semantic score alone', () => {
    // Semantic zero is the load-bearing signal, but on its own — with the rest
    // of the document scoring normally — it is one broken analyzer, not an
    // empty document, and the other subscores are still worth keeping.
    expect(
      isImpossibleMeasurement({
        ...A_REALLY_BAD_RESUME,
        semantic_relevance: 0,
        format_parseability: 62,
      })
    ).toBe(false);
  });
});

describe('the baseline is immutable', () => {
  const baseline: JourneyBaseline = { score: 39, source: 'review_run' };

  it('keeps the starting number the user was first shown', () => {
    // The reported failure: accept re-measured the untouched original and
    // reported 29, so the journey started 10 points below where the user began.
    const pair = resolveJourneyScores({ baseline, measuredOptimized: 57 });

    expect(pair.before).toBe(39);
  });

  it('gives a partial acceptance a smaller gain, not a different start', () => {
    // Founder direction 2026-07-27: if the full potential was +10 and the user
    // accepts some of it, they should see less than +10 — measured, not capped.
    const full = resolveJourneyScores({ baseline, measuredOptimized: 49 });
    const partial = resolveJourneyScores({
      baseline,
      measuredOptimized: 43,
      promisedOptimized: 49,
    });

    expect(full.after - full.before).toBe(10);
    expect(partial.after - partial.before).toBe(4);
    expect(partial.before).toBe(full.before);
  });

  it('never presents a gain below zero', () => {
    const pair = resolveJourneyScores({ baseline, measuredOptimized: 31 });

    expect(pair.after).toBe(39);
    expect(pair.after).toBeGreaterThanOrEqual(pair.before);
  });

  it('still records a regression even while hiding it', () => {
    const pair = resolveJourneyScores({ baseline, measuredOptimized: 31 });

    expect(pair.regressed).toBe(true);
    expect(pair.measuredAfter).toBe(31);
  });

  it('falls back to the promise rather than inventing a number', () => {
    const pair = resolveJourneyScores({
      baseline,
      measuredOptimized: null,
      promisedOptimized: 46,
    });

    expect(pair.after).toBe(46);
  });

  it('shows no movement when there is neither a measurement nor a promise', () => {
    const pair = resolveJourneyScores({ baseline, measuredOptimized: undefined });

    expect(pair.before).toBe(39);
    expect(pair.after).toBe(39);
  });

  it('reproduces the reported journey end to end', () => {
    // Fit check promised 39 → 46. The user accepted a subset that genuinely
    // measures 43. Under the old code this became 29 → 57.
    const accepted = resolveJourneyScores({
      baseline: { score: 39, source: 'review_run' },
      measuredOptimized: 43,
      promisedOptimized: 46,
    });

    expect(accepted.before).toBe(39);
    expect(accepted.after).toBe(43);

    // An expert pass later measures 60. The start still does not move.
    const afterExpert = resolveJourneyScores({
      baseline: { score: 39, source: 'review_run' },
      measuredOptimized: 60,
    });

    expect(afterExpert.before).toBe(39);
    expect(afterExpert.after).toBe(60);
  });
});
