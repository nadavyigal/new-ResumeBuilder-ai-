/**
 * Impact Estimator
 *
 * Estimates the score gain from applying a suggestion.
 */

import type { SubScoreKey } from '../types';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

/** Round to one decimal. Gains are small enough that integers erase them. */
function toDisplayPoints(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Estimate the impact of fixing a gap, in FINAL SCORE points.
 *
 * The unit chain matters and used to be wrong (WP-59 S1):
 *
 *   maxPossibleGain  is in SUB-SCORE points   (0-100 on one component)
 *   weight           is a fraction            (0.09 - 0.25)
 *   product          is in FINAL SCORE points — already, with no scaling
 *
 * The previous implementation multiplied that product by 100 and then clamped
 * the result to 15. Every real value is between 0.36 and 3.75 (template gains
 * run 4-15, weights 0.09-0.25), so multiplying by 100 pushed every single
 * suggestion past the clamp and every single one displayed as exactly 15. That
 * is the "+15 / +15 / +15" a user sees beside an apply that moves the score by
 * seven — the clamp is what made the bug invisible, because a wrong number that
 * varied would have been noticed years ago.
 *
 * There is no display scaling here now. If a suggestion is worth two points,
 * it says two points, and the sum of what we promise is a number apply can
 * actually deliver.
 */
export function estimateImpact(
  subscore: SubScoreKey,
  currentScore: number,
  templateGain: number
): number {
  const weight = SUB_SCORE_WEIGHTS[subscore];

  // How much room this component has left, and how much the advice can close.
  const gap = Math.max(0, 100 - currentScore);
  const maxPossibleGain = Math.min(gap, templateGain);

  return toDisplayPoints(maxPossibleGain * weight);
}

/**
 * Estimate the total impact if every suggestion is applied.
 *
 * Previously capped at a flat 30 "realistic maximum", which was neither
 * measured nor reachable — and, sitting downstream of a 100x per-suggestion
 * error, it was the second thing hiding the first. The honest ceiling is the
 * headroom the score actually has: a resume at 67 cannot gain 40 points.
 */
export function estimateTotalImpact(
  suggestions: Array<{ estimated_gain: number }>,
  currentScore?: number
): number {
  const totalGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);

  if (typeof currentScore === 'number' && Number.isFinite(currentScore)) {
    return toDisplayPoints(Math.min(totalGain, Math.max(0, 100 - currentScore)));
  }

  return toDisplayPoints(totalGain);
}

/**
 * Prioritize suggestions by ROI (return on investment)
 */
export function prioritizeByROI(
  suggestions: Array<{ estimated_gain: number; quick_win: boolean }>
): Array<{ index: number; roi: number }> {
  return suggestions
    .map((suggestion, index) => ({
      index,
      roi: suggestion.quick_win ? suggestion.estimated_gain * 1.5 : suggestion.estimated_gain,
    }))
    .sort((a, b) => b.roi - a.roi);
}
