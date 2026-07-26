/**
 * Fit band thresholds (WP-45 S5)
 *
 * One definition, shared by the web response builder and mirrored by iOS.
 *
 * These replace the previous strong >= 75 / stretch >= 50, which were set for
 * the scoring scale that existed before 2026-06-18. On the current scale those
 * thresholds classified 4 of 19 labelled pairs as Weak when a human called them
 * Strong or Stretch — a 26.7% false-Weak rate — and told roughly three in four
 * free-checker users to skip the job.
 *
 * Selected by sweeping integer cut points over the labelled benchmark in
 * `src/lib/ats/benchmark/`, maximising accuracy with ties broken toward fewer
 * false-Weak calls. Run with real embeddings on 2026-07-26:
 *
 *   published 75/50 : accuracy 0.79, false-Weak 4 of 15 (26.7%)
 *   derived   57/42 : accuracy 0.95, false-Weak 1 of 15 (6.7%), Strong reached
 *   holdout (n=6)   : accuracy 0.67, false-Weak 0 (0.0%)
 *
 * The packet's gates are met: Strong is reachable and actually reached (8 of 8
 * labelled Strong pairs score 76-90), the false-Weak rate is under 10%, no
 * threshold rescues a labelled Weak pair into Strong, and calibration and
 * holdout are reported separately.
 *
 * CARRIED CAVEAT: the benchmark labels were written by the same author as the
 * fixtures. The packet asks for independent labels, and that is still owed.
 * Treat these thresholds as evidence-based but not externally validated, and
 * re-run the sweep if the labels are ever revised.
 *
 * Anything that changes what the scorer counts changes this scale. Re-run the
 * benchmark in the same change and move these deliberately, with the date.
 */
export const FIT_BANDS = {
  /** At or above this is a strong match. */
  strong: 57,
  /** At or above this (and below strong) is a stretch. Below it is weak. */
  stretch: 42,
} as const;

export type FitBandName = 'strong' | 'stretch' | 'weak';

export function fitBandFor(score: number): FitBandName {
  if (!Number.isFinite(score)) return 'weak';
  if (score >= FIT_BANDS.strong) return 'strong';
  if (score >= FIT_BANDS.stretch) return 'stretch';
  return 'weak';
}
