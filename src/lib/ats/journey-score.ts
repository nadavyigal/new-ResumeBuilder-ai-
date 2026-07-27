/**
 * The journey score contract (WP-45 D8)
 *
 * A moderated run on 2026-07-27 showed one user three different score pairs for
 * one resume and one job: 39 → 46 at the fit check, 39 → 40 on accept, and then
 * 29 → 60 after an expert pass. The stored rows show why. The review run
 * measured 39/46 at 06:59:00; the accept path re-measured 46 seconds later and
 * got 29/57 — and its original-side subscores were
 *
 *   keyword_exact 0 · semantic_relevance 0 · section_completeness 0 ·
 *   metrics_presence 0 · format_parseability 100
 *
 * Four analyzers at exactly zero with *perfect* format parseability is what an
 * EMPTY document scores: nothing to match, nothing formatted badly. The user's
 * resume is 3376 characters with real headers and five dated roles. So 29 was
 * never a low score — it was a non-measurement that got persisted and shown.
 *
 * The defect underneath is architectural, not arithmetic: the baseline was
 * RECOMPUTED at three separate points (review creation, accept, and every
 * rescan), and each recomputation is a fresh opportunity to disagree.
 *
 * This module states the contract instead:
 *
 *   1. The baseline is measured ONCE, when the journey starts, and is then
 *      immutable. Nothing downstream may recompute it.
 *   2. The optimized side MAY be re-measured — accepting a subset of changes
 *      genuinely produces a different document — but always against the same
 *      immutable baseline, so a smaller acceptance yields a smaller gain rather
 *      than a different starting point (founder direction 2026-07-27).
 *   3. A measurement that cannot be true is refused, not stored.
 */

import type { SubScores } from './types';

/** A baseline, once measured, and the evidence it was measured from. */
export interface JourneyBaseline {
  /** The score the user was first shown. Immutable for the life of the journey. */
  readonly score: number;
  /** Where it came from, for diagnosis when two paths disagree. */
  readonly source: 'review_run' | 'free_check' | 'initial_scoring';
}

/**
 * Is this original-side measurement physically possible?
 *
 * The scorer writes 0 for an analyzer that threw and computes a real 0 for a
 * document with no content. Either way, several independent analyzers reading
 * exactly 0 while format_parseability reads high means the thing scored was not
 * a resume. Storing that number tells a user their CV is worth 29.
 *
 * Deliberately narrow: it fires on the impossible combination, not on a merely
 * low score. A genuinely weak resume still has semantic relevance above zero,
 * because cosine similarity between two real documents is never exactly 0.
 */
export function isImpossibleMeasurement(subscores: Partial<SubScores> | null | undefined): boolean {
  if (!subscores) return true;

  const zeroed = (['keyword_exact', 'semantic_relevance', 'section_completeness'] as const).filter(
    key => (subscores[key] ?? 0) === 0
  );

  // Semantic relevance is the load-bearing one. Its own no-data fallback is 50,
  // so a 0 means the analyzer threw or was handed nothing.
  const semanticIsZero = (subscores.semantic_relevance ?? 0) === 0;
  const formatLooksPerfect = (subscores.format_parseability ?? 0) >= 95;

  return semanticIsZero && (zeroed.length >= 3 || formatLooksPerfect);
}

export class ImpossibleMeasurementError extends Error {
  constructor(readonly subscores: Partial<SubScores> | null | undefined) {
    super(
      'Refusing to store an ATS measurement whose original side reads as an empty document. ' +
        'This is a scoring-input failure, not a low-scoring resume.'
    );
    this.name = 'ImpossibleMeasurementError';
  }
}

/**
 * The pair to persist and display for a completed step of the journey.
 *
 * `before` is the baseline, passed through untouched. `after` is the fresh
 * measurement of whatever the user actually accepted, floored at the baseline
 * so the number can never present as a regression — the raw value is returned
 * alongside so a regression is still visible to us.
 */
export interface JourneyScorePair {
  before: number;
  after: number;
  /** The unfloored measurement. Diagnostics only, never displayed. */
  measuredAfter: number;
  /** True when the floor had to engage, i.e. the pipeline went backwards. */
  regressed: boolean;
}

export function resolveJourneyScores(args: {
  baseline: JourneyBaseline;
  measuredOptimized: number | null | undefined;
  /** The full-optimization score the fit check promised, when there was one. */
  promisedOptimized?: number | null;
}): JourneyScorePair {
  const { baseline, measuredOptimized, promisedOptimized } = args;

  // With no fresh measurement, the honest answer is the promise we already made,
  // and failing that, no movement at all.
  const measured = typeof measuredOptimized === 'number' && Number.isFinite(measuredOptimized)
    ? measuredOptimized
    : typeof promisedOptimized === 'number'
      ? promisedOptimized
      : baseline.score;

  return {
    before: baseline.score,
    after: Math.max(baseline.score, measured),
    measuredAfter: measured,
    regressed: measured < baseline.score,
  };
}
