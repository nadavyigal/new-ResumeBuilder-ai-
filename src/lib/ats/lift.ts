/**
 * Lift assessment (WP-45 S2)
 *
 * A moderated user session on 2026-07-24 showed a resume scoring 42 before
 * optimization and 44 after. Over 60 days, 24 of 59 optimizations (41%) ended
 * at +4 or worse and 6 of them ended lower than they started.
 *
 * A result that does not meaningfully improve on where the user began is a
 * pipeline failure. This module decides that, and nothing else: it never
 * changes a score, never clamps a delta positive, and never applies a floor.
 * The honest response to a failed optimization is to withhold the number and
 * say what is still missing — not to make the number look better.
 */

import type { SubScores } from './types';

/**
 * Minimum improvement, in composite points, that counts as a real result.
 *
 * Provisional. WP-45 S5 selects the final value from the labelled benchmark;
 * this is a conservative placeholder chosen so that the observed failure cases
 * (+2, +1, 0, negative) are caught while the genuine improvements in the same
 * 60-day sample (median +9.4 among those that moved) are not.
 *
 * Deliberately a named constant and not a tunable: nudging this number is how
 * a "no lift" problem gets redefined out of existence instead of fixed.
 */
export const MIN_MEANINGFUL_LIFT = 5;

export type DeltaBucket = 'negative' | '0_to_4' | '5_to_9' | '10_plus';

export interface LiftAssessment {
  /** The original composite, unmodified. */
  original: number;
  /** The optimized composite, unmodified. */
  optimized: number;
  /** optimized - original. Negative values are preserved, never clamped. */
  delta: number;
  /** True when the delta clears MIN_MEANINGFUL_LIFT. */
  meaningful: boolean;
  /**
   * Whether the caller should show the user a before/after number pair.
   *
   * False does not mean "hide the result" — it means show what changed and
   * what is still missing, without a numeric pair that reads as a promise the
   * optimization did not keep.
   */
  displayScores: boolean;
  /** Components that did not move, for diagnosis. Never user-facing text. */
  stalledComponents: string[];
  /** Privacy-safe payload for the optimization_no_lift event. */
  analyticsProperties: Record<string, string | number | boolean>;
}

export function bucketDelta(delta: number): DeltaBucket {
  if (delta < 0) return 'negative';
  if (delta < 5) return '0_to_4';
  if (delta < 10) return '5_to_9';
  return '10_plus';
}

export function assessLift(params: {
  original: number;
  optimized: number;
  subscoresOriginal?: Partial<SubScores>;
  subscores?: Partial<SubScores>;
  passesUsed?: number;
}): LiftAssessment {
  const { original, optimized, subscoresOriginal, subscores, passesUsed } = params;

  const delta = optimized - original;
  const meaningful = delta >= MIN_MEANINGFUL_LIFT;

  const stalledComponents =
    subscoresOriginal && subscores
      ? (Object.keys(subscores) as Array<keyof SubScores>)
          .filter(key => {
            const before = subscoresOriginal[key];
            const after = subscores[key];
            return typeof before === 'number' && typeof after === 'number' && after <= before;
          })
          .map(String)
          .sort()
      : [];

  return {
    original,
    optimized,
    delta,
    meaningful,
    displayScores: meaningful,
    stalledComponents,
    analyticsProperties: {
      // Buckets rather than raw scores: this event exists to count failures,
      // not to reconstruct anybody's resume quality from analytics.
      delta_bucket: bucketDelta(delta),
      meaningful_lift: meaningful,
      stalled_component_count: stalledComponents.length,
      ...(stalledComponents.length > 0
        ? { top_stalled_component: stalledComponents[0] }
        : {}),
      ...(typeof passesUsed === 'number' ? { passes_used: passesUsed } : {}),
    },
  };
}
