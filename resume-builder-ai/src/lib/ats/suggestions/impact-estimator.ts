/**
 * Impact Estimator
 *
 * Estimates the score gain from applying a suggestion
 */

import type { SubScoreKey } from '../types';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

/**
 * Estimate impact of fixing a gap
 *
 * Takes into account:
 * - Current score gap
 * - Sub-score weight in final score
 * - Baseline template gain
 */
export function estimateImpact(
  subscore: SubScoreKey,
  currentScore: number,
  templateGain: number
): number {
  const weight = SUB_SCORE_WEIGHTS[subscore];

  // Calculate potential gain in this sub-score
  const gap = 100 - currentScore;
  const maxPossibleGain = Math.min(gap, templateGain);

  // Impact on final score = sub-score gain × weight
  const finalScoreImpact = maxPossibleGain * weight;

  // Scale to 0-15 range for display
  return Math.round(Math.min(15, finalScoreImpact * 100));
}

/**
 * Estimate total impact if all suggestions applied
 */
export function estimateTotalImpact(
  suggestions: Array<{ estimated_gain: number }>
): number {
  // Sum all gains, but cap at realistic maximum
  const totalGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);

  // Cap at 30 points (realistic maximum improvement)
  return Math.min(30, totalGain);
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
