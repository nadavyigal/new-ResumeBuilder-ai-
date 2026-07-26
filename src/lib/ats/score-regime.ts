/**
 * Score regime handling (WP-45 S9)
 *
 * Resumely's ATS scores are not comparable across time. Three regimes exist:
 *
 *   1. Pre-2026-06-18. Keyword matching was loose: substrings matched inside
 *      unrelated words, requirements were not atomised, junk phrases counted,
 *      and the optimizer could invent metrics. Monthly means of the optimized
 *      score sat around 60-69, with a maximum of 100.
 *   2. 2026-06-18 to 2026-07-24. Four correct fixes tightened matching without
 *      anyone recalibrating the scale. Means fell to 38-45 and the observed
 *      maximum was 62 — the top third of the range became unreachable, which
 *      is why "strong" was never awarded.
 *   3. From the WP-45 S1/S2 repairs. Dead components were withdrawn or fixed
 *      and both sides of the before/after pair are measured the same way.
 *
 * A chart that averages across those boundaries produces a number that means
 * nothing, and nothing in the data says so. This module makes the boundaries
 * explicit so a caller has to acknowledge them.
 *
 * It deliberately does NOT rescore anything. Rewriting stored scores is a
 * production data change and needs its own decision — a user who already saw a
 * number should not find it silently different later.
 */

export const SCORE_REGIMES = {
  /** Loose keyword matching; scores inflated relative to everything after. */
  legacy_loose: 'legacy_loose',
  /** Tightened matching, uncalibrated bands; scores deflated, top unreachable. */
  tightened_uncalibrated: 'tightened_uncalibrated',
  /** WP-45 S1/S2 repairs; dead components withdrawn, symmetric comparison. */
  wp45_repaired: 'wp45_repaired',
  /** WP-45 D7; recency decoupled from keyword overlap and made two-sided. */
  wp45_recency_fixed: 'wp45_recency_fixed',
} as const;

export type ScoreRegime = (typeof SCORE_REGIMES)[keyof typeof SCORE_REGIMES];

/** The day the tightening fixes began landing (#80, #82, #85, stripFabricatedMetrics). */
export const TIGHTENING_BOUNDARY = new Date('2026-06-18T00:00:00Z');

/** The day the WP-45 S1/S2 repairs landed. */
export const WP45_BOUNDARY = new Date('2026-07-24T00:00:00Z');

/**
 * The day recency_fit stopped being a keyword multiplier (WP-45 D7).
 *
 * Recency was `latestRoleBonus * avgDecay`, so a current role that did not echo
 * the job's keywords scored 0, and the subscore was only resolved on one side
 * of the comparison. Fixing both raises recency for most resumes — typically
 * from 0-50 into the 70-100 band — which moves the composite by several points
 * for reasons that have nothing to do with the resumes. Scores either side of
 * this boundary are not comparable.
 */
export const RECENCY_BOUNDARY = new Date('2026-07-26T00:00:00Z');

/**
 * Which regime produced a stored score?
 *
 * `scoreVersion` is authoritative when present — it is stamped at scoring time.
 * Rows written before versioning are dated instead, which is a best effort and
 * is why the version stamp exists.
 */
export function regimeFor(row: { scoredAt: Date | string; scoreVersion?: string | null }): ScoreRegime {
  // Most specific version first. A plain `includes('wp45')` check would sort
  // the D7 recency regime into wp45_repaired and hide the boundary it exists
  // to mark.
  if (row.scoreVersion?.includes('d7')) {
    return SCORE_REGIMES.wp45_recency_fixed;
  }
  if (row.scoreVersion?.includes('wp45')) {
    return SCORE_REGIMES.wp45_repaired;
  }

  const scoredAt = row.scoredAt instanceof Date ? row.scoredAt : new Date(row.scoredAt);

  if (scoredAt >= RECENCY_BOUNDARY) return SCORE_REGIMES.wp45_recency_fixed;
  if (scoredAt >= WP45_BOUNDARY) return SCORE_REGIMES.wp45_repaired;
  if (scoredAt >= TIGHTENING_BOUNDARY) return SCORE_REGIMES.tightened_uncalibrated;
  return SCORE_REGIMES.legacy_loose;
}

export interface ComparabilityVerdict {
  comparable: boolean;
  regimes: ScoreRegime[];
  /** Machine-readable explanation when not comparable. */
  reason?: 'mixed_regimes';
}

/**
 * Are these rows safe to trend, average or compare against each other?
 *
 * Call this before computing any aggregate over stored scores. A false here
 * means the aggregate is meaningless, not merely noisy.
 */
export function assertComparable(
  rows: Array<{ scoredAt: Date | string; scoreVersion?: string | null }>
): ComparabilityVerdict {
  const regimes = Array.from(new Set(rows.map(regimeFor)));
  if (regimes.length <= 1) return { comparable: true, regimes };
  return { comparable: false, regimes, reason: 'mixed_regimes' };
}

/**
 * Keep only the rows from a single regime, newest regime by default.
 *
 * The honest alternative to averaging across a boundary: say which regime the
 * number covers and drop the rest, rather than quietly blending them.
 */
export function restrictToRegime<T extends { scoredAt: Date | string; scoreVersion?: string | null }>(
  rows: T[],
  regime: ScoreRegime = SCORE_REGIMES.wp45_repaired
): T[] {
  return rows.filter(row => regimeFor(row) === regime);
}
