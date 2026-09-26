import { runOptimizePipeline } from '@/lib/ai-optimizer/optimize-pipeline';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { EvalCase } from './cases';
import type { PipelineOutcome } from './repeat';

export interface EvalGenerationResult {
  resume: OptimizedResume;
  passesUsed: number;
  atsScoreOptimized: number;
}

/**
 * Runs the EXACT production pipeline (runOptimizePipeline) — the same prompt,
 * model, and pass-selection logic the /api/optimize route uses. No mocking,
 * no duplicated logic, so the eval measures the real generator.
 */
export async function generateResumeForEval(c: EvalCase): Promise<EvalGenerationResult> {
  const result = await runOptimizePipeline(c.resumeText, c.jobDescription);
  return {
    resume: result.optimizedResume,
    passesUsed: result.passesUsed,
    atsScoreOptimized: result.atsResult.ats_score_optimized,
  };
}

/**
 * Same production pipeline, returning what the repeat eval compares run to run: both
 * scores, the recommendation ids, and the lift decision that controls whether the
 * user is shown a before/after pair. The nightly path above is left untouched.
 */
export async function runPipelineForEval(c: EvalCase): Promise<PipelineOutcome> {
  const result = await runOptimizePipeline(c.resumeText, c.jobDescription);
  return {
    resume: result.optimizedResume,
    scores: {
      original: result.atsResult.ats_score_original,
      optimized: result.atsResult.ats_score_optimized,
      confidence: result.atsResult.confidence,
    },
    recommendationIds: (result.atsResult.suggestions ?? []).map((s) => s.id),
    passesUsed: result.passesUsed,
    lift: { meaningful: result.lift.meaningful, displayScores: result.lift.displayScores, delta: result.lift.delta },
    truthGuard: result.truthGuard,
  };
}
