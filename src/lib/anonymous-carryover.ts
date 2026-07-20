import type { SupabaseClient } from '@supabase/supabase-js';
import { buildParsedDataFromPlainText, resolveJobDescriptionText } from '@/lib/ats/job-data-resolver';

/**
 * WP-49 / WP-29 S5 — anonymous ATS check carryover.
 *
 * An anonymous check produces a score plus the two artifacts that cost the user
 * real effort: the parsed resume and the job description. Converting the
 * session copies those artifacts into rows the new account owns, so the
 * dashboard can offer a one-click optimize instead of asking for the same PDF
 * and the same job description a second time.
 */

export type AnonymousCarryoverRow = {
  id: number;
  session_id?: string | null;
  ats_score: number;
  ats_suggestions: unknown;
  created_at: string;
  converted_at?: string | null;
  resume_text?: string | null;
  job_description_text?: string | null;
  job_title?: string | null;
  job_source_url?: string | null;
  resume_id?: string | null;
  job_description_id?: string | null;
};

export type CarryoverArtifacts = {
  resumeId: string | null;
  jobDescriptionId: string | null;
};

const CARRIED_RESUME_FILENAME = 'ats-check-resume.pdf';

/**
 * Copy an anonymous session's resume and job description into rows owned by
 * `userId`.
 *
 * Idempotent: a row that already carries `resume_id` and `job_description_id`
 * is returned as-is rather than duplicated, so replaying a conversion (the
 * auth callback and the client-side convert both fire on some signup paths)
 * cannot create a second copy.
 *
 * Best-effort by design: the score carryover is the guaranteed part of the
 * funnel, so a failure to materialize the artifacts is logged and returns
 * nulls rather than failing the whole conversion.
 */
export async function materializeAnonymousCarryover(
  serviceRole: SupabaseClient,
  score: AnonymousCarryoverRow,
  userId: string,
): Promise<CarryoverArtifacts> {
  if (score.resume_id && score.job_description_id) {
    return { resumeId: score.resume_id, jobDescriptionId: score.job_description_id };
  }

  const resumeText = score.resume_text?.trim() || '';
  const jobDescriptionText = score.job_description_text?.trim() || '';

  // Sessions created before this feature shipped carry only hashes. They still
  // convert — they just have nothing to materialize.
  if (!resumeText || !jobDescriptionText) {
    return { resumeId: null, jobDescriptionId: null };
  }

  const sourceUrl = score.job_source_url?.trim() || null;
  const parsedData = buildParsedDataFromPlainText(jobDescriptionText, {
    jobTitle: score.job_title || null,
    sourceUrl,
  });

  const cleanText = resolveJobDescriptionText({
    raw_text: jobDescriptionText,
    clean_text: jobDescriptionText,
    parsed_data: parsedData,
  });

  try {
    const [resumeResult, jdResult] = await Promise.all([
      serviceRole
        .from('resumes')
        .insert({
          user_id: userId,
          filename: CARRIED_RESUME_FILENAME,
          storage_path: `resumes/${userId}/${Date.now()}_${CARRIED_RESUME_FILENAME}`,
          raw_text: resumeText,
          canonical_data: {},
        })
        .select('id')
        .maybeSingle(),
      serviceRole
        .from('job_descriptions')
        .insert({
          user_id: userId,
          title: score.job_title?.trim() || 'Job Position',
          company: parsedData.company_name || 'Company Name',
          raw_text: jobDescriptionText,
          clean_text: cleanText,
          parsed_data: parsedData,
          source_url: sourceUrl,
        })
        .select('id')
        .maybeSingle(),
    ]);

    if (resumeResult.error || !resumeResult.data) {
      console.error('Anonymous carryover resume insert failed:', resumeResult.error);
      return { resumeId: null, jobDescriptionId: null };
    }

    if (jdResult.error || !jdResult.data) {
      console.error('Anonymous carryover job description insert failed:', jdResult.error);
      return { resumeId: null, jobDescriptionId: null };
    }

    const resumeId = (resumeResult.data as { id: string }).id;
    const jobDescriptionId = (jdResult.data as { id: string }).id;

    // The artifacts now live in rows the user owns, so drop the anonymous
    // copies rather than letting them sit until expires_at.
    const { error: linkError } = await serviceRole
      .from('anonymous_ats_scores')
      .update({
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
        resume_text: null,
        job_description_text: null,
      })
      .eq('id', score.id);

    if (linkError) {
      console.error('Anonymous carryover link update failed:', linkError);
    }

    return { resumeId, jobDescriptionId };
  } catch (error) {
    console.error('Anonymous carryover materialization error:', error);
    return { resumeId: null, jobDescriptionId: null };
  }
}
