import type { ExpertWorkflowContext, PromptBundle } from '../types';

type CandidateBullet = {
  experience_index: number;
  bullet_index: number;
  text: string;
};

function collectCandidateBullets(context: ExpertWorkflowContext): CandidateBullet[] {
  const experience = context.current_resume_json?.experience || [];
  const candidates: CandidateBullet[] = [];

  experience.forEach((exp, expIndex) => {
    const achievements = exp?.achievements || [];
    achievements.forEach((bullet, bulletIndex) => {
      candidates.push({
        experience_index: expIndex,
        bullet_index: bulletIndex,
        text: bullet,
      });
    });
  });

  return candidates.slice(0, 40);
}

export function buildQuantifierPrompt(context: ExpertWorkflowContext): PromptBundle {
  const candidates = collectCandidateBullets(context);
  const evidence = context.evidence_inputs || {};

  const system = [
    'You are a strict truth-first resume quantification assistant.',
    'Never invent numbers, percentages, dollars, team sizes, rankings, or dates.',
    'If missing data blocks quantification, provide a non-numeric stronger rewrite and ask a concise evidence question.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "bullet_rewrites": [',
    '    {',
    '      "experience_index": number,',
    '      "bullet_index": number,',
    '      "original_bullet": "string",',
    '      "optimized_bullet": "string",',
    '      "evidence_used": ["string"],',
    '      "missing_evidence_questions": ["string"]',
    '    }',
    '  ],',
    '  "missing_evidence": ["string"]',
    '}',
  ].join('\n');

  const user = [
    `Target Role: ${context.job_title}`,
    '',
    'Candidate bullets to improve:',
    JSON.stringify(candidates, null, 2),
    '',
    'Additional evidence provided by user (may be empty):',
    JSON.stringify(evidence, null, 2),
    '',
    'Rewrite only bullets that can be made materially stronger.',
    'Preserve truthful claims.',
  ].join('\n');

  return {
    system,
    user,
    model: 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 2200,
  };
}
