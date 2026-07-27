/**
 * The scorer never invents a number (WP-45 D8)
 *
 * `scoreResume` used to catch every failure and return `createFallbackOutput`:
 * an ATSScoreOutput with ats_score_original 0, ats_score_optimized 0 and all
 * eight subscores 0. Callers had no way to distinguish that from a real result,
 * so they persisted it and rendered it. A user was shown a number that had
 * never been measured.
 *
 * Founder direction 2026-07-27: "no way users see a score that is not
 * measured". A caller that cannot score must fail, retry, or show nothing.
 */

jest.mock('../scorers/aggregator', () => ({
  aggregateScores: () => {
    throw new Error('simulated pipeline failure');
  },
}));

import { scoreResume } from '../core';
import type { ATSScoreInput } from '../types';

const INPUT = {
  resume_original_text: 'Jane Cohen. Data engineer with Kafka and Spark experience since 2019.',
  resume_optimized_text: 'Jane Cohen. Senior Data Engineer. Kafka, Spark, Snowflake, SQL, Python.',
  job_clean_text: 'Hiring a Senior Data Engineer for streaming pipelines with Kafka and Spark.',
  job_extracted_json: {
    title: 'Senior Data Engineer',
    must_have: ['kafka', 'spark'],
    nice_to_have: [],
    responsibilities: [],
  },
} as unknown as ATSScoreInput;

it('propagates a pipeline failure instead of returning a zeroed score', async () => {
  await expect(scoreResume(INPUT)).rejects.toThrow('simulated pipeline failure');
});

it('does not resolve to a fabricated result', async () => {
  // The precise regression: the old code resolved successfully here, with
  // ats_score_original 0 and every subscore 0, and nothing downstream could
  // tell that apart from a genuinely terrible resume.
  const result = await scoreResume(INPUT).then(
    value => ({ resolved: true as const, value }),
    () => ({ resolved: false as const })
  );

  expect(result.resolved).toBe(false);
});
