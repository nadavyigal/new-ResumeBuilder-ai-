import { describe, expect, it } from '@jest/globals';
import { safeJsonObjectParse, validateWorkflowOutput } from '@/lib/expert-workflows/validators';

describe('Expert workflow validators', () => {
  const report = {
    headline: 'Test report',
    executive_summary: 'Summary',
    priority_actions: ['Action 1'],
    evidence_gaps: [],
    ats_impact_estimate: {
      before: 62,
      after: 71,
      delta: 9,
      confidence_note: 'Estimated',
    },
  };

  it('parses JSON object safely', () => {
    const parsed = safeJsonObjectParse('{"rewritten_resume":{"summary":"ok"}}');
    expect(parsed).not.toBeNull();
    expect(parsed?.rewritten_resume).toBeDefined();
  });

  it('rejects quantifier output with potential fabricated metrics', () => {
    const result = validateWorkflowOutput('achievement_quantifier', {
      bullet_rewrites: [
        {
          original_bullet: 'Improved onboarding process',
          optimized_bullet: 'Improved onboarding process and reduced cycle time by 38%',
          evidence_used: [],
          missing_evidence_questions: ['What was baseline cycle time?'],
        },
      ],
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Potential fabricated metric');
  });

  it('accepts summary lab output with valid recommended index', () => {
    const result = validateWorkflowOutput('professional_summary_lab', {
      summary_options: [
        { angle: 'leadership', summary: 'A', rationale: 'A' },
        { angle: 'technical', summary: 'B', rationale: 'B' },
        { angle: 'results', summary: 'C', rationale: 'C' },
      ],
      recommended_index: 1,
      recommended_reason: 'Best fit',
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects output when report envelope is missing', () => {
    const result = validateWorkflowOutput('full_resume_rewrite', {
      rewritten_resume: {
        summary: 'Updated',
      },
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('report');
  });

  it('accepts cover letter output with exactly 3 variants', () => {
    const result = validateWorkflowOutput('cover_letter_architect', {
      cover_letter_variants: [
        {
          angle: 'concise',
          title: 'Concise',
          opening_paragraph: 'A',
          letter: 'A',
          rationale: 'A',
        },
        {
          angle: 'narrative',
          title: 'Narrative',
          opening_paragraph: 'B',
          letter: 'B',
          rationale: 'B',
        },
        {
          angle: 'impact',
          title: 'Impact',
          opening_paragraph: 'C',
          letter: 'C',
          rationale: 'C',
        },
      ],
      recommended_index: 1,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects screening answer output with fewer than 5 rows', () => {
    const result = validateWorkflowOutput('screening_answer_studio', {
      screening_answers: [
        { question: 'Q1', answer: 'A1', evidence_used: [], confidence_note: 'high' },
        { question: 'Q2', answer: 'A2', evidence_used: [], confidence_note: 'high' },
      ],
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 5');
  });
});
