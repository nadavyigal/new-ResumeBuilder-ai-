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
import type { ATSScoreInput, SubScoreKey, SubScores } from '../types';
import { FIT_BANDS } from '../config/bands';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

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
  /** The component readings behind `score`, for ceiling reporting (WP-59 S0). */
  subscores: SubScores;
}

/** How many cases in a run were scored with a degraded semantic analyzer. */
export function degradedCount(results: CaseResult[]): number {
  return results.filter(r => r.semanticDegraded).length;
}

/**
 * Was this case scored with a broken semantic analyzer?
 *
 * This used to compare `subscores.semantic_relevance` against 50, the fallback
 * the analyzer passes to `createFailedResult`. That value never reaches the
 * subscores: `createFailedResult` also sets `confidence: 0`, and
 * `aggregateScores` writes **0** for any analyzer with zero confidence and
 * redistributes its weight across the rest. So a totally degraded run reported
 * `degradedCount() === 0` and `requireCleanRun` waved it through — the guard
 * that exists to stop anyone calibrating against numbers the scorer never
 * really produced could not see the degradation it was written for (WP-59 S0).
 *
 * Detect it from the scorer's own warning instead of from a magic value, so
 * this cannot drift again when a fallback constant changes.
 */
function isSemanticDegraded(result: {
  subscores: SubScores;
  metadata: { warnings: string[] };
}): boolean {
  const failed = result.metadata.warnings.some(
    warning => warning.startsWith('Some analyzers failed') && warning.includes('semantic_relevance')
  );
  // Belt and braces: a zero on a real document is not physically possible —
  // cosine similarity between two non-empty texts is never exactly 0.
  return failed || result.subscores.semantic_relevance === 0;
}

export async function scoreCase(testCase: BenchmarkCase): Promise<number> {
  return (await scoreCaseDetailed(testCase)).score;
}

export async function scoreCaseDetailed(
  testCase: BenchmarkCase
): Promise<{ score: number; semanticDegraded: boolean; subscores: SubScores }> {
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
    semanticDegraded: isSemanticDegraded(result),
    subscores: result.subscores,
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
    const { score, semanticDegraded, subscores } = scores[i];
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
      subscores,
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
  /** Highest composite any case reached. The engine's observed ceiling (WP-59 S0). */
  observedCeiling: number;
  /** Per-component observed range across every case. See `subscoreStats` below. */
  subscoreStats: SubscoreStats;
}

/**
 * What each component actually does across the whole labelled set (WP-59 S0).
 *
 * The composite is a weighted sum, so its reachable maximum is the weighted sum
 * of the components' reachable maxima — not 100. A component whose `max` sits
 * well below 100, or whose `min` equals its `max`, is spending its weight
 * without ever earning it, and every résumé pays for that regardless of quality.
 *
 * This exists because the ceiling was previously argued from reading the code.
 * Reading the code finds a constant; only running the set shows how much of the
 * scale that constant costs. Record this before changing any analyzer, and
 * again after, so a change can be shown to have removed a deflation rather than
 * added an inflation.
 */
export type SubscoreStats = Record<
  SubScoreKey,
  { min: number; mean: number; max: number; /** max === min: the component never moved. */ constant: boolean }
>;

export function summariseSubscores(results: CaseResult[]): SubscoreStats {
  const keys = Object.keys(results[0]?.subscores ?? {}) as SubScoreKey[];
  const stats = {} as SubscoreStats;

  for (const key of keys) {
    const values = results
      .map(r => r.subscores[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    if (values.length === 0) {
      stats[key] = { min: NaN, mean: NaN, max: NaN, constant: false };
      continue;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    stats[key] = {
      min,
      max,
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      constant: max === min,
    };
  }

  return stats;
}

/** A human-readable ceiling report, for pasting into a PR body or a work log. */
export function formatCeilingReport(results: CaseResult[]): string {
  const stats = summariseSubscores(results);
  const rows = (Object.keys(stats) as SubScoreKey[]).map(key => {
    const { min, mean, max, constant } = stats[key];
    const weight = SUB_SCORE_WEIGHTS[key];
    // What this component contributes at its best, in final-score points.
    const headroom = ((100 - max) * weight).toFixed(2);
    return [
      key.padEnd(22),
      `w=${(weight * 100).toFixed(1)}%`.padStart(8),
      `min=${min.toFixed(1)}`.padStart(10),
      `mean=${mean.toFixed(1)}`.padStart(11),
      `max=${max.toFixed(1)}`.padStart(10),
      `unreachable=${headroom}pts`.padStart(20),
      constant ? '  CONSTANT' : '',
    ].join(' ');
  });

  const ceiling = Math.max(...results.map(r => r.score));
  const theoretical = (Object.keys(stats) as SubScoreKey[]).reduce(
    (sum, key) => sum + stats[key].max * SUB_SCORE_WEIGHTS[key],
    0
  );

  return [
    ...rows,
    '',
    `observed composite ceiling across ${results.length} cases: ${ceiling}`,
    `weighted sum of per-component maxima:                     ${theoretical.toFixed(1)}`,
  ].join('\n');
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
    observedCeiling: results.length === 0 ? 0 : Math.max(...results.map(r => r.score)),
    subscoreStats: summariseSubscores(results),
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
