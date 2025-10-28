/**
 * Confidence Estimator
 *
 * Estimates confidence in the ATS score based on data quality
 * and analyzer agreement
 */

import type { AnalyzerResult, SubScoreKey } from '../types';
import { CONFIDENCE_THRESHOLDS } from '../config/thresholds';

/**
 * Estimate overall confidence in the scoring
 */
export function estimateConfidence(params: {
  analyzerResults: Map<SubScoreKey, AnalyzerResult>;
  jdExtractionCompleteness: number; // 0-1
  resumeParsingQuality: number; // 0-1
  formatAnalysisAvailable: boolean;
}): {
  confidence: number;
  factors: Array<{ factor: string; impact: number }>;
} {
  const { analyzerResults, jdExtractionCompleteness, resumeParsingQuality, formatAnalysisAvailable } = params;

  let confidence = 1.0;
  const factors: Array<{ factor: string; impact: number }> = [];

  // Factor 1: Average analyzer confidence
  const analyzerConfidences = Array.from(analyzerResults.values()).map(r => r.confidence);
  const avgAnalyzerConfidence = analyzerConfidences.reduce((sum, c) => sum + c, 0) / analyzerConfidences.length;

  if (avgAnalyzerConfidence < CONFIDENCE_THRESHOLDS.min_analyzer_confidence) {
    const penalty = (CONFIDENCE_THRESHOLDS.min_analyzer_confidence - avgAnalyzerConfidence) * 0.5;
    confidence -= penalty;
    factors.push({
      factor: 'Low analyzer confidence',
      impact: -penalty,
    });
  }

  // Factor 2: JD extraction quality
  if (jdExtractionCompleteness < 0.8) {
    const penalty = CONFIDENCE_THRESHOLDS.jd_extraction_penalty;
    confidence -= penalty;
    factors.push({
      factor: 'Incomplete job description extraction',
      impact: -penalty,
    });
  }

  // Factor 3: Resume parsing quality
  if (resumeParsingQuality < 0.8) {
    const penalty = CONFIDENCE_THRESHOLDS.resume_parsing_penalty;
    confidence -= penalty;
    factors.push({
      factor: 'Resume parsing issues',
      impact: -penalty,
    });
  }

  // Factor 4: Format analysis availability
  if (!formatAnalysisAvailable) {
    const penalty = CONFIDENCE_THRESHOLDS.format_analysis_penalty;
    confidence -= penalty;
    factors.push({
      factor: 'Format analysis unavailable',
      impact: -penalty,
    });
  }

  // Factor 5: Analyzer agreement (low variance = high confidence)
  const scores = Array.from(analyzerResults.values()).map(r => r.score);
  const variance = calculateVariance(scores);
  const normalizedVariance = variance / 100; // Normalize to 0-1

  if (normalizedVariance < 0.2) {
    // Low variance = analyzers agree = confidence boost
    const boost = CONFIDENCE_THRESHOLDS.analyzer_agreement_boost;
    confidence += boost;
    factors.push({
      factor: 'Strong analyzer agreement',
      impact: boost,
    });
  }

  // Clamp to valid range
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence,
    factors,
  };
}

/**
 * Calculate variance of scores
 */
function calculateVariance(scores: number[]): number {
  if (scores.length === 0) return 0;

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;

  return variance;
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get confidence explanation
 */
export function explainConfidence(confidence: number, factors: Array<{ factor: string; impact: number }>): string {
  const level = getConfidenceLevel(confidence);

  const positiveFactors = factors.filter(f => f.impact > 0);
  const negativeFactors = factors.filter(f => f.impact < 0);

  let explanation = `Confidence level: ${level} (${Math.round(confidence * 100)}%). `;

  if (negativeFactors.length > 0) {
    const mainIssue = negativeFactors[0];
    explanation += `Main concern: ${mainIssue.factor}. `;
  }

  if (positiveFactors.length > 0) {
    explanation += `Score reliability is boosted by: ${positiveFactors.map(f => f.factor).join(', ')}.`;
  }

  return explanation;
}
