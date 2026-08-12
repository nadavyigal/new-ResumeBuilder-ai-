import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The one place the user-facing optimized score is allowed to change.
 *
 * The score a user sees must never fall on its own. It had five independent
 * writers — the ATS rescan, the expert-workflow orchestrator, chat
 * approve-change, the optimization detail route, and the tip handler — each
 * overwriting `ats_score_optimized` and `match_score` with whatever it had just
 * measured. A run on 2026-08-12 went up and down within a single session because
 * the expert orchestrator wrote a score and the rescan immediately wrote another.
 *
 * This is the same shape as the baseline defect (WP-45 D8), where a fresh
 * measurement was written over the number the user's journey was anchored to.
 * That one was fixed by removing the writers. The optimized side genuinely does
 * need to move — it just must never move *down* without the user agreeing.
 *
 * Rule: a lower measurement is reported, never silently stored. Callers that
 * have the user's explicit approval pass `allowDecrease`.
 */
export interface OptimizedScoreCommit {
  /** Whether the measured score was written. */
  applied: boolean;
  /** The score in the database after this call — what the user will see. */
  stored: number | null;
  /** What was just measured, applied or not. */
  measured: number;
  /** The score before this call. */
  previous: number | null;
  /** True when a decrease was measured and refused. */
  decreaseBlocked: boolean;
}

export interface CommitOptimizedScoreParams {
  supabase: SupabaseClient<any, any, any>;
  optimizationId: string;
  /** Scopes the update when the caller has a user context. */
  userId?: string;
  /** The freshly measured optimized score. */
  measured: number;
  /**
   * The stored score, when the caller already read it. Omit and it is fetched —
   * the read is what makes the floor safe against a caller's stale copy.
   */
  previous?: number | null;
  /** Columns written alongside the score when the score is accepted. */
  fields?: Record<string, unknown>;
  /**
   * Columns written whether or not the score is accepted. Use for evidence that
   * describes the document rather than the score.
   */
  alwaysFields?: Record<string, unknown>;
  /** Set only when the user has been shown the drop and accepted it. */
  allowDecrease?: boolean;
}

export async function commitOptimizedScore(
  params: CommitOptimizedScoreParams
): Promise<OptimizedScoreCommit> {
  const {
    supabase,
    optimizationId,
    userId,
    measured,
    fields = {},
    alwaysFields = {},
    allowDecrease = false,
  } = params;

  let previous = params.previous ?? null;
  if (params.previous === undefined) {
    const query = supabase
      .from('optimizations')
      .select('ats_score_optimized')
      .eq('id', optimizationId);
    const { data } = await (userId ? query.eq('user_id', userId) : query).maybeSingle();
    previous = (data?.ats_score_optimized ?? null) as number | null;
  }

  // A first score is not a decrease. Neither is an equal one.
  const isDecrease = previous !== null && measured < previous;
  const shouldApply = !isDecrease || allowDecrease;

  const update: Record<string, unknown> = { ...alwaysFields };
  if (shouldApply) {
    Object.assign(update, fields, {
      ats_score_optimized: measured,
      match_score: measured,
    });
  }

  if (Object.keys(update).length > 0) {
    const write = supabase.from('optimizations').update(update).eq('id', optimizationId);
    const { error } = await (userId ? write.eq('user_id', userId) : write);
    if (error) throw error;
  }

  return {
    applied: shouldApply,
    stored: shouldApply ? measured : previous,
    measured,
    previous,
    decreaseBlocked: isDecrease && !allowDecrease,
  };
}
