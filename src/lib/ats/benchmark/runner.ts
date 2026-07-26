/**
 * Calibration benchmark runner (WP-45 S5)
 *
 * Deterministic: no network, no model calls, no randomness. The same cases
 * produce the same numbers on every run, which is the only way a threshold
 * derived from them means anything.
 */

import { scoreResume } from '../core';
import { generateFormatReport } from '../integration';
import { BENCHMARK_CASES, type BandLabel, type BenchmarkCase } from './cases';
import type { ATSScoreInput } from '../types';
import { FIT_BANDS } from '../config/bands';

export interface BandThresholds {
  /** At or above this is 'strong'. */
  strong: number;
  /** At or above this (and below strong) is 'stretch'. Below it is 'weak'. */
  stretch: number;
}

/**
 * The bands the product actually ships, mirroring FitVerdict.swift on iOS.
 *
 * Adopted 2026-07-26 from this benchmark. The previous 75/50 belonged to the
 * pre-2026-06-18 scale and produced a 26.7% false-Weak rate on the labelled
 * set. See config/bands.ts for the full evidence.
 */
export const PUBLISHED_BANDS: BandThresholds = { strong: FIT_BANDS.strong, stretch: FIT_BANDS.stretch };

export function bandFor(score: number, thresholds: BandThresholds): BandLabel {
  if (score >= thresholds.strong) return 'strong';
  if (score >= thresholds.stretch) return 'stretch';
  return 'weak';
}

export interface CaseResult {
  id: string;
  label: BandLabel;
  score: number;
  predicted: BandLabel;
  correct: boolean;
  /** A Strong or Stretch pair predicted Weak — the costliest error. */
  falseWeak: boolean;
  holdout: boolean;
  /** True when the semantic analyzer fell back, so this score is not trustworthy. */
  semanticDegraded: boolean;
}

/** How many cases in a run were scored with a degraded semantic analyzer. */
export function degradedCount(results: CaseResult[]): number {
  return results.filter(r => r.semanticDegraded).length;
}

/**
 * The semantic analyzer returns exactly this when an embedding call fails.
 * A run where cases hit it is measuring a degraded scorer, not the scorer.
 */
const SEMANTIC_FALLBACK = 50;

export async function scoreCase(testCase: BenchmarkCase): Promise<number> {
  return (await scoreCaseDetailed(testCase)).score;
}

export async function scoreCaseDetailed(
  testCase: BenchmarkCase
): Promise<{ score: number; semanticDegraded: boolean }> {
  const input: ATSScoreInput = {
    resume_original_text: testCase.resumeText,
    resume_optimized_text: testCase.resumeText,
    job_clean_text: testCase.jobText,
    job_extracted_json: {
      title: testCase.jobTitle,
      must_have: testCase.requirements,
      nice_to_have: [],
      responsibilities: [],
    } as ATSScoreInput['job_extracted_json'],
    format_report: generateFormatReport(testCase.resumeText),
    // Fixed so recency never depends on the wall clock.
    timestamp: new Date('2026-07-24T00:00:00Z'),
  };

  const result = await scoreResume(input);
  return {
    score: result.ats_score_optimized,
    semanticDegraded: result.subscores.semantic_relevance === SEMANTIC_FALLBACK,
  };
}

export async function runBenchmark(
  thresholds: BandThresholds = PUBLISHED_BANDS,
  cases: BenchmarkCase[] = BENCHMARK_CASES
): Promise<CaseResult[]> {
  // Parallel, matching the run the shipped bands were derived from. Sequential
  // scoring was tried and did not improve stability, so the extra wall-clock
  // bought nothing. `semanticDegraded` is the real safeguard: it reports when
  // an embedding failure has made a run unfit to calibrate against.
  const scores = await Promise.all(cases.map(scoreCaseDetailed));

  return cases.map((testCase, i) => {
    const { score, semanticDegraded } = scores[i];
    const predicted = bandFor(score, thresholds);
    return {
      id: testCase.id,
      label: testCase.label,
      score,
      predicted,
      correct: predicted === testCase.label,
      falseWeak: predicted === 'weak' && testCase.label !== 'weak',
      holdout: Boolean(testCase.holdout),
      semanticDegraded,
    };
  });
}

export interface BenchmarkSummary {
  total: number;
  correct: number;
  accuracy: number;
  falseWeakCount: number;
  /** Share of Strong/Stretch pairs wrongly called Weak. */
  falseWeakRate: number;
  strongReached: boolean;
  scoresByLabel: Record<BandLabel, number[]>;
}

export function summarise(results: CaseResult[]): BenchmarkSummary {
  const scoresByLabel: Record<BandLabel, number[]> = { strong: [], stretch: [], weak: [] };
  for (const r of results) scoresByLabel[r.label].push(r.score);

  const shouldNotBeWeak = results.filter(r => r.label !== 'weak');
  const falseWeakCount = shouldNotBeWeak.filter(r => r.falseWeak).length;
  const correct = results.filter(r => r.correct).length;

  return {
    total: results.length,
    correct,
    accuracy: results.length === 0 ? 0 : correct / results.length,
    falseWeakCount,
    falseWeakRate: shouldNotBeWeak.length === 0 ? 0 : falseWeakCount / shouldNotBeWeak.length,
    strongReached: results.some(r => r.label === 'strong' && r.predicted === 'strong'),
    scoresByLabel,
  };
}

/**
 * Choose thresholds that best separate the labelled bands.
 *
 * Deliberately a plain sweep over integer cut points maximising accuracy, with
 * ties broken toward fewer false-Weak calls — telling a qualified candidate to
 * skip a job they could get is the error that actually costs them something.
 *
 * This reads thresholds OFF the labelled evidence. It never adjusts a score.
 */
export function deriveThresholds(results: CaseResult[]): BandThresholds {
  let best: BandThresholds = PUBLISHED_BANDS;
  let bestScore = -Infinity;

  for (let stretch = 5; stretch <= 95; stretch++) {
    for (let strong = stretch + 5; strong <= 100; strong++) {
      const candidate: BandThresholds = { strong, stretch };
      let correct = 0;
      let falseWeak = 0;

      for (const r of results) {
        const predicted = bandFor(r.score, candidate);
        if (predicted === r.label) correct++;
        if (predicted === 'weak' && r.label !== 'weak') falseWeak++;
      }

      // Accuracy first, false-Weak as the tiebreak.
      const objective = correct * 100 - falseWeak;
      if (objective > bestScore) {
        bestScore = objective;
        best = candidate;
      }
    }
  }

  return best;
}
