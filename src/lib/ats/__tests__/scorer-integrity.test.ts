/**
 * WP-45 S1 — Scorer integrity
 *
 * These tests encode the gates from the work packet:
 *   G1  a perfect-match resume must be able to reach the top band (>= 85)
 *   G2  every weighted component must be able to vary
 *   D2  the no-metrics penalty must not fire on top of an already-low component
 *   D3  format_parseability must be computed per side of the before/after pair
 *   D4  recency_fit must not compare a real value against a constant fallback
 *
 * They are deterministic and require no network: the semantic analyzer falls
 * back to a fixed neutral score when no OPENAI_API_KEY is present, and every
 * other analyzer is pure.
 */

import { aggregateScores } from '../scorers/aggregator';
import { applyPenalties } from '../scorers/penalties';
import { SUB_SCORE_WEIGHTS, validateWeights } from '../config/weights';
import { deriveResumeJsonFromText } from '../extractors/experience-text-extractor';
import { scoreResume } from '../core';
import { scoreOptimization } from '../integration';
import type { AnalyzerResult, SubScoreKey, SubScores, ATSScoreInput, FormatReport } from '../types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Feed a fixed set of sub-scores through the real aggregation + penalty path. */
function compositeFor(subscores: SubScores): number {
  const results = new Map<SubScoreKey, AnalyzerResult>(
    (Object.entries(subscores) as Array<[SubScoreKey, number]>).map(([key, score]) => [
      key,
      { score, evidence: {}, confidence: 1.0, warnings: [] } as AnalyzerResult,
    ])
  );
  const aggregate = aggregateScores(results);
  return applyPenalties(aggregate.finalScore, aggregate.subscores, {}).penalizedScore;
}

/**
 * A flawless candidate for the role.
 *
 * Two components are deliberately NOT set to 100, because pinning them there
 * would test a resume that cannot exist and the gate would pass on a score no
 * user can reach:
 *
 *  - format_parseability is 88, the value a clean, well-structured resume
 *    actually produces through analyzeFormatWithTemplate (production mean over
 *    60 days is 87.8).
 *  - keyword_phrase is 5, its realistic ceiling. It requires verbatim 3-6 word
 *    job-description reuse, so even an ideal resume scores near zero unless it
 *    copy-pastes the posting.
 */
const PERFECT_MATCH: SubScores = {
  keyword_exact: 100,
  keyword_phrase: 5,
  semantic_relevance: 100,
  title_alignment: 100,
  metrics_presence: 100,
  section_completeness: 100,
  format_parseability: 88,
  recency_fit: 100,
};

/**
 * The case that actually broke: a candidate who is a genuinely excellent match
 * on every dimension the product can influence, whose resume simply has no
 * quantified figures in it.
 *
 * This is common — plenty of strong resumes describe scope rather than
 * percentages — and the optimizer cannot fix it, because stripFabricatedMetrics
 * (correctly) forbids inventing numbers. Before S1 this candidate scored 72:
 * metrics_presence contributed 0 of its 10 points AND triggered a further -5
 * penalty for the same fact, putting "strong" out of reach for someone who
 * deserved it.
 */
const STRONG_CANDIDATE_WITHOUT_METRICS: SubScores = {
  ...PERFECT_MATCH,
  metrics_presence: 0,
};

const CLEAR_MISMATCH: SubScores = {
  keyword_exact: 5,
  keyword_phrase: 0,
  semantic_relevance: 20,
  title_alignment: 0,
  metrics_presence: 0,
  section_completeness: 40,
  format_parseability: 60,
  recency_fit: 10,
};

/**
 * The shape a real user's resume actually produces today, taken from the
 * 60-day production means (n=59, optimized side). keyword_phrase and
 * metrics_presence are the two components the audit found cannot be earned.
 */
const TYPICAL_OPTIMIZED: SubScores = {
  keyword_exact: 39,
  keyword_phrase: 4,
  semantic_relevance: 71,
  title_alignment: 38,
  metrics_presence: 7,
  section_completeness: 100,
  format_parseability: 88,
  recency_fit: 13,
};

const NEUTRAL_FORMAT: FormatReport = {
  has_tables: false,
  has_images: false,
  has_headers_footers: false,
  has_nonstandard_fonts: false,
  has_odd_glyphs: false,
  has_multi_column: false,
  format_safety_score: 90,
  issues: [],
};

const RISKY_FORMAT: FormatReport = {
  has_tables: true,
  has_images: false,
  has_headers_footers: false,
  has_nonstandard_fonts: false,
  has_odd_glyphs: false,
  has_multi_column: true,
  format_safety_score: 30,
  issues: ['Tables detected', 'Multi-column layout detected'],
};

// ---------------------------------------------------------------------------
// G1 — the scale must be able to reach its own top band
// ---------------------------------------------------------------------------

describe('WP-45 G1: a perfect-match resume can reach the top band', () => {
  it('scores a flawless candidate at or above the strong threshold of 75', () => {
    expect(compositeFor(PERFECT_MATCH)).toBeGreaterThanOrEqual(85);
  });

  it('lets an excellent candidate whose resume has no metrics reach strong', () => {
    // The gate that matters. Pre-S1 this scored 72 — the component contributed
    // nothing and then a penalty subtracted 5 more for the same shortcoming,
    // so a deserving candidate was capped below the strong band by a fact the
    // product had already decided it would not fix for them.
    expect(compositeFor(STRONG_CANDIDATE_WITHOUT_METRICS)).toBeGreaterThanOrEqual(75);
  });

  it('charges a missing-metrics resume once, not twice', () => {
    // Losing the metrics component is legitimate. Losing it AND taking a
    // separate penalty for the same fact is double jeopardy.
    const gap = compositeFor(PERFECT_MATCH) - compositeFor(STRONG_CANDIDATE_WITHOUT_METRICS);
    expect(gap).toBeLessThanOrEqual(Math.round(SUB_SCORE_WEIGHTS.metrics_presence * 100) + 1);
  });

  it('still scores a clear mismatch low', () => {
    // The repairs must not compress the whole scale upward.
    expect(compositeFor(CLEAR_MISMATCH)).toBeLessThan(35);
  });

  it('keeps a wide spread between a flawless and a hopeless candidate', () => {
    expect(compositeFor(PERFECT_MATCH) - compositeFor(CLEAR_MISMATCH)).toBeGreaterThan(50);
  });

  it('leaves a typical real-world optimized resume below the strong band', () => {
    // Honesty check: repairing dead components must not hand everybody a
    // "strong" verdict. A resume that is genuinely a partial match stays a
    // partial match.
    const typical = compositeFor(TYPICAL_OPTIMIZED);
    expect(typical).toBeGreaterThan(30);
    expect(typical).toBeLessThan(75);
  });
});

// ---------------------------------------------------------------------------
// G2 — no component may sit in the denominator without being earnable
// ---------------------------------------------------------------------------

describe('WP-45 G2: every weighted component can move the score', () => {
  const weighted = (Object.keys(SUB_SCORE_WEIGHTS) as SubScoreKey[]).filter(
    key => SUB_SCORE_WEIGHTS[key] > 0
  );

  it('has weights that still sum to 1.0', () => {
    expect(validateWeights().valid).toBe(true);
  });

  it.each(weighted)('moving %s alone changes the composite', key => {
    const floor = compositeFor({ ...CLEAR_MISMATCH, [key]: 0 });
    const ceiling = compositeFor({ ...CLEAR_MISMATCH, [key]: 100 });
    expect(ceiling - floor).toBeGreaterThanOrEqual(5);
  });

  it('drops keyword_phrase from the weighting', () => {
    // The analyzer keeps running so suggestions still work, but a component
    // that requires verbatim 3-6 word JD reuse cannot be earned without
    // keyword stuffing, so it must not sit in the composite. See WP-45 D1.
    expect(SUB_SCORE_WEIGHTS.keyword_phrase).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D2 — the metrics penalty must not double-count
// ---------------------------------------------------------------------------

describe('WP-45 D2: no double penalty for missing metrics', () => {
  it('applies no penalty at all to a strong candidate who simply lacks metrics', () => {
    // Asserting on the penalty list rather than on a string literal: the old
    // reason text no longer exists in the source, so a `not.toContain` on it
    // would pass even with the penalty fully restored.
    const { appliedPenalties, penalizedScore } = applyPenalties(
      60,
      STRONG_CANDIDATE_WITHOUT_METRICS,
      {}
    );
    expect(appliedPenalties).toHaveLength(0);
    expect(penalizedScore).toBe(60);
  });

  it('scores the two reference fixtures at their exact expected values', () => {
    // Absolute values, not band membership. Reverting D1 (weights), D2 (metrics
    // penalty) or the WP-59 S3e/S3b penalty withdrawals moves these, which band
    // assertions alone would not catch.
    expect(compositeFor(STRONG_CANDIDATE_WITHOUT_METRICS)).toBe(87);

    // 44 -> 52 on 2026-08-19, and the arithmetic is the whole justification:
    // exactly +3 for the withdrawn title_mismatch_penalty (WP-59 S3e) and +5
    // for the withdrawn semantic_keyword_gap_penalty (S3b). This fixture has
    // title_alignment below 40 and keyword_exact below 40, so it was paying
    // both — one for a title comparison that never happened, one for a
    // condition the semantic cap already handles.
    //
    // Deliberately re-pinned rather than relaxed. The point of an absolute
    // value is that someone has to justify moving it.
    expect(compositeFor(TYPICAL_OPTIMIZED)).toBe(52);
  });

  it('still penalises genuine format risk', () => {
    const { appliedPenalties } = applyPenalties(
      60,
      { ...PERFECT_MATCH, format_parseability: 20 },
      {}
    );
    expect(appliedPenalties.some(p => p.reason.includes('format risk'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D4 — the original side must not be scored against a constant
// ---------------------------------------------------------------------------

describe('WP-45 D4: recency is derived from the original resume, not a constant', () => {
  const RESUME_WITH_DATES = `
Jane Cohen
jane@example.com | Tel Aviv

EXPERIENCE

Senior Data Engineer at Nimbus Analytics
Tel Aviv | Jan 2022 - Present
• Built streaming pipelines on Kafka and Spark
• Owned the migration to Snowflake

Data Engineer at Harbor Systems
Tel Aviv | 2019 - 2021
• Maintained ETL jobs in Airflow

EDUCATION
BSc Computer Science - Technion
`;

  it('derives dated experience from plain resume text', () => {
    const derived = deriveResumeJsonFromText(RESUME_WITH_DATES);
    expect(derived).not.toBeNull();
    expect(derived!.experience.length).toBeGreaterThanOrEqual(2);
    expect(derived!.experience[0].endDate.toLowerCase()).toContain('present');
  });

  it('returns null rather than guessing when the text has no dated roles', () => {
    expect(deriveResumeJsonFromText('Jane Cohen\nSkilled engineer.\n')).toBeNull();
  });

  // A real optimization rewrites bullets; it does not delete the work history.
  // These cases pass a dated optimized side because that is what the product
  // produces — and because recency is now only measured when BOTH sides can be
  // dated, so an undated optimized side would (correctly) pin both to the
  // fallback and test nothing about derivation (WP-45 D7).
  const OPTIMIZED_WITH_DATES = `
Jane Cohen
jane@example.com | Tel Aviv

EXPERIENCE

Senior Data Engineer at Nimbus Analytics
Tel Aviv | Jan 2022 - Present
• Built streaming pipelines on Kafka and Spark processing 4TB daily
• Led the Snowflake migration, cutting query cost 38%

Data Engineer at Harbor Systems
Tel Aviv | 2019 - 2021
• Maintained ETL jobs in Airflow across 60 SQL and Python pipelines

EDUCATION
BSc Computer Science - Technion
`;

  it('does not report the 50-point fallback for an original resume that has real dates', async () => {
    const result = await scoreResume(
      buildInput({ originalText: RESUME_WITH_DATES, optimizedText: OPTIMIZED_WITH_DATES })
    );
    // 50 is the "no experience data available" constant. Seeing it on the
    // original side while the optimized side gets a real number is exactly the
    // asymmetry that made every reported delta ~3 points too small.
    expect(result.subscores_original.recency_fit).not.toBe(50);
  });

  it('scores recency above the old constant, not below it', async () => {
    // The failure mode this guards: a misparse that finds a role but attributes
    // no achievements to it drives recency toward 0, which is strictly worse
    // than the 50 it replaced. "Not 50" alone would pass in that case.
    const result = await scoreResume(
      buildInput({ originalText: RESUME_WITH_DATES, optimizedText: OPTIMIZED_WITH_DATES })
    );
    expect(result.subscores_original.recency_fit).toBeGreaterThan(50);
  });

  it('measures recency on both sides or neither, never one', async () => {
    // The 2026-07-26 production failure in its general form: one side dated,
    // the other not, so the delta carried a swing that no content change
    // earned. Both sides must land on the same footing.
    const result = await scoreResume(
      buildInput({ originalText: RESUME_WITH_DATES, optimizedText: 'Jane Cohen\nData engineer.' })
    );
    expect(result.subscores_original.recency_fit).toBe(result.subscores.recency_fit);
  });

  it('does not treat education or certification dates as jobs', () => {
    const derived = deriveResumeJsonFromText(`
EXPERIENCE

Data Engineer at Harbor Systems
2019 - 2021
• Maintained ETL jobs in Airflow

EDUCATION
BSc Computer Science
Technion, 2012 - 2016

CERTIFICATIONS
AWS Solutions Architect, 2020 - 2023
`);
    expect(derived).not.toBeNull();
    expect(derived!.experience).toHaveLength(1);
    // The recency analyzer treats index 0 as the current role, so a degree
    // parsed as a job would be read as the candidate's present position.
    expect(derived!.experience[0].company).toContain('Harbor');
  });

  it('does not spawn a phantom role from a date range inside a bullet', () => {
    const derived = deriveResumeJsonFromText(`
EXPERIENCE

Senior Data Engineer at Nimbus
Jan 2022 - Present
• Cut infra spend 30% across the 2019 - 2021 legacy stack
• Owned the Snowflake migration
`);
    expect(derived!.experience).toHaveLength(1);
    expect(derived!.experience[0].endDate.toLowerCase()).toContain('present');
  });

  it('captures prose achievements, not only bulleted ones', () => {
    const derived = deriveResumeJsonFromText(`
EXPERIENCE

Senior Product Manager
Acme Corp
Jan 2020 - Present
Led the migration of the billing platform to a new vendor.
Managed a team of six engineers across two time zones.

Product Manager
Beta Inc
2017 - 2019
Owned the onboarding funnel.
`);
    expect(derived!.experience).toHaveLength(2);
    // Empty achievements starve checkLatestRoleRelevance, which is what pushed
    // recency below the constant it replaced.
    expect(derived!.experience[0].achievements.length).toBeGreaterThanOrEqual(2);
    expect(derived!.experience[0].achievements.join(' ')).toContain('billing platform');
    // ...and they must not leak into the next role.
    expect(derived!.experience[0].achievements.join(' ')).not.toContain('onboarding funnel');
  });
});

// ---------------------------------------------------------------------------
// The regression this whole packet exists to prevent
// ---------------------------------------------------------------------------

const REAL_RESUME = `Jane Cohen
jane@example.com | Tel Aviv

PROFESSIONAL SUMMARY
Data engineer focused on streaming systems.

SKILLS
Kafka, Spark, SQL, Python

EXPERIENCE

Senior Data Engineer at Nimbus Analytics
Jan 2022 - Present
• Built streaming pipelines on Kafka and Spark

EDUCATION
BSc Computer Science - Technion
`;

describe('WP-45: the repairs must not widen the delta for the wrong reasons', () => {
  it('does not deflate the original side just because it lacks structured JSON', async () => {
    const result = await scoreResume(buildInput({ originalText: REAL_RESUME }));

    // The original resume plainly has a summary, skills, experience and
    // education. If the derived work-history stub were handed to
    // section_completeness it would see empty summary/skills/education and
    // score 25 — pushing the original score down and making the optimization
    // look better than it was. That is the exact dishonesty WP-45 forbids.
    expect(result.subscores_original.section_completeness).toBeGreaterThan(70);
  });

  it('keeps format on the same measurement basis for both sides', async () => {
    const result = await scoreResume(buildInput({}));
    expect(result.subscores.format_parseability).toBe(
      result.subscores_original.format_parseability
    );
  });

  it('does not manufacture a format gain on the real optimize path', async () => {
    // This is the path that ships (optimize-pipeline -> scoreOptimization), and
    // it is where the fabrication lived: generateFormatReport (base 85) for the
    // original against analyzeFormatWithTemplate (base 100) for the optimized
    // resume handed every single optimization ~2.4 points of delta that
    // reflected which function ran, not the user's formatting.
    const result = await scoreOptimization({
      resumeOriginalText: REAL_RESUME,
      resumeOptimizedJson: {
        summary: 'Senior data engineer specialising in Kafka and Spark.',
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
      },
      jobDescriptionText:
        'Senior Data Engineer to build streaming pipelines with Kafka, Spark and Snowflake. SQL and Python required.',
    });

    expect(result.subscores.format_parseability).toBe(
      result.subscores_original.format_parseability
    );
  });
});

// ---------------------------------------------------------------------------
// D3 — format must be measured per side
// ---------------------------------------------------------------------------

describe('WP-45 D3: format_parseability is computed per side', () => {
  it('reports different format scores when the two sides have different formats', async () => {
    const result = await scoreResume(
      buildInput({
        formatOriginal: RISKY_FORMAT,
        formatOptimized: NEUTRAL_FORMAT,
      })
    );

    expect(result.subscores_original.format_parseability).toBe(
      RISKY_FORMAT.format_safety_score
    );
    expect(result.subscores.format_parseability).toBe(NEUTRAL_FORMAT.format_safety_score);
    expect(result.subscores.format_parseability).not.toBe(
      result.subscores_original.format_parseability
    );
  });

  it('falls back to the shared report when no per-side reports are supplied', async () => {
    const result = await scoreResume(buildInput({}));
    expect(result.subscores_original.format_parseability).toBe(
      NEUTRAL_FORMAT.format_safety_score
    );
    expect(result.subscores.format_parseability).toBe(NEUTRAL_FORMAT.format_safety_score);
  });
});

// ---------------------------------------------------------------------------

function buildInput(opts: {
  originalText?: string;
  optimizedText?: string;
  formatOriginal?: FormatReport;
  formatOptimized?: FormatReport;
}): ATSScoreInput {
  return {
    resume_original_text: opts.originalText ?? 'Jane Cohen\nData engineer with Kafka experience.',
    resume_optimized_text:
      opts.optimizedText ??
      'Jane Cohen\nSenior Data Engineer\nKafka, Spark, Snowflake, Airflow, SQL, Python.',
    job_clean_text:
      'We are hiring a Senior Data Engineer to build streaming pipelines with Kafka, Spark and Snowflake. SQL and Python required.',
    job_extracted_json: {
      title: 'Senior Data Engineer',
      must_have: ['kafka', 'spark', 'snowflake', 'sql', 'python'],
      nice_to_have: ['airflow'],
      responsibilities: ['Build streaming pipelines'],
      seniority: 'senior',
software_keywords: [],
    } as unknown as ATSScoreInput['job_extracted_json'],
    format_report: NEUTRAL_FORMAT,
    format_report_original: opts.formatOriginal,
    format_report_optimized: opts.formatOptimized,
    timestamp: new Date('2026-07-24T00:00:00Z'),
  };
}
