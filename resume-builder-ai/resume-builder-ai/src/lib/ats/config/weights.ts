/**
 * Weight configuration for ATS v2 scoring
 *
 * These weights determine the relative importance of each sub-score
 * in the final aggregate ATS score. Weights must sum to 1.0.
 */

import type { SubScoreKey } from '../types';

/**
 * Sub-score weights (must sum to 1.0)
 *
 * Rationale for weight distribution:
 * - keyword_exact (22%): Most critical - ATS primarily keyword-match
 * - semantic_relevance (16%): Important for quality beyond keywords
 * - format_parseability (14%): Critical for ATS systems to parse
 * - keyword_phrase (12%): Captures context beyond single keywords
 * - title_alignment (10%): Important for role match
 * - metrics_presence (10%): Demonstrates impact
 * - section_completeness (8%): Basic hygiene factor
 * - recency_fit (8%): Nice-to-have but not critical
 */
export const SUB_SCORE_WEIGHTS: Record<SubScoreKey, number> = {
  keyword_exact: 0.22,
  keyword_phrase: 0.12,
  semantic_relevance: 0.16,
  title_alignment: 0.10,
  metrics_presence: 0.10,
  section_completeness: 0.08,
  format_parseability: 0.14,
  recency_fit: 0.08,
};

/**
 * Validate that weights sum to 1.0 (with small tolerance for floating point)
 */
export function validateWeights(): { valid: boolean; sum: number; error?: string } {
  const sum = Object.values(SUB_SCORE_WEIGHTS).reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 1.0) < 0.0001;

  return {
    valid,
    sum,
    error: valid ? undefined : `Weights sum to ${sum.toFixed(4)}, expected 1.0`,
  };
}

/**
 * Get normalized weights (in case of rounding errors)
 */
export function getNormalizedWeights(): Record<SubScoreKey, number> {
  const validation = validateWeights();
  if (validation.valid) {
    return SUB_SCORE_WEIGHTS;
  }

  // Normalize by dividing by sum
  const normalized: Record<string, number> = {};
  for (const [key, weight] of Object.entries(SUB_SCORE_WEIGHTS)) {
    normalized[key] = weight / validation.sum;
  }

  return normalized as Record<SubScoreKey, number>;
}

/**
 * Get adjusted weights when an analyzer fails
 * Redistributes failed analyzer's weight proportionally to others
 */
export function getAdjustedWeights(failedAnalyzers: SubScoreKey[]): Record<SubScoreKey, number> {
  if (failedAnalyzers.length === 0) {
    return SUB_SCORE_WEIGHTS;
  }

  // Calculate total weight of failed analyzers
  const failedWeight = failedAnalyzers.reduce(
    (sum, key) => sum + SUB_SCORE_WEIGHTS[key],
    0
  );

  // Calculate remaining weight
  const remainingWeight = 1.0 - failedWeight;

  // Redistribute proportionally
  const adjusted: Record<string, number> = {};
  for (const key of Object.keys(SUB_SCORE_WEIGHTS) as SubScoreKey[]) {
    if (failedAnalyzers.includes(key)) {
      adjusted[key] = 0;
    } else {
      // Scale up remaining weights proportionally
      adjusted[key] = SUB_SCORE_WEIGHTS[key] / remainingWeight;
    }
  }

  return adjusted as Record<SubScoreKey, number>;
}

// Validate on module load
const validation = validateWeights();
if (!validation.valid) {
  console.warn(`[ATS Config Warning] ${validation.error}`);
}
