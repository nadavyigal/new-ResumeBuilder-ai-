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
});
