/** @jest-environment node */
/**
 * WP-59 S2 — the free checker and the signed-in optimize path must derive the
 * same job data from the same job description.
 *
 * The free route used to assemble `job_data` inline straight from the scraper:
 *
 *     must_have: extractedJob.requirements
 *
 * while `scoreOptimization` ran the same scraper output through
 * `normalizeParsedJobData` and `buildJobDataFromExtractedJson`, which drop
 * section furniture and ATOMIZE sentence-shaped requirements into short skill
 * phrases. So one surface matched the résumé against "Experience building and
 * operating distributed systems at scale" as a single must-have — scored by the
 * average fraction of that sentence's tokens present — and the other matched it
 * against `distributed systems`. Same résumé, same job, 25% of the score
 * computed two different ways.
 *
 * These tests assert the shared derivation, not a particular score. A future
 * change to atomization should move both surfaces together or fail here.
 */

import {
  buildJobDataFromExtractedJson,
  normalizeParsedJobData,
} from '../job-data-resolver';
import { scoreSkillCoverage } from '../skill-match';
import type { ExtractedJobData } from '@/lib/scraper/jobExtractor';

const SENTENCE_REQUIREMENTS = [
  'Experience building and operating distributed systems at scale',
  'Strong background in PostgreSQL and database performance tuning',
  'Hands-on experience with Kubernetes in production',
  'Key Responsibilities',
];

const SCRAPED: ExtractedJobData = {
  job_title: 'Senior Backend Engineer',
  requirements: SENTENCE_REQUIREMENTS,
  nice_to_have: null,
  responsibilities: null,
  qualifications: null,
} as unknown as ExtractedJobData;

const JOB_TEXT = SENTENCE_REQUIREMENTS.join('\n');

/** What the free route used to do, kept here as the thing being ruled out. */
function legacyInlineJobData(extracted: ExtractedJobData) {
  return {
    title: extracted.job_title || '',
    must_have: extracted.requirements || [],
    nice_to_have: extracted.nice_to_have || [],
    responsibilities: extracted.responsibilities || [],
  };
}

describe('WP-59 S2: free and optimize derive job data identically', () => {
  const shared = buildJobDataFromExtractedJson(normalizeParsedJobData(SCRAPED), JOB_TEXT);

  it('atomizes sentence-shaped requirements into skill phrases', () => {
    // Nothing in must_have should still be a whole sentence.
    for (const requirement of shared.must_have) {
      expect(requirement.split(/\s+/).length).toBeLessThanOrEqual(4);
    }
    expect(shared.must_have.length).toBeGreaterThan(0);
  });

  it('keeps the real technologies the sentences carried', () => {
    const joined = shared.must_have.join(' ').toLowerCase();
    expect(joined).toContain('postgresql');
    expect(joined).toContain('kubernetes');
  });

  it('drops section furniture that is not a requirement', () => {
    const joined = shared.must_have.join(' ').toLowerCase();
    expect(joined).not.toContain('key responsibilities');
  });

  it('scores a matching résumé materially higher than the inline build did', () => {
    // A résumé that genuinely has the stack. Under the sentence-level build it
    // is penalised for not echoing the job's prose; under the shared build it
    // is credited for having the skills.
    const resume = `Senior Backend Engineer
      Built and operated distributed systems serving production traffic.
      PostgreSQL, Kubernetes, Go, AWS.`;

    const legacy = scoreSkillCoverage(legacyInlineJobData(SCRAPED).must_have, resume).score;
    const current = scoreSkillCoverage(shared.must_have, resume).score;

    expect(current).toBeGreaterThan(legacy);
  });

  it('does not fall back to an empty job when the scraper finds no requirements', () => {
    // The old route left DEFAULT_JOB_DATA in place here, which scores the
    // résumé against nothing at all.
    const noRequirements = { ...SCRAPED, requirements: null } as unknown as ExtractedJobData;
    const resolved = buildJobDataFromExtractedJson(
      normalizeParsedJobData(noRequirements),
      JOB_TEXT
    );
    expect(resolved.must_have.length).toBeGreaterThan(0);
  });
});
