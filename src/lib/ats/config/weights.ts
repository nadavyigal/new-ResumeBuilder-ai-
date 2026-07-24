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
 * - keyword_exact (25%): Most critical - ATS primarily keyword-match
 * - semantic_relevance (18.18%): Important for quality beyond keywords
 * - format_parseability (15.91%): Critical for ATS systems to parse
 * - title_alignment (11.36%): Important for role match
 * - metrics_presence (11.36%): Demonstrates impact
 * - section_completeness (9.09%): Basic hygiene factor
 * - recency_fit (9.1%): Nice-to-have but not critical
 * - keyword_phrase (0%): withdrawn, see below
 *
 * keyword_phrase was withdrawn from the composite on 2026-07-24 (WP-45 D1).
 * It measures verbatim 3-6 word n-gram reuse between the job description and
 * the resume. Over 60 days of production scoring (n=59) it averaged 0.6 on
 * original resumes and 4.2 on optimized ones, out of 100 — the only way to
 * move it is to paste job-description sentences into the resume, which is the
 * keyword-stuffing behavior we do not want to optimize toward. Carrying 12% of
 * the score on a component nobody can earn cost every user ~11.5 points and
 * was a large part of why "strong" (>= 75) had never once been awarded.
 *
 * The analyzer still runs and still feeds suggestions; it just no longer sits
 * in the denominator. The remaining weights are the original ratios rescaled
 * onto the smaller pool (old / 0.88), which preserves the relative ranking
 * documented above. Final weights are S5's decision, not this file's.
 */
export const SUB_SCORE_WEIGHTS: Record<SubScoreKey, number> = {
  keyword_exact: 0.25,
  keyword_phrase: 0,
  semantic_relevance: 0.1818,
  title_alignment: 0.1136,
  metrics_presence: 0.1136,
  section_completeness: 0.0909,
  format_parseability: 0.1591,
  recency_fit: 0.091,
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
