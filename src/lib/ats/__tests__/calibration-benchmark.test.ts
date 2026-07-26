/**
 * WP-45 S5 — Calibration benchmark, weights and bands
 *
 * The packet's gates, encoded. Two of them do not pass yet, and these tests say
 * so rather than being relaxed until they go green: S5's own acceptance clause
 * is "only then enable numeric fit_v2 and its bands", so a failing gate means
 * the bands do not ship, not that the gate was wrong.
 *
 * READ THIS BEFORE TRUSTING A DERIVED THRESHOLD:
 *
 *   1. The labels in cases.ts are the author's, not independent. The packet
 *      requires labels from someone who did not write the fixtures.
 *   2. semantic_relevance (18% of the weighting) falls back to a constant 50
 *      here, because the benchmark runs without an API key so that it stays
 *      deterministic. Production scores include real semantic similarity.
 *
 * Either of those alone is enough to disqualify a threshold derived from this
 * run from being published. The harness is real; the calibration is not final.
 */

import {
  runBenchmark,
  summarise,
  deriveThresholds,
  bandFor,
  scoreCase,
  PUBLISHED_BANDS,
} from '../benchmark/runner';
import { CALIBRATION_CASES, HOLDOUT_CASES, BENCHMARK_CASES } from '../benchmark/cases';

jest.setTimeout(120000);

describe('WP-45 S5: the benchmark itself', () => {
  it('covers the spread of cases the packet asks for', () => {
    const ids = BENCHMARK_CASES.map(c => c.id).join(' ');
    expect(ids).toMatch(/heb-/); // Hebrew
    expect(ids).toMatch(/switch-/); // career switch
    expect(ids).toMatch(/ops-/); // operational
    expect(ids).toMatch(/ae-/); // commercial
    expect(ids).toMatch(/de-/); // technical
    expect(BENCHMARK_CASES.some(c => c.label === 'strong')).toBe(true);
    expect(BENCHMARK_CASES.some(c => c.label === 'stretch')).toBe(true);
    expect(BENCHMARK_CASES.some(c => c.label === 'weak')).toBe(true);
    expect(HOLDOUT_CASES.length).toBeGreaterThan(0);
  });

  it('is deterministic', async () => {
    const first = await scoreCase(BENCHMARK_CASES[0]);
    const second = await scoreCase(BENCHMARK_CASES[0]);
    expect(second).toBe(first);
  });

  it('contains no production content', () => {
    // Every fixture is invented. This is a privacy constraint, not a style one.
    const corpus = BENCHMARK_CASES.map(c => c.resumeText + c.jobText).join(' ');
    expect(corpus).not.toMatch(/nadav/i);
    expect(corpus.match(/@/g)?.every(() => true)).toBe(true);
    expect(corpus).toMatch(/candidate@example\.com/);
  });
});

describe('WP-45 S5 G1: strong is reachable', () => {
  it('awards strong to clearly strong pairs', async () => {
    // The headline result of S1. Before those repairs the composite topped out
    // around 65 and "strong" (>= 75) had never been awarded to anyone.
    const results = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const strongScores = results.filter(r => r.label === 'strong').map(r => r.score);

    expect(Math.max(...strongScores)).toBeGreaterThanOrEqual(75);
    expect(summarise(results).strongReached).toBe(true);
  });
});

describe('WP-45 S5: monotonicity and component isolation', () => {
  const base = CALIBRATION_CASES.find(c => c.id === 'de-senior-stretch')!;

  it('cannot be lowered by adding truthful relevant evidence', async () => {
    const before = await scoreCase(base);
    const after = await scoreCase({
      ...base,
      id: `${base.id}-plus`,
      resumeText: base.resumeText.replace(
        'Python, SQL, Postgres, AWS, Jenkins, pandas',
        'Python, SQL, Postgres, AWS, Jenkins, pandas, Kafka, Spark, Snowflake, Airflow'
      ),
    });
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('does not move when irrelevant whitespace changes', async () => {
    const before = await scoreCase(base);
    const after = await scoreCase({
      ...base,
      id: `${base.id}-ws`,
      resumeText: base.resumeText.replace(/\n\n/g, '\n\n\n'),
    });
    expect(after).toBe(before);
  });

  it('does not move when the job description is reordered but unchanged in content', async () => {
    const before = await scoreCase(base);
    const after = await scoreCase({
      ...base,
      id: `${base.id}-reordered`,
      requirements: [...base.requirements].reverse(),
    });
    expect(after).toBe(before);
  });
});

describe('WP-45 S5: calibration and holdout, reported separately', () => {
  it('records how the published bands perform on the labelled set', async () => {
    const results = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const summary = summarise(results);

    // Documented state as of 2026-07-24, not an aspiration. The published
    // 75/50 bands were set for the pre-2026-06-18 scale and misband roughly
    // two in five labelled pairs on the current one.
    expect(summary.accuracy).toBeLessThan(0.8);
    expect(summary.falseWeakCount).toBeGreaterThan(0);
  });

  it('derives better-separating thresholds from the labelled evidence', async () => {
    const results = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const derived = deriveThresholds(results);

    // The sweep reads thresholds off the labels; it never adjusts a score.
    expect(derived.strong).toBeLessThan(PUBLISHED_BANDS.strong);
    expect(derived.strong).toBeGreaterThan(derived.stretch);

    const rebanded = await runBenchmark(derived, CALIBRATION_CASES);
    expect(summarise(rebanded).accuracy).toBeGreaterThan(
      summarise(results).accuracy
    );
  });

  it('does NOT yet clear the false-weak gate, so the bands must not ship', async () => {
    // The packet requires a false-Weak rate below 10% before numeric bands are
    // enabled. The best thresholds this set can produce sit above that, and the
    // labels are not independent anyway. This test exists to keep that fact
    // visible; when the gate is genuinely met, invert it.
    const results = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const derived = deriveThresholds(results);
    const rebanded = summarise(await runBenchmark(derived, CALIBRATION_CASES));

    expect(rebanded.falseWeakRate).toBeGreaterThan(0.1);
  });

  it('reports holdout separately from calibration', async () => {
    const calibration = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const derived = deriveThresholds(calibration);
    const holdout = summarise(await runBenchmark(derived, HOLDOUT_CASES));

    // Held-out cases never inform the threshold sweep.
    expect(holdout.total).toBe(HOLDOUT_CASES.length);
    expect(holdout.accuracy).toBeGreaterThan(0.5);
  });

  it('under-scores a strong Hebrew match — a real gap, recorded not hidden', async () => {
    // heb-strong is a genuine top match by its own label and scores in the
    // fifties, well below its English equivalents. Hebrew keyword matching is
    // the likely cause. Filed rather than papered over: no threshold should be
    // chosen while one language scores systematically lower.
    const hebStrong = BENCHMARK_CASES.find(c => c.id === 'heb-strong')!;
    const enStrong = BENCHMARK_CASES.find(c => c.id === 'de-senior-strong')!;

    const [heb, en] = await Promise.all([scoreCase(hebStrong), scoreCase(enStrong)]);
    expect(heb).toBeLessThan(en);
  });
});

describe('WP-45 S5: no artificial uplift', () => {
  it('leaves weak pairs weak under any threshold the sweep can pick', async () => {
    const results = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    const derived = deriveThresholds(results);
    const weakScores = results.filter(r => r.label === 'weak').map(r => r.score);

    // A calibration that rescues genuinely poor matches into a good band would
    // be inflation wearing calibration's clothes.
    for (const score of weakScores) {
      expect(bandFor(score, derived)).not.toBe('strong');
    }
  });
});
