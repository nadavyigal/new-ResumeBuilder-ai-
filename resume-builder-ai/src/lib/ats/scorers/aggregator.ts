/**
 * Score Aggregator
 *
 * Aggregates individual analyzer scores into final ATS score
 * using weighted average.
 */

import type { AnalyzerResult, SubScores, SubScoreKey } from '../types';
import { SUB_SCORE_WEIGHTS } from '../config/weights';
import { getAdjustedWeights } from '../config/weights';

/**
 * Aggregate analyzer results into final score
 */
export function aggregateScores(analyzerResults: Map<SubScoreKey, AnalyzerResult>): {
  finalScore: number;
  subscores: SubScores;
  failedAnalyzers: SubScoreKey[];
} {
  const subscores: Partial<SubScores> = {};
  const failedAnalyzers: SubScoreKey[] = [];

  // Extract sub-scores from analyzer results
  for (const [key, result] of analyzerResults.entries()) {
    if (result.confidence > 0) {
      subscores[key] = result.score;
    } else {
      failedAnalyzers.push(key);
      subscores[key] = 0; // Failed analyzers get 0
    }
  }

  // Get adjusted weights if some analyzers failed
  const weights = failedAnalyzers.length > 0
    ? getAdjustedWeights(failedAnalyzers)
    : SUB_SCORE_WEIGHTS;

  // Calculate weighted average
  let finalScore = 0;
  for (const key of Object.keys(subscores) as SubScoreKey[]) {
    const score = subscores[key] || 0;
    const weight = weights[key];
    finalScore += score * weight;
  }

  return {
    finalScore: Math.round(finalScore),
    subscores: subscores as SubScores,
    failedAnalyzers,
  };
}

/**
 * Calculate improvement delta between original and optimized scores
 */
export function calculateImprovement(
  originalSubscores: SubScores,
  optimizedSubscores: SubScores
): {
  delta: number;
  improvements: Array<{ subscore: SubScoreKey; delta: number }>;
} {
  const improvements: Array<{ subscore: SubScoreKey; delta: number }> = [];

  for (const key of Object.keys(originalSubscores) as SubScoreKey[]) {
    const delta = optimizedSubscores[key] - originalSubscores[key];
    if (delta !== 0) {
      improvements.push({ subscore: key, delta });
    }
  }

  // Sort by largest improvements
  improvements.sort((a, b) => b.delta - a.delta);

  // Calculate overall delta
  const originalScore = aggregateScores(
    new Map(Object.entries(originalSubscores).map(([k, v]) => [
      k as SubScoreKey,
      { score: v, evidence: {}, confidence: 1.0, warnings: [] }
    ]))
  ).finalScore;

  const optimizedScore = aggregateScores(
    new Map(Object.entries(optimizedSubscores).map(([k, v]) => [
      k as SubScoreKey,
      { score: v, evidence: {}, confidence: 1.0, warnings: [] }
    ]))
  ).finalScore;

  return {
    delta: optimizedScore - originalScore,
    improvements,
  };
}
