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
  let penalizedScore = score;
  const appliedPenalties: Array<{ reason: string; amount: number }> = [];

  // Penalty 1: No metrics found
  if (subscores.metrics_presence < 10) {
    penalizedScore -= PENALTY_THRESHOLDS.no_metrics_penalty;
    appliedPenalties.push({
      reason: 'No quantified metrics found in resume',
      amount: PENALTY_THRESHOLDS.no_metrics_penalty,
    });
  }

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
    risks.push('Missing quantified metrics will reduce score');
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
