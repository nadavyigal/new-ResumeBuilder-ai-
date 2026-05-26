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

  const rewrittenResume = {
    summary: 'Senior iOS engineer focused on reliable mobile workflows and measurable delivery.',
    contact: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '', location: '' },
    skills: { technical: ['Swift', 'SwiftUI'], soft: ['Mentoring'] },
    experience: [
      {
        title: 'Senior iOS Engineer',
        company: 'ExampleCo',
        achievements: ['Led SwiftUI migration for the mobile checkout flow.'],
      },
    ],
    education: [{ school: 'Example University', degree: 'BS Computer Science' }],
    matchScore: 71,
    keyImprovements: [],
    missingKeywords: [],
  };

  it('parses JSON object safely', () => {
    const parsed = safeJsonObjectParse('{"rewritten_resume":{"summary":"ok"}}');
    expect(parsed).not.toBeNull();
    expect(parsed?.rewritten_resume).toBeDefined();
  });

  it('rejects output when report envelope is missing', () => {
    const result = validateWorkflowOutput('full_resume_rewrite', {
      rewritten_resume: rewrittenResume,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('report');
  });

  it('accepts full resume rewrite output with complete resume payload', () => {
    const result = validateWorkflowOutput('full_resume_rewrite', {
      rewritten_resume: rewrittenResume,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects full resume rewrite output when sections are missing', () => {
    const result = validateWorkflowOutput('full_resume_rewrite', {
      rewritten_resume: {
        summary: 'Updated summary',
      },
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('experience');
  });

  it('rejects full resume rewrite output with a bloated summary', () => {
    const result = validateWorkflowOutput('full_resume_rewrite', {
      rewritten_resume: {
        ...rewrittenResume,
        summary: Array.from({ length: 121 }, () => 'word').join(' '),
      },
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('summary is too long');
  });

  it('accepts achievement quantifier output with evidence provenance', () => {
    const result = validateWorkflowOutput('achievement_quantifier', {
      bullet_rewrites: [
        {
          experience_index: 0,
          bullet_index: 0,
          original_bullet: 'Led SwiftUI migration for mobile checkout flow',
          optimized_bullet: 'Led SwiftUI migration for the mobile checkout flow, improving delivery reliability',
          evidence_used: ['SwiftUI migration', 'mobile checkout flow'],
          missing_evidence_questions: ['What was the release cycle or crash-rate impact?'],
        },
      ],
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
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

  it('rejects quantifier output without evidence arrays', () => {
    const result = validateWorkflowOutput('achievement_quantifier', {
      bullet_rewrites: [
        {
          original_bullet: 'Improved onboarding process',
          optimized_bullet: 'Improved onboarding process',
        },
      ],
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('evidence_used');
  });

  it('accepts ATS optimization report output with live contract fields', () => {
    const result = validateWorkflowOutput('ats_optimization_report', {
      ats_report: {
        keyword_match_analysis: [
          {
            keyword: 'SwiftUI',
            present: true,
            suggested_placement: 'experience',
            note: 'Already present in recent project evidence.',
          },
          {
            keyword: 'CI/CD',
            present: false,
            suggested_placement: 'skills',
            note: 'Add only if it reflects the candidate workflow.',
          },
        ],
        section_heading_compliance: ['Use standard Experience and Education headings.'],
        format_guidance: ['Avoid tables in exported resume.'],
        acronym_coverage: ['Spell out CI/CD once if added.'],
        score_estimate: { before: 62, after: 71 },
        recommended_keywords_to_add: ['CI/CD'],
      },
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects ATS optimization report with duplicate keyword stuffing recommendations', () => {
    const result = validateWorkflowOutput('ats_optimization_report', {
      ats_report: {
        keyword_match_analysis: [],
        recommended_keywords_to_add: ['SwiftUI', 'swiftui'],
      },
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('unique');
  });

  it('accepts summary lab output with exactly five valid options', () => {
    const result = validateWorkflowOutput('professional_summary_lab', {
      summary_options: [
        { angle: 'leadership', summary: 'A leader in iOS delivery.', rationale: 'Leadership evidence.' },
        { angle: 'technical', summary: 'A SwiftUI specialist.', rationale: 'Technical evidence.' },
        { angle: 'results', summary: 'A delivery-focused engineer.', rationale: 'Results evidence.' },
        { angle: 'industry', summary: 'A mobile product engineer.', rationale: 'Industry evidence.' },
        { angle: 'vision', summary: 'A platform-minded iOS engineer.', rationale: 'Vision evidence.' },
      ],
      recommended_index: 1,
      recommended_reason: 'Best fit',
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects summary lab output with fewer than five options', () => {
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

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exactly 5');
  });

  it('accepts cover letter output with exactly three complete variants', () => {
    const result = validateWorkflowOutput('cover_letter_architect', {
      cover_letter_variants: [
        {
          angle: 'concise',
          title: 'Concise',
          opening_paragraph: 'I am excited to apply.',
          letter: 'I am excited to apply.\nMy SwiftUI work aligns with the role.',
          rationale: 'Best for direct applications.',
        },
        {
          angle: 'narrative',
          title: 'Narrative',
          opening_paragraph: 'Your team caught my attention.',
          letter: 'Your team caught my attention.\nMy recent work maps to your priorities.',
          rationale: 'Best when motivation matters.',
        },
        {
          angle: 'impact',
          title: 'Impact',
          opening_paragraph: 'I can help improve mobile reliability.',
          letter: 'I can help improve mobile reliability.\nMy migration experience is relevant.',
          rationale: 'Best for outcomes.',
        },
      ],
      recommended_index: 1,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects incomplete cover letter variants', () => {
    const result = validateWorkflowOutput('cover_letter_architect', {
      cover_letter_variants: [
        { angle: 'concise', title: 'Concise', letter: 'A', rationale: 'A' },
        { angle: 'narrative', title: 'Narrative', opening_paragraph: 'B', letter: 'B', rationale: 'B' },
        { angle: 'impact', title: 'Impact', opening_paragraph: 'C', letter: 'C', rationale: 'C' },
      ],
      recommended_index: 1,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('contract fields');
  });

  it('accepts screening answer output with evidence and confidence notes', () => {
    const answers = Array.from({ length: 5 }, (_, index) => ({
      question: `Question ${index + 1}`,
      answer: `Answer ${index + 1} grounded in SwiftUI delivery evidence.`,
      evidence_used: ['SwiftUI delivery evidence'],
      confidence_note: 'High confidence from resume evidence.',
    }));

    const result = validateWorkflowOutput('screening_answer_studio', {
      screening_answers: answers,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects screening answer output without evidence metadata', () => {
    const answers = Array.from({ length: 5 }, (_, index) => ({
      question: `Question ${index + 1}`,
      answer: `Answer ${index + 1}`,
    }));

    const result = validateWorkflowOutput('screening_answer_studio', {
      screening_answers: answers,
      report,
      missing_evidence: [],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('evidence_used');
  });
});
