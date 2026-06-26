import { runOptimizePipeline } from '@/lib/ai-optimizer/optimize-pipeline';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { EvalCase } from './cases';

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
