/**
 * Recency information-monotonicity (WP-45 D7)
 *
 * A moderated run on 2026-07-26 scored one unchanged resume at 56 through the
 * free check and 51 through optimize. The whole 5-point gap was recency_fit:
 * 50 through the free check, where no dated work history could be recovered and
 * the analyzer returned its no-data constant, against 0 through optimize, where
 * structured experience WAS available and the analyzer ran for real.
 *
 * The old form was `latestRoleBonus * avgDecay`, where latestRoleBonus is the
 * share of the job's must-have keywords appearing in the newest role. A current
 * role that did not echo the job's keywords scored 0 on *recency*.
 *
 * The property that has to hold, and that these tests exist to keep holding:
 * knowing more about a resume must never score it lower. A user must not lose
 * points because the parser succeeded.
 */

import { RecencyAnalyzer } from '../analyzers/recency-fit';
import type { AnalyzerInput, JobExtraction, OptimizedResume } from '../types';
import { RECENCY_THRESHOLDS } from '../config/thresholds';

const JOB: JobExtraction = {
  title: 'Senior Backend Engineer',
  must_have: ['Kubernetes', 'Terraform', 'Go', 'gRPC', 'distributed systems'],
  nice_to_have: [],
  responsibilities: [],
} as JobExtraction;

/** A current role that shares no vocabulary with the job's must-haves. */
const CURRENT_BUT_UNRELATED: OptimizedResume = {
  experience: [
    {
      title: 'Product Manager',
      company: 'Acme Retail',
      startDate: '2023-01',
      endDate: 'Present',
      achievements: ['Ran the pricing roadmap', 'Owned merchandising analytics'],
    },
  ],
} as unknown as OptimizedResume;

/** The same role, still current, that does echo the job's must-haves. */
const CURRENT_AND_RELATED: OptimizedResume = {
  experience: [
    {
      title: 'Senior Backend Engineer',
      company: 'Acme Cloud',
      startDate: '2023-01',
      endDate: 'Present',
      achievements: [
        'Ran Kubernetes and Terraform across distributed systems',
        'Built Go services on gRPC',
      ],
    },
  ],
} as unknown as OptimizedResume;

/** What the analyzer returns when it has no dated history at all. */
const NO_DATA_FALLBACK = 50;

function inputWith(recencyJson?: OptimizedResume): AnalyzerInput {
  return {
    resume_text: 'Product Manager, Acme Retail, 2023 to Present.',
    job_text: 'Senior Backend Engineer working on Kubernetes and Go.',
    job_data: JOB,
    recency_json: recencyJson,
    // Fixed so decay never depends on the wall clock.
    timestamp: new Date('2026-07-26T00:00:00Z'),
  } as unknown as AnalyzerInput;
}

describe('recency_fit information monotonicity', () => {
  it('does not return 0 for a current role that misses the job keywords', async () => {
    const result = await new RecencyAnalyzer().analyze(inputWith(CURRENT_BUT_UNRELATED));

    // The exact production failure: this returned 0 on 2026-07-26.
    expect(result.score).toBeGreaterThan(0);
  });

  it('never scores a known current role below the no-data fallback', async () => {
    const known = await new RecencyAnalyzer().analyze(inputWith(CURRENT_BUT_UNRELATED));
    const unknown = await new RecencyAnalyzer().analyze(inputWith(undefined));

    expect(unknown.score).toBe(NO_DATA_FALLBACK);

    // The invariant. Recovering the work history is new information, and new
    // information must not cost the user points. This is what made the same
    // resume read 56 through one endpoint and 51 through another.
    expect(known.score).toBeGreaterThanOrEqual(unknown.score);
  });

  it('still rewards a relevant current role above an unrelated one', async () => {
    const related = await new RecencyAnalyzer().analyze(inputWith(CURRENT_AND_RELATED));
    const unrelated = await new RecencyAnalyzer().analyze(inputWith(CURRENT_BUT_UNRELATED));

    // Relevance must still move the number — the fix bounds its influence,
    // it does not remove it.
    expect(related.score).toBeGreaterThan(unrelated.score);
  });

  it('never scores stale dated history below the no-data fallback', async () => {
    // The corner the first version of this fix missed. Decay bottoms out at
    // (1 - max_decay_rate) and relevance at relevance_floor, so the worst real
    // score is 100 * 0.72 * 0.7 = 50.4. At the previous max_decay_rate of 0.5
    // it was 35, and a resume with genuinely old dated roles scored BELOW one
    // the parser could not read — the same defect, other corner.
    const ancient: OptimizedResume = {
      experience: [
        {
          title: 'Product Manager',
          company: 'Acme Retail',
          startDate: '1998-01',
          endDate: '2001-06',
          achievements: ['Ran the pricing roadmap'],
        },
      ],
    } as unknown as OptimizedResume;

    const result = await new RecencyAnalyzer().analyze(inputWith(ancient));

    expect(result.score).toBeGreaterThanOrEqual(NO_DATA_FALLBACK);
  });

  it('keeps the thresholds in a relationship that preserves monotonicity', () => {
    // Asserted on the constants directly: any future edit to either value that
    // pushes the worst real score under the fallback fails here, with the
    // reason, rather than silently reintroducing the regression.
    const worstRealScore =
      100 * (1 - RECENCY_THRESHOLDS.max_decay_rate) * RECENCY_THRESHOLDS.relevance_floor;

    expect(worstRealScore).toBeGreaterThanOrEqual(NO_DATA_FALLBACK);
  });

  it('does not treat undated experience as current', async () => {
    // `estimateYearsAgo` falls back to "index 0 is the current role" when an
    // entry has no parseable date, so an undated list would read as perfectly
    // current and inflate. It must reach the analyzer as no-data instead.
    const undated: OptimizedResume = {
      experience: [
        { title: 'Product Manager', company: 'Acme Retail', achievements: ['Ran pricing'] },
      ],
    } as unknown as OptimizedResume;

    const result = await new RecencyAnalyzer().analyze(inputWith(undated));

    // Scored as a current role it would land at 70; it must not.
    expect(result.score).toBeLessThan(70);
  });

  it('still decays genuinely old experience', async () => {
    const stale: OptimizedResume = {
      experience: [
        {
          title: 'Product Manager',
          company: 'Acme Retail',
          startDate: '2009-01',
          endDate: '2011-06',
          achievements: ['Ran the pricing roadmap'],
        },
      ],
    } as unknown as OptimizedResume;

    const old = await new RecencyAnalyzer().analyze(inputWith(stale));
    const current = await new RecencyAnalyzer().analyze(inputWith(CURRENT_BUT_UNRELATED));

    // Recency has to keep meaning recency.
    expect(old.score).toBeLessThan(current.score);
  });
});
