import { commitOptimizedScore } from '@/lib/scoring/optimized-score';

/**
 * The invariant: the score a user already has never falls on its own.
 *
 * It had five independent writers, each overwriting `ats_score_optimized` and
 * `match_score` with whatever it had just measured. On 2026-08-12 the founder
 * watched the score move up and down inside one session, because the expert
 * orchestrator wrote a score and the ATS rescan immediately wrote another.
 */
function buildSupabase(storedScore: number | null) {
  const updates: Record<string, unknown>[] = [];
  const client: any = {
    updates,
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq: () => ({ maybeSingle: async () => ({ data: { ats_score_optimized: storedScore } }) }),
                maybeSingle: async () => ({ data: { ats_score_optimized: storedScore } }),
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          return {
            eq() {
              return { eq: async () => ({ error: null }), then: undefined, error: null };
            },
          };
        },
      };
    },
  };
  return client;
}

describe('commitOptimizedScore', () => {
  it('stores a higher score', async () => {
    const supabase = buildSupabase(60);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 72, previous: 60,
    });

    expect(result.applied).toBe(true);
    expect(result.stored).toBe(72);
    expect(result.decreaseBlocked).toBe(false);
    expect(supabase.updates[0]).toMatchObject({ ats_score_optimized: 72, match_score: 72 });
  });

  it('refuses a lower score and keeps the one the user has', async () => {
    const supabase = buildSupabase(72);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 65, previous: 72,
    });

    expect(result.applied).toBe(false);
    expect(result.stored).toBe(72);
    expect(result.measured).toBe(65);
    expect(result.decreaseBlocked).toBe(true);
    for (const update of supabase.updates) {
      expect(update).not.toHaveProperty('ats_score_optimized');
      expect(update).not.toHaveProperty('match_score');
    }
  });

  it('stores a lower score only once the user has accepted it', async () => {
    const supabase = buildSupabase(72);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 65, previous: 72, allowDecrease: true,
    });

    expect(result.applied).toBe(true);
    expect(result.stored).toBe(65);
    expect(result.decreaseBlocked).toBe(false);
    expect(supabase.updates[0]).toMatchObject({ ats_score_optimized: 65, match_score: 65 });
  });

  it('treats a first score as no decrease', async () => {
    const supabase = buildSupabase(null);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 41, previous: null,
    });

    expect(result.applied).toBe(true);
    expect(result.stored).toBe(41);
    expect(result.decreaseBlocked).toBe(false);
  });

  it('does not treat an equal score as a decrease', async () => {
    const supabase = buildSupabase(70);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 70, previous: 70,
    });

    expect(result.applied).toBe(true);
    expect(result.decreaseBlocked).toBe(false);
  });

  it('reads the stored score when the caller does not supply one', async () => {
    // The read is the safety net: a caller working from a stale copy must not be
    // able to talk the floor into accepting a decrease.
    const supabase = buildSupabase(80);
    const result = await commitOptimizedScore({
      supabase, optimizationId: 'opt-1', measured: 55,
    });

    expect(result.previous).toBe(80);
    expect(result.decreaseBlocked).toBe(true);
    expect(result.stored).toBe(80);
  });

  it('still writes non-score evidence when a decrease is refused', async () => {
    // Subscores and version describe the document, not the score, and must not
    // be silently dropped just because the number was refused.
    const supabase = buildSupabase(72);
    await commitOptimizedScore({
      supabase,
      optimizationId: 'opt-1',
      measured: 65,
      previous: 72,
      fields: { ats_subscores: { keywordExact: 1 } },
      alwaysFields: { ats_version: 2 },
    });

    expect(supabase.updates[0]).toEqual({ ats_version: 2 });
  });
});
