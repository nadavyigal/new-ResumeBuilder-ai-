/**
 * WP-45 S2 — Symmetric before/after and the no-regression invariant
 *
 * Two promises:
 *
 *   1. The two sides of a before/after comparison are measured by the SAME
 *      function. Four analyzers branch on `resume_json`, and in the shipping
 *      path only the optimized side has it — so section_completeness,
 *      title_alignment, metrics_presence and semantic_relevance each compared
 *      a JSON measurement against a text measurement. Production shows the
 *      cost: section_completeness reads 99.7 on the optimized side with 58 of
 *      59 rows at >= 99, against 66.5 on the original.
 *
 *   2. A result whose optimized score is not meaningfully above the original
 *      is a pipeline failure, not a number to show the user. This is the
 *      42 -> 44 the moderated session surfaced.
 *
 * Deterministic, no network.
 */

import { scoreResume } from '../core';
import { assessLift, MIN_MEANINGFUL_LIFT } from '../lift';
import type { ATSScoreInput, FormatReport } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';

const FORMAT: FormatReport = {
  has_tables: false,
  has_images: false,
  has_headers_footers: false,
  has_nonstandard_fonts: false,
  has_odd_glyphs: false,
  has_multi_column: false,
  format_safety_score: 85,
  issues: [],
};

/**
 * A messy but complete original resume — the shape a PDF extractor produces.
 * It has every section a resume should have; it just is not structured JSON.
 */
const ORIGINAL_TEXT = `Jane Cohen
jane@example.com | Tel Aviv

PROFESSIONAL SUMMARY
Data engineer building streaming systems.

SKILLS
Kafka, Spark, SQL, Python

EXPERIENCE

Senior Data Engineer at Nimbus Analytics
Jan 2022 - Present
• Built streaming pipelines on Kafka and Spark

EDUCATION
BSc Computer Science - Technion
`;

/**
 * The same person, as a PDF extractor actually delivers them: no clean section
 * headers. This is the common case — the 60-day production mean for
 * section_completeness on the original side is 66.5, not 100.
 */
const MESSY_ORIGINAL_TEXT = `Jane Cohen
jane@example.com | Tel Aviv
Data engineer building streaming systems.
Kafka, Spark, SQL, Python
Senior Data Engineer at Nimbus Analytics
Jan 2022 - Present
Built streaming pipelines on Kafka and Spark
BSc Computer Science - Technion
`;

const OPTIMIZED_JSON: OptimizedResume = {
  summary: 'Senior data engineer specialising in Kafka, Spark and Snowflake.',
  contact: { name: 'Jane Cohen', email: 'jane@example.com', phone: '', location: 'Tel Aviv' },
  skills: { technical: ['Kafka', 'Spark', 'Snowflake', 'SQL', 'Python'], soft: [] },
  experience: [
    {
      title: 'Senior Data Engineer',
      company: 'Nimbus Analytics',
      location: 'Tel Aviv',
      startDate: 'Jan 2022',
      endDate: 'Present',
      achievements: ['Built streaming pipelines on Kafka and Spark'],
    },
  ],
  education: [
    {
      degree: 'BSc Computer Science',
      institution: 'Technion',
      location: 'Haifa',
      graduationDate: '2016',
    },
  ],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
};

function inputWith(overrides: Partial<ATSScoreInput> = {}): ATSScoreInput {
  return {
    resume_original_text: ORIGINAL_TEXT,
    resume_optimized_text: ORIGINAL_TEXT,
    job_clean_text:
      'Senior Data Engineer to build streaming pipelines with Kafka, Spark and Snowflake. SQL and Python required.',
    job_extracted_json: {
      title: 'Senior Data Engineer',
      must_have: ['kafka', 'spark', 'snowflake', 'sql', 'python'],
      nice_to_have: [],
      responsibilities: ['Build streaming pipelines'],
    } as ATSScoreInput['job_extracted_json'],
    format_report: FORMAT,
    timestamp: new Date('2026-07-24T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Same function on both sides
// ---------------------------------------------------------------------------

describe('WP-45 S2: both sides are measured by the same function', () => {
  it('does not hand the optimized side the JSON path while the original gets the text path', async () => {
    // The defect: supplying resume_optimized_json but not resume_original_json
    // sent section_completeness down hasRequiredSections() for one side and a
    // header regex for the other. A messy original is the point — its text path
    // scores low while the optimized side's JSON path scores near 100 on field
    // presence alone. Identical content must score identically; any gap here is
    // measurement, not improvement.
    const result = await scoreResume(
      inputWith({
        resume_original_text: MESSY_ORIGINAL_TEXT,
        resume_optimized_text: MESSY_ORIGINAL_TEXT,
        resume_optimized_json: OPTIMIZED_JSON,
      })
    );

    expect(result.subscores.section_completeness).toBe(
      result.subscores_original.section_completeness
    );
    expect(result.subscores.metrics_presence).toBe(
      result.subscores_original.metrics_presence
    );
    expect(result.subscores.title_alignment).toBe(
      result.subscores_original.title_alignment
    );
  });

  it('scores identical input to an identical composite', async () => {
    const result = await scoreResume(
      inputWith({
        resume_original_text: MESSY_ORIGINAL_TEXT,
        resume_optimized_text: MESSY_ORIGINAL_TEXT,
        resume_optimized_json: OPTIMIZED_JSON,
      })
    );
    expect(result.ats_score_optimized).toBe(result.ats_score_original);
  });

  it('still uses the JSON path when BOTH sides have structured resumes', async () => {
    // Symmetry is the requirement, not the text path. When both sides are
    // structured, both get the richer measurement.
    const result = await scoreResume(
      inputWith({
        resume_original_json: OPTIMIZED_JSON,
        resume_optimized_json: OPTIMIZED_JSON,
        resume_optimized_text: ORIGINAL_TEXT,
      })
    );
    expect(result.subscores.section_completeness).toBe(
      result.subscores_original.section_completeness
    );
    // hasRequiredSections gives a complete resume full marks; the text-header
    // path cannot reach 100 on this fixture, so this pins the JSON path.
    expect(result.subscores.section_completeness).toBeGreaterThanOrEqual(100);
  });

  it('still reports a real improvement when the content genuinely improves', async () => {
    // The guard against over-correcting: making the measurement symmetric must
    // not flatten genuine gains. Snowflake is a must-have the original lacks.
    const result = await scoreResume(
      inputWith({
        resume_optimized_text: `${ORIGINAL_TEXT}\nSnowflake data warehouse migration. Snowflake, Airflow.`,
        resume_optimized_json: OPTIMIZED_JSON,
      })
    );
    expect(result.subscores.keyword_exact).toBeGreaterThan(
      result.subscores_original.keyword_exact
    );
    expect(result.ats_score_optimized).toBeGreaterThan(result.ats_score_original);
  });
});

// ---------------------------------------------------------------------------
// 2. The no-regression invariant
// ---------------------------------------------------------------------------

describe('WP-45 S2: a non-improvement is a failure, not a result', () => {
  it('treats a 2-point gain as no lift', () => {
    // Exactly the case the moderated session hit: 42 before, 44 after.
    const lift = assessLift({ original: 42, optimized: 44 });
    expect(lift.meaningful).toBe(false);
    expect(lift.delta).toBe(2);
    expect(lift.displayScores).toBe(false);
  });

  it('treats a drop as no lift', () => {
    const lift = assessLift({ original: 50, optimized: 47 });
    expect(lift.meaningful).toBe(false);
    expect(lift.delta).toBe(-3);
    expect(lift.displayScores).toBe(false);
  });

  it('accepts a genuine improvement', () => {
    const lift = assessLift({ original: 33, optimized: 52 });
    expect(lift.meaningful).toBe(true);
    expect(lift.delta).toBe(19);
    expect(lift.displayScores).toBe(true);
  });

  it('treats exactly the floor as meaningful', () => {
    const lift = assessLift({ original: 40, optimized: 40 + MIN_MEANINGFUL_LIFT });
    expect(lift.meaningful).toBe(true);
  });

  it('does not invent a score, clamp the delta, or apply a floor', () => {
    // The honest failure mode is to withhold the number, never to improve it.
    const lift = assessLift({ original: 60, optimized: 55 });
    expect(lift.optimized).toBe(55);
    expect(lift.original).toBe(60);
    expect(lift.delta).toBeLessThan(0);
  });

  it('names the weakest component so the failure is diagnosable', () => {
    const lift = assessLift({
      original: 42,
      optimized: 44,
      subscoresOriginal: { keyword_exact: 20, semantic_relevance: 70 },
      subscores: { keyword_exact: 21, semantic_relevance: 70 },
    });
    expect(lift.meaningful).toBe(false);
    // keyword_exact moved 1 point; semantic did not move at all. The component
    // that failed to move is what an operator needs to see.
    expect(lift.stalledComponents).toContain('semantic_relevance');
  });

  it('reports a privacy-safe payload only', () => {
    const lift = assessLift({ original: 42, optimized: 44 });
    const serialised = JSON.stringify(lift.analyticsProperties);
    expect(serialised).not.toContain('Jane');
    expect(serialised).not.toContain('@');
    // Buckets, not raw scores, so the event carries no resume-identifying value.
    expect(lift.analyticsProperties.delta_bucket).toBe('0_to_4');
  });

  it('buckets deltas without leaking exact values', () => {
    expect(assessLift({ original: 50, optimized: 45 }).analyticsProperties.delta_bucket).toBe(
      'negative'
    );
    expect(assessLift({ original: 40, optimized: 46 }).analyticsProperties.delta_bucket).toBe(
      '5_to_9'
    );
    expect(assessLift({ original: 30, optimized: 55 }).analyticsProperties.delta_bucket).toBe(
      '10_plus'
    );
  });
});
