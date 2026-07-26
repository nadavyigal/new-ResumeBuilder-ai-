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
