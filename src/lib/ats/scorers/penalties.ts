/**
 * Penalty Layer
 *
 * Applies cross-check penalties to prevent score inflation
 */

import type { SubScores } from '../types';
import { PENALTY_THRESHOLDS } from '../config/thresholds';

/**
 * Apply penalties based on cross-checks and quality issues
 */
export function applyPenalties(
  score: number,
  subscores: SubScores,
  evidence: Record<string, any>
): {
  penalizedScore: number;
  appliedPenalties: Array<{ reason: string; amount: number }>;
} {
  void evidence;
  let penalizedScore = score;
  const appliedPenalties: Array<{ reason: string; amount: number }> = [];

  // Penalty 1 (withdrawn 2026-07-24, WP-45 D2): "no quantified metrics".
  //
  // metrics_presence is already a weighted component, and it hard-clamps to 0
  // when a resume has no metrics — so subtracting another 5 points for the same
  // fact charged every user twice for one shortcoming. Production means were
  // 6.2 before and 7.2 after optimization, i.e. the < 10 trigger fired on
  // essentially every scoring run on both sides of the before/after pair. It
  // could not be escaped either: stripFabricatedMetrics (correctly) stops the
  // optimizer from inventing figures, so no amount of optimizing cleared it.
  //
  // The component still carries the signal, and the suggestion generator still
  // tells the user to add quantified achievements.

  // Penalty 2: Title/seniority mismatch
  if (subscores.title_alignment < 40) {
    penalizedScore -= PENALTY_THRESHOLDS.title_mismatch_penalty;
    appliedPenalties.push({
      reason: 'Job title and seniority mismatch',
      amount: PENALTY_THRESHOLDS.title_mismatch_penalty,
    });
  }

  // Penalty 3: High format risk
  if (subscores.format_parseability < PENALTY_THRESHOLDS.format_risk_threshold) {
    penalizedScore -= PENALTY_THRESHOLDS.format_risk_penalty;
    appliedPenalties.push({
      reason: 'High ATS format risk detected',
      amount: PENALTY_THRESHOLDS.format_risk_penalty,
    });
  }

  // Penalty 4: Semantic-keyword gap (suspicious)
  const semanticKeywordGap = subscores.semantic_relevance - subscores.keyword_exact;
  if (semanticKeywordGap > PENALTY_THRESHOLDS.semantic_keyword_gap_threshold) {
    penalizedScore -= PENALTY_THRESHOLDS.semantic_keyword_gap_penalty;
    appliedPenalties.push({
      reason: 'High semantic score but low keyword match (suspicious)',
      amount: PENALTY_THRESHOLDS.semantic_keyword_gap_penalty,
    });
  }

  // Ensure score stays in valid range
  penalizedScore = Math.max(0, Math.min(100, penalizedScore));

  return {
    penalizedScore: Math.round(penalizedScore),
    appliedPenalties,
  };
}

/**
 * Check if penalties would apply (for preview/suggestions)
 */
export function checkPenaltyRisks(subscores: SubScores): string[] {
  const risks: string[] = [];

  if (subscores.metrics_presence < 10) {
    // No longer a separate penalty (WP-45 D2) — it lowers the metrics_presence
    // component itself, which is already weighted.
    risks.push('Missing quantified metrics is lowering the impact score');
  }

  if (subscores.title_alignment < 40) {
    risks.push('Job title mismatch will reduce score');
  }

  if (subscores.format_parseability < PENALTY_THRESHOLDS.format_risk_threshold) {
    risks.push('ATS-unfriendly format will significantly reduce score');
  }

  const semanticKeywordGap = subscores.semantic_relevance - subscores.keyword_exact;
  if (semanticKeywordGap > PENALTY_THRESHOLDS.semantic_keyword_gap_threshold) {
    risks.push('Keyword coverage needs improvement');
  }

  return risks;
}
