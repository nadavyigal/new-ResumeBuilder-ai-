/**
 * Resolve ATS scores for UI display from optimization row fields.
 * Uses nullish coalescing so legitimate 0 scores are not replaced by fallbacks.
 */

export interface OptimizationAtsRow {
  match_score?: number | null;
  ats_score_original?: number | null;
  ats_score_optimized?: number | null;
  ats_subscores?: unknown;
  ats_subscores_original?: unknown;
  ats_confidence?: number | null;
  ats_suggestions?: unknown;
}

export interface ResolvedAtsDisplay {
  ats_score_original: number;
  ats_score_optimized: number;
  subscores: unknown;
  subscores_original: unknown;
  confidence: number | null;
  suggestions: unknown;
}

export interface AtsScoreBootstrap {
  ats_score_original: number | null;
  ats_score_optimized: number | null;
  subscores?: unknown;
  subscores_original?: unknown;
  confidence?: number | null;
}

const BOOTSTRAP_KEY_PREFIX = 'optimization-ats-bootstrap:';

export function resolveAtsDisplay(row: OptimizationAtsRow): ResolvedAtsDisplay | null {
  const optimized = row.ats_score_optimized ?? row.match_score ?? null;
  const original = row.ats_score_original ?? null;

  if (optimized === null && original === null) {
    return null;
  }

  const resolvedOptimized = optimized ?? original ?? 0;
  const resolvedOriginal = original ?? optimized ?? 0;

  return {
    ats_score_original: resolvedOriginal,
    ats_score_optimized: resolvedOptimized,
    subscores: row.ats_subscores ?? null,
    subscores_original: row.ats_subscores_original ?? null,
    confidence: row.ats_confidence ?? null,
    suggestions: row.ats_suggestions ?? null,
  };
}

export function stashAtsBootstrap(optimizationId: string, bootstrap: AtsScoreBootstrap): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${BOOTSTRAP_KEY_PREFIX}${optimizationId}`,
      JSON.stringify(bootstrap)
    );
  } catch {
    // Ignore storage failures — DB fetch remains the fallback.
  }
}

export function consumeAtsBootstrap(optimizationId: string): AtsScoreBootstrap | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${BOOTSTRAP_KEY_PREFIX}${optimizationId}`);
    if (!raw) return null;
    window.sessionStorage.removeItem(`${BOOTSTRAP_KEY_PREFIX}${optimizationId}`);
    return JSON.parse(raw) as AtsScoreBootstrap;
  } catch {
    return null;
  }
}

export function mergeAtsDisplay(
  dbRow: OptimizationAtsRow,
  bootstrap: AtsScoreBootstrap | null
): ResolvedAtsDisplay | null {
  const fromDb = resolveAtsDisplay(dbRow);
  if (!bootstrap) {
    return fromDb;
  }

  const bootstrapResolved = resolveAtsDisplay({
    match_score: bootstrap.ats_score_optimized,
    ats_score_original: bootstrap.ats_score_original,
    ats_score_optimized: bootstrap.ats_score_optimized,
    ats_subscores: bootstrap.subscores,
    ats_subscores_original: bootstrap.subscores_original,
    ats_confidence: bootstrap.confidence ?? null,
  });

  if (!fromDb) {
    return bootstrapResolved;
  }

  // Prefer DB when it already has a post-optimization score; otherwise use bootstrap.
  const dbHasOptimized = dbRow.ats_score_optimized != null;
  if (dbHasOptimized) {
    return fromDb;
  }

  return bootstrapResolved ?? fromDb;
}
