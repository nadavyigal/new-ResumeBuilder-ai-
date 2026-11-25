import type { ExpertWorkflowContext, PromptBundle } from '../types';
import { REPORT_SHAPE, expertLanguageRules, expertSystem, targetTags, wrap } from './common';

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

  const system = expertSystem({
    role: `# Role
You make resume bullets stronger with numbers, but only numbers the candidate actually gave.`,
    rules: `# Quantifier rules
- Never invent numbers, percentages, money, team sizes, rankings or dates. A number in optimized_bullet must be in original_bullet or in <user_evidence>.
- If a metric would help but is missing, write a stronger non-numeric bullet and add a specific question to missing_evidence_questions (at most 4 per bullet).
- evidence_used lists the values from the bullet or <user_evidence> that the rewrite uses; use [] only for a wording-only improvement.
- Keep optimized_bullet under 45 words and keep the original claim's scope.
- Rewrite only bullets that can be made materially stronger. experience_index and bullet_index come from <current_resume_json>.`,
    output: `# Output
One JSON object: { "bullet_rewrites": [ { "experience_index": number, "bullet_index": number, "original_bullet": string, "optimized_bullet": string, "evidence_used": [string], "missing_evidence_questions": [string] } ], ${REPORT_SHAPE} }`,
  });

  const user = [
    expertLanguageRules(context),
    targetTags(context),
    wrap('current_resume_json', JSON.stringify(candidates, null, 2)),
    wrap('user_evidence', JSON.stringify(evidence, null, 2)),
    'Rewrite the bullets that can be made stronger. Return only the JSON object.',
  ].join('\n\n');

  return {
    system,
    user,
    tier: 'FAST',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 2200,
  };
}
