import type { OptimizedResume } from '@/lib/ai-optimizer';
import { enforceJobAdTruth } from '@/lib/ai-optimizer/job-ad-terms';
import { enforceSeniorityTruth } from '@/lib/ai-optimizer/seniority-claims';
import { stripFabricatedMetrics } from '@/lib/ai-optimizer/optimize-pipeline';
import { normalizeExperienceBullets } from '@/lib/ai-optimizer/normalize-experience';
import { resumeJsonToText } from '@/lib/ats/integration';
import type { ExpertWorkflowContext } from './types';

function evidenceText(evidence: Record<string, unknown> | undefined): string {
  if (!evidence) return '';
  return Object.values(evidence)
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
    .join('\n');
}

/**
 * Everything that counts as true about the candidate for an expert rewrite: the
 * uploaded resume, the current resume JSON (it carries edits the user made in
 * the app after optimizing) and the user's own evidence answers. Guarding against
 * the upload alone would delete the user's own edits.
 */
export function rewriteEvidenceSource(context: ExpertWorkflowContext): string {
  return [
    context.resume_original_text || '',
    context.current_resume_json ? resumeJsonToText(context.current_resume_json) : '',
    evidenceText(context.evidence_inputs),
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n\n');
}

/**
 * Run the optimizer's deterministic truth guards on a full_resume_rewrite output
 * before it is stored, so the preview the user sees is what apply writes.
 * The job-ad guard never calls the model here (repair returns null): it removes
 * unsupported tools instead of asking for a rewrite.
 */
export async function guardRewriteOutput(
  output: Record<string, unknown>,
  context: ExpertWorkflowContext
): Promise<Record<string, unknown>> {
  const rewritten = output.rewritten_resume as OptimizedResume | undefined;
  if (!rewritten || typeof rewritten !== 'object') return output;

  const source = rewriteEvidenceSource(context);
  try {
    const jobAd = await enforceJobAdTruth(normalizeExperienceBullets(rewritten), {
      resumeText: source,
      jobDescription: context.job_description_text || '',
      repair: async () => null,
    });
    const seniority = enforceSeniorityTruth(jobAd.resume, source);
    const resume = stripFabricatedMetrics(seniority.resume, source);
    console.info(
      JSON.stringify({
        event: 'expert_rewrite_truth_guard',
        removedTerms: jobAd.report.removedTerms.length,
        unresolvedTerms: jobAd.report.unresolvedTerms.length,
        titlesRestored: seniority.report.titlesRestored,
        yearsCorrected: seniority.report.yearsCorrected,
        scopeRemoved: seniority.report.scopeRemoved,
      })
    );
    return { ...output, rewritten_resume: resume };
  } catch (error) {
    // Fail open (the output already passed validation) but loudly: a distinct
    // event so a broken guard shows up in logs instead of passing silently.
    console.error(
      JSON.stringify({
        event: 'expert_rewrite_truth_guard_failed',
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return output;
  }
}
