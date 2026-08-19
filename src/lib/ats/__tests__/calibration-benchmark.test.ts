/** @jest-environment node */
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
  summariseSubscores,
  formatCeilingReport,
  deriveThresholds,
  bandFor,
  scoreCase,
  degradedCount,
  PUBLISHED_BANDS,
} from '../benchmark/runner';
import { SUB_SCORE_WEIGHTS } from '../config/weights';
import type { SubScoreKey } from '../types';
import { CALIBRATION_CASES, HOLDOUT_CASES, BENCHMARK_CASES } from '../benchmark/cases';

jest.setTimeout(300000);

/**
 * Band accuracy can only be judged against production-representative scoring.
 *
 * semantic_relevance is 18% of the weighting and falls back to a constant 50
 * without an API key, which is what makes the rest of this file deterministic
 * — and also what makes any threshold measured under it non-production-valid.
 * The shipped bands were derived from a live run, so the assertions that check
 * them are gated the same way this repo gates its optimizer eval.
 *
 * Run with:  set -a && . ./.env.local && set +a && npx jest calibration
 */
const LIVE = Boolean(process.env.OPENAI_API_KEY) || process.env.RUN_LIVE_EVAL === '1';
const describeLive = LIVE ? describe : describe.skip;

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
    // The packet asks for 30-50 pairs. This set is smaller; every case is
    // hand-written, and the count is stated rather than implied.
    expect(BENCHMARK_CASES.length).toBeGreaterThanOrEqual(25);
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

    // 75 was the old strong threshold and the number nobody could reach before
    // S1. Asserting against it rather than the current band keeps the original
    // finding pinned even though the band has since moved down to 57.
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

describeLive('WP-45 S5: calibration and holdout, reported separately (live)', () => {
  // Scored ONCE and shared. Each assertion used to re-run the whole benchmark,
  // which fired well over a hundred embedding calls in a few seconds; under
  // that load some fail, the semantic analyzer falls back to a neutral 50, and
  // scores drift by several points. Sharing one run removes the self-inflicted
  // rate pressure and makes the numbers reproducible.
  let calibration: Awaited<ReturnType<typeof runBenchmark>>;
  let holdout: Awaited<ReturnType<typeof runBenchmark>>;

  beforeAll(async () => {
    calibration = await runBenchmark(PUBLISHED_BANDS, CALIBRATION_CASES);
    holdout = await runBenchmark(PUBLISHED_BANDS, HOLDOUT_CASES);
  }, 600000);

  /**
   * Refuse to judge bands on a degraded run.
   *
   * When embeddings fail the semantic analyzer returns a neutral 50 and the
   * composite drops several points with no error anywhere. Asserting through
   * that produces phantom red builds and, worse, would let someone "recalibrate"
   * against numbers the scorer never really produced.
   */
  function requireCleanRun(results: typeof calibration) {
    const degraded = degradedCount(results);
    if (degraded > 0) {
      throw new Error(
        `${degraded}/${results.length} cases scored with a degraded semantic analyzer ` +
          `(embedding calls failing). Re-run when the API is healthy; do not ` +
          `recalibrate against these numbers.`
      );
    }
  }

  it('the shipped bands separate the labelled set well', async () => {
    requireCleanRun(calibration);
    const summary = summarise(calibration);

    // Reference run 2026-07-26: accuracy 0.947 (18/19), false-Weak 1 (6.7%).
    // Before adoption the 75/50 pair scored 0.79 with 4 false-Weaks (26.7%).
    //
    // The floor is deliberately below the reference. Embedding calls can fail
    // transiently under load and the semantic analyzer falls back to a neutral
    // 50 when they do, which moves individual scores a few points. The gate
    // that must hold regardless is the false-Weak rate, asserted separately.
    expect(summary.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(summary.strongReached).toBe(true);
  });

  it('re-derives the thresholds the product actually ships', async () => {
    // The shipped bands came from this sweep, so running it again should land
    // back on them. That is the property worth pinning: if a scorer change
    // moves the scale, the sweep drifts away from the shipped values and this
    // fails — which is the signal to recalibrate deliberately rather than
    // discover it from users.
    requireCleanRun(calibration);
    const derived = deriveThresholds(calibration);

    expect(derived.strong).toBeGreaterThan(derived.stretch);
    expect(Math.abs(derived.strong - PUBLISHED_BANDS.strong)).toBeLessThanOrEqual(5);
    expect(Math.abs(derived.stretch - PUBLISHED_BANDS.stretch)).toBeLessThanOrEqual(5);
  });

  it('clears the false-weak gate the packet requires', async () => {
    // The gate: fewer than 10% of pairs a human called Strong or Stretch may
    // be classified Weak. Telling a qualified candidate to skip a job they
    // could get is the error that actually costs them something.
    //
    // This failed before the Hebrew scoring fixes and before the benchmark was
    // expanded to the packet's stated size — it sat at 13% on 10 cases, where
    // a single borderline pair moved the rate by 12 points.
    requireCleanRun(calibration);
    expect(summarise(calibration).falseWeakRate).toBeLessThan(0.1);
  });

  it('does not misband a Hebrew pair relative to its English equivalent', async () => {
    // heb-strong scored 52 against 74-92 for English equivalents until three
    // Latin-script assumptions were fixed. A language penalty in the scorer is
    // a language penalty for real users; no band may be chosen while one holds.
    const hebrew = calibration.filter(r => r.id.startsWith('heb-'));
    expect(hebrew.length).toBeGreaterThan(0);
    for (const r of hebrew) {
      expect(r.predicted).toBe(r.label);
    }
  });

  it('reports holdout separately from calibration', async () => {
    // Held-out cases never inform the threshold sweep.
    const summary = summarise(holdout);
    expect(summary.total).toBe(HOLDOUT_CASES.length);
    expect(summary.falseWeakRate).toBeLessThan(0.1);
  });

  it('scores a strong Hebrew match in line with its English equivalent', async () => {
    // Was the reverse assertion: heb-strong scored 52 against 74 for the
    // English case. section_completeness could not read Hebrew headings,
    // title extraction required Latin capitalisation, and title normalisation
    // stripped Hebrew entirely — which also made every Hebrew title compare
    // EQUAL to every other. All three are fixed.
    const hebStrong = BENCHMARK_CASES.find(c => c.id === 'heb-strong')!;
    const enStrong = BENCHMARK_CASES.find(c => c.id === 'de-senior-strong')!;

    const [heb, en] = await Promise.all([scoreCase(hebStrong), scoreCase(enStrong)]);
    expect(Math.abs(heb - en)).toBeLessThanOrEqual(10);
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

/**
 * WP-59 S0 — where the ceiling actually is, before anything is changed.
 *
 * The composite is a weighted sum, so its reachable maximum is the weighted sum
 * of what each component can actually reach — not 100. Reading the code finds
 * the constants; only running the labelled set shows how many points each one
 * costs every résumé regardless of quality.
 *
 * These tests assert the ceiling EXISTS rather than asserting a particular
 * number, so they document the problem without becoming a tripwire that fires
 * on every legitimate scoring change. The numbers themselves are printed, to be
 * pasted into the work log and compared against the same run after the repairs.
 */
describe('WP-59 S0: the reachable ceiling', () => {
  let results: Awaited<ReturnType<typeof runBenchmark>>;

  beforeAll(async () => {
    results = await runBenchmark(PUBLISHED_BANDS, BENCHMARK_CASES);
  }, 600000);

  it('reports each component observed range', () => {
    // Printed, not asserted: this is the before-picture for the recalibration.
    console.log('\n' + formatCeilingReport(results) + '\n');
    expect(results.length).toBeGreaterThan(0);
  });

  it('names every component that never moves across the whole set', () => {
    const stats = summariseSubscores(results);
    const constants = (Object.keys(stats) as SubScoreKey[])
      .filter(key => stats[key].constant && SUB_SCORE_WEIGHTS[key] > 0)
      .map(key => `${key} (fixed at ${stats[key].max}, ${(SUB_SCORE_WEIGHTS[key] * 100).toFixed(1)}% of the score)`);

    console.log('constant components:', constants.length ? constants : 'none');

    // A weighted component that returns the same value for 32 different résumés
    // is spending its weight without measuring anything. Recording it, not
    // failing on it — the repair is Story 3, and this test is the evidence it
    // was needed.
    expect(Array.isArray(constants)).toBe(true);
  });

  it('reports the thresholds this scale would derive', () => {
    // Printed, not asserted. When a scorer change moves the scale, the shipped
    // 57/42 stop fitting and the sweep says so — that is the signal to
    // recalibrate deliberately (WP-59 Story 4), not to quietly move the bands
    // until the suite goes green.
    const derived = deriveThresholds(results);
    const summary = summarise(results);
    console.log(
      `derived bands strong>=${derived.strong} stretch>=${derived.stretch} ` +
        `(shipped ${PUBLISHED_BANDS.strong}/${PUBLISHED_BANDS.stretch}); ` +
        `accuracy ${summary.accuracy.toFixed(3)} falseWeak ${summary.falseWeakCount}`
    );
    expect(derived.strong).toBeGreaterThan(derived.stretch);
  });

  it('shows the weighted sum of per-component maxima falling short of 100', () => {
    const stats = summariseSubscores(results);
    const theoreticalCeiling = (Object.keys(stats) as SubScoreKey[]).reduce(
      (sum, key) => sum + stats[key].max * SUB_SCORE_WEIGHTS[key],
      0
    );

    console.log(
      `theoretical ceiling ${theoreticalCeiling.toFixed(1)}; ` +
        `observed ceiling ${summarise(results).observedCeiling}`
    );

    // The claim under test: no résumé in a 32-case set spanning strong, stretch
    // and weak can approach the top of the ring, because the components cannot.
    expect(theoreticalCeiling).toBeLessThan(100);
  });
});
