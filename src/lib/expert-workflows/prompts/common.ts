import type { ExpertWorkflowContext } from '../types';
import {
  CONTENT_RULES,
  DATA_NOTICE,
  REPORT_BLOCK,
  REPORT_SHAPE,
  TRUTH_RULES,
  languageRules,
  matchScoreAnchor,
  resolveOutputLanguage,
  wrap,
} from '@/lib/prompts/shared';

/** Today's language rule, applied to every expert workflow. */
export function expertLanguageRules(context: ExpertWorkflowContext): string {
  return languageRules(resolveOutputLanguage(context.resume_original_text, context.job_description_text));
}

/** Role and task rules first, then the shared rules, then the output shape. */
export function expertSystem(parts: { role: string; rules: string; output: string; truth?: boolean; report?: boolean }): string {
  return [
    parts.role,
    DATA_NOTICE,
    ...(parts.truth === false ? [] : [TRUTH_RULES]),
    parts.rules,
    CONTENT_RULES,
    ...(parts.report === false ? [] : [REPORT_BLOCK]),
    parts.output,
  ].join('\n\n');
}

/** Target role, company and the app's Match Score estimate, as data tags. */
export function targetTags(context: ExpertWorkflowContext, withScore = true): string {
  return [
    wrap('target_role', context.job_title),
    wrap('target_company', context.job_company),
    ...(withScore ? [matchScoreAnchor(context.current_ats_score_optimized ?? context.current_ats_score_original)] : []),
  ].join('\n');
}

/** The candidate's own evidence answers, or nothing when there are none. */
export function evidenceTag(context: ExpertWorkflowContext): string[] {
  const evidence = context.evidence_inputs || {};
  return Object.keys(evidence).length > 0 ? [wrap('user_evidence', JSON.stringify(evidence, null, 2))] : [];
}

/** Summary, skills and the first roles' bullets: the evidence most workflows use. */
export function resumeEvidence(context: ExpertWorkflowContext, roles = 4, withSkills = true): string {
  const resume = context.current_resume_json;
  return JSON.stringify(
    {
      summary: resume?.summary || '',
      ...(withSkills ? { skills: resume?.skills || {} } : {}),
      experience: (resume?.experience || []).slice(0, roles).map((exp) => ({
        title: exp.title,
        company: exp.company,
        achievements: (exp.achievements || []).slice(0, 4),
      })),
    },
    null,
    2
  );
}

export { REPORT_SHAPE, wrap };
