import { describe, expect, it } from '@jest/globals';
import { safeJsonObjectParse, validateWorkflowOutput } from '@/lib/expert-workflows/validators';

describe('Expert workflow validators', () => {
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
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });
});
