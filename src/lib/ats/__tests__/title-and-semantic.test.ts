/** @jest-environment node */
/**
 * WP-59 S3e / S3b — the last two double-charges, and two components that could
 * not tell a good match from a bad one.
 *
 * `applyPenalties` charged three separate deductions for facts the weighted
 * components already carried. WP-45 D2 withdrew the first (metrics). These are
 * the other two, and both fired hardest on measurements that were not findings
 * at all:
 *
 *   - title_alignment returns a CONSTANT 20 when the text-path extractor cannot
 *     parse titles out of a resume. 20 is below the penalty's 40 threshold, so
 *     every unparseable resume was charged a "title mismatch" for a comparison
 *     that never happened.
 *   - semantic_relevance caps itself at 70 when keyword_exact < 40, and the gap
 *     penalty fired when semantic minus keyword exceeded 30 — which at a capped
 *     70 is exactly when keyword_exact < 40. Same condition, charged twice.
 */

import { applyPenalties } from '../scorers/penalties';
import { extractJobData } from '../extractors/jd-extractor';
import { SEMANTIC_THRESHOLDS } from '../config/thresholds';
import type { SubScores } from '../types';

const baseSubscores = (overrides: Partial<SubScores>): SubScores => ({
  keyword_exact: 60,
  keyword_phrase: 0,
  semantic_relevance: 60,
  title_alignment: 60,
  metrics_presence: 60,
  section_completeness: 100,
  format_parseability: 85,
  recency_fit: 80,
  ...overrides,
});

describe('WP-59 S3e: the title penalty is withdrawn', () => {
  it('does not charge a resume whose titles simply could not be parsed', () => {
    // 20 is the analyzer's "no job titles found in resume" constant.
    const { penalizedScore, appliedPenalties } = applyPenalties(
      70,
      baseSubscores({ title_alignment: 20 }),
      {}
    );
    expect(appliedPenalties.map(p => p.reason)).not.toContain('Job title and seniority mismatch');
    expect(penalizedScore).toBe(70);
  });
});

describe('WP-59 S3b: the semantic-keyword gap penalty is withdrawn', () => {
  it('does not charge twice for the condition the cap already handles', () => {
    // keyword_exact below 40 is what triggers the cap AND what triggered this.
    const { penalizedScore, appliedPenalties } = applyPenalties(
      65,
      baseSubscores({ keyword_exact: 20, semantic_relevance: 70 }),
      {}
    );
    expect(appliedPenalties).toHaveLength(0);
    expect(penalizedScore).toBe(65);
  });

  it('still penalises genuinely unparseable formatting', () => {
    // The format penalty is not a double-charge and must survive.
    const { appliedPenalties } = applyPenalties(
      70,
      baseSubscores({ format_parseability: 30 }),
      {}
    );
    expect(appliedPenalties.map(p => p.reason)).toContain('High ATS format risk detected');
  });
});

describe('WP-59 S3b: semantic uses the range embeddings actually produce', () => {
  it('anchors are ordered and inside the plausible cosine range', () => {
    expect(SEMANTIC_THRESHOLDS.cosine_floor).toBeLessThan(SEMANTIC_THRESHOLDS.cosine_ceiling);
    expect(SEMANTIC_THRESHOLDS.cosine_floor).toBeGreaterThanOrEqual(0);
    expect(SEMANTIC_THRESHOLDS.cosine_ceiling).toBeLessThanOrEqual(1);
  });

  it('spreads the observed cosine range across most of 0-100', () => {
    // The measured pre-change span was 61-84 out of 100. Anything narrower than
    // half the scale means the component still cannot discriminate.
    const { cosine_floor: lo, cosine_ceiling: hi } = SEMANTIC_THRESHOLDS;
    const at = (cos: number) => Math.max(0, Math.min(1, (cos - lo) / (hi - lo))) * 100;
    expect(at(0.68) - at(0.22)).toBeGreaterThan(50);
  });
});

describe('WP-59 S3e: Hebrew job descriptions yield a target title', () => {
  it.each([
    ['דרוש מהנדס תוכנה בכיר לחברת סטארטאפ', 'מהנדס תוכנה בכיר'],
    ['משרה: מפתח Backend', 'מפתח Backend'],
  ])('extracts a title from %p', (text, expected) => {
    expect(extractJobData(text).title).toContain(expected.split(' ')[0]);
  });

  it('leaves English extraction working', () => {
    expect(extractJobData('Position: Senior Backend Engineer').title).toBe(
      'Senior Backend Engineer'
    );
  });
});
