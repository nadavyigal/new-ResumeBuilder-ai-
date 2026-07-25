/**
 * ATS v2 Scoring Engine — public entry point.
 *
 * This module used to carry a second, near-identical copy of the orchestrator.
 * The two drifted (only this one had the quick-wins option) and every scorer
 * fix had to be written twice and kept in sync by hand — a fix applied to one
 * copy silently left the other call path on the old behaviour. `core.ts` is now
 * the single implementation and this file re-exports it, so there is exactly
 * one canonical score for a given resume and job (WP-45 S3).
 */

export {
  scoreResume,
  rescoreOptimization,
  SCORE_VERSION,
} from './core';

// Export all components for advanced usage
export * from './types';
export * from './analyzers/base';
export * from './config/weights';
export * from './config/thresholds';
export * from './utils/text-utils';
export * from './utils/embeddings';
export * from './extractors/resume-text-extractor';
export * from './extractors/jd-extractor';
export * from './extractors/format-analyzer';
export * from './suggestions/generator';
export * from './scorers/aggregator';
export * from './scorers/penalties';
export * from './scorers/confidence';
export * from './lift';
