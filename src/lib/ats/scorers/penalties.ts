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

  // Penalty 2 (withdrawn 2026-08-19, WP-59 S3e): "title/seniority mismatch".
  //
  // Same double-charge WP-45 D2 removed for metrics. title_alignment is already
  // a weighted component at 11.4%, and a mismatch lowers it directly — then this
  // subtracted 3 more for the same fact.
  //
  // Worse, the trigger fired hardest on measurements that were not mismatches at
  // all. The analyzer returns a CONSTANT 50 when the job description has no
  // extractable title and a CONSTANT 20 when it cannot parse titles out of the
  // resume — and 20 is below the 40 threshold, so every resume the text-path
  // extractor could not read was charged a mismatch penalty for a comparison
  // that never happened. Measured across the benchmark, title_alignment has a
  // minimum of 16, so this fired on real cases.
  //
  // The component still carries the signal, and the seniority check inside it is
  // unchanged.

  // Penalty 3: High format risk
  if (subscores.format_parseability < PENALTY_THRESHOLDS.format_risk_threshold) {
    penalizedScore -= PENALTY_THRESHOLDS.format_risk_penalty;
    appliedPenalties.push({
      reason: 'High ATS format risk detected',
      amount: PENALTY_THRESHOLDS.format_risk_penalty,
    });
  }

  // Penalty 4 (withdrawn 2026-08-19, WP-59 S3b): "high semantic, low keyword".
  //
  // The third instance of the same double-charge, and the most exact. The
  // semantic analyzer caps itself at `capped_semantic_max` (70) whenever
  // keyword_exact is below `keyword_cap_threshold` (40). This then subtracted 5
  // more whenever semantic minus keyword exceeded 30 — which, at a capped 70, is
  // true precisely when keyword_exact is below 40. The identical condition,
  // charged twice, by two mechanisms that did not know about each other.
  //
  // The cap is the better of the two and stays: it bounds the inflation at
  // source instead of subtracting from the total afterwards, and it leaves the
  // subscore honest for anything reading the components directly.
  //
  // (This was doubly wrong before S3b, because semantic could not go below 61 —
  // so a resume with genuinely poor keyword coverage was guaranteed to trip the
  // 30-point gap no matter how unrelated it actually was.)

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
