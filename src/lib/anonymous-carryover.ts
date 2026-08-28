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

export type CarryoverOptimizationLink = {
  userId: string;
  resumeId: string | null;
  jobDescriptionId: string | null;
  optimizationId: string;
};

const CARRIED_RESUME_FILENAME = 'ats-check-resume.pdf';

/** Columns that exist once migration 20260720000000 is applied. */
export const CARRYOVER_SCORE_COLUMNS =
  'id, session_id, ats_score, ats_suggestions, created_at, converted_at, resume_text, job_description_text, job_title, job_source_url, resume_id, job_description_id';

/** Columns that exist regardless of migration state. */
export const LEGACY_SCORE_COLUMNS =
  'id, session_id, ats_score, ats_suggestions, created_at, converted_at';

/**
 * Postgres 42703 = undefined_column. PostgREST also reports the schema-cache
 * miss as PGRST204 before the cache reloads.
 */
export function isUndefinedColumnError(error: { code?: string | null } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

export type CarryoverSelectResult<T> = {
  data: T | null;
  error: { code?: string | null } | null;
  /**
   * False when the row was read without the carryover columns. Callers must not
   * attempt materialization in that case — the artifacts are not in the row.
   */
  carryoverColumnsAvailable: boolean;
};

/**
 * Read an `anonymous_ats_scores` row, tolerating an unapplied migration.
 *
 * Deploying the carryover code ahead of migration 20260720000000 makes a select
 * of the six new columns fail with 42703. Without this fallback the caller
 * treats that as a hard lookup failure, `user_id`/`converted_at` never get set,
 * and session conversion — which works today — silently stops. Retrying with
 * the narrow column list keeps conversion working and makes deploy order
 * irrelevant. Ref: WP-39, where code shipped ahead of an unapplied migration.
 */
export async function selectAnonymousScoreWithFallback<T>(
  run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string | null } | null }>,
): Promise<CarryoverSelectResult<T>> {
  const primary = await run(CARRYOVER_SCORE_COLUMNS);

  if (!primary.error || !isUndefinedColumnError(primary.error)) {
    return { ...primary, carryoverColumnsAvailable: true };
  }

  console.error(
    'Anonymous carryover columns missing — apply migration 20260720000000. Falling back to score-only read.',
    primary.error,
  );

  const fallback = await run(LEGACY_SCORE_COLUMNS);
  return { ...fallback, carryoverColumnsAvailable: false };
}

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

/**
 * Tie a converted anonymous check to the optimization its artifacts produced.
 *
 * `anonymous_ats_scores.optimization_id` has existed since the table was
 * created and has never been written, so a carried-over session could run all
 * the way to a finished résumé and the two ends could not be joined. The
 * feature's contribution to activation was therefore unmeasurable even when it
 * worked — the same defect class as WP-48 S2-A on iOS, where a funnel step had
 * no join key and every rate built on it was guesswork.
 *
 * Matched on the owner **and** both artifact ids. `resume_id` /
 * `job_description_id` are written only by `materializeAnonymousCarryover`, so
 * nothing but a genuinely carried-over session can match, and an ordinary
 * upload can never be miscounted as a carryover.
 *
 * `optimization_id is null` keeps the attribution on the **first** optimization
 * the carried artifacts produced. Re-optimizing the same résumé against the
 * same job would otherwise keep moving the link, and the activation would be
 * dated by the most recent run rather than the one that converted the user.
 * It also makes a replayed apply idempotent.
 *
 * **Must be called with a service-role client.** The table's RLS update policy
 * is `using (user_id is null)` — it exists to let an anonymous row be claimed at
 * signup — so once the row is converted a user-scoped client matches zero rows.
 * PostgREST reports that as success with an empty result, so passing the request
 * client here would silently record nothing and look like it worked.
 *
 * Best-effort, like the rest of this module: the optimization row already exists
 * by the time this runs, so throwing would fail an apply that has already
 * succeeded in order to protect a measurement.
 *
 * @returns whether a row was actually linked.
 */
export async function linkCarryoverOptimization(
  serviceRole: SupabaseClient,
  { userId, resumeId, jobDescriptionId, optimizationId }: CarryoverOptimizationLink,
): Promise<boolean> {
  // Nothing was carried, so there is nothing this optimization could belong to.
  if (!resumeId || !jobDescriptionId) {
    return false;
  }

  try {
    const { data, error } = await serviceRole
      .from('anonymous_ats_scores')
      .update({ optimization_id: optimizationId })
      .eq('user_id', userId)
      .eq('resume_id', resumeId)
      .eq('job_description_id', jobDescriptionId)
      .is('optimization_id', null)
      .select('id');

    if (error) {
      console.error('Anonymous carryover optimization link failed:', error);
      return false;
    }

    // Zero rows is the ordinary case: most optimizations have no anonymous
    // check behind them at all.
    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('Anonymous carryover optimization link error:', error);
    return false;
  }
}
