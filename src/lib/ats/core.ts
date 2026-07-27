/**
 * ATS v2 Scoring Engine - Main Orchestrator
 *
 * This is the entry point for the ATS scoring system.
 * Coordinates all analyzers and generates complete scoring output.
 */

import type { ATSScoreInput, ATSScoreOutput, AnalyzerResult, SubScoreKey, QuickWinSuggestion, JobExtraction, SubScores } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import {  KeywordExactAnalyzer } from './analyzers/keyword-exact';
import { KeywordPhraseAnalyzer } from './analyzers/keyword-phrase';
import { SemanticAnalyzer } from './analyzers/semantic';
import { TitleAlignmentAnalyzer } from './analyzers/title-alignment';
import { MetricsAnalyzer } from './analyzers/metrics-presence';
import { SectionCompletenessAnalyzer } from './analyzers/section-completeness';
import { FormatAnalyzer } from './analyzers/format-parseability';
import { RecencyAnalyzer } from './analyzers/recency-fit';
import { aggregateScores } from './scorers/aggregator';
import { applyPenalties } from './scorers/penalties';
import { estimateConfidence } from './scorers/confidence';
import { generateSuggestions } from './suggestions/generator';
import { extractJobData, isJobExtractionComplete } from './extractors/jd-extractor';
import { buildJobDataFromExtractedJson } from './job-data-resolver';
import { extractResumeText } from './extractors/resume-text-extractor';
import { analyzeFormatWithTemplate } from './extractors/format-analyzer';
import { deriveResumeJsonFromText } from './extractors/experience-text-extractor';
import { assertMeasurable } from './journey-score';

/**
 * Identifies the scoring regime that produced a result.
 *
 * Scores are not comparable across versions. The scale shifted materially on
 * 2026-06-18 when keyword matching was tightened without recalibration, and
 * again with the WP-45 S1/S2 repairs. Anything that trends, averages or
 * compares stored scores must filter to one version (WP-45 S9).
 */
export const SCORE_VERSION = 'ats_v2.2_wp45_d7';

/**
 * Produces the free checker's quick wins. Injected by server callers so that
 * core.ts stays free of any module reaching Node built-ins — see the note on
 * `quickWinsGenerator` below.
 */
export type QuickWinsGenerator = (args: {
  resume_text: string;
  resume_json: OptimizedResume;
  job_data: JobExtraction;
  subscores: SubScores;
  current_ats_score: number;
}) => Promise<QuickWinSuggestion[]>;

/**
 * Normalize ATS score — clamps to valid [0, 100] range.
 * Real score lift comes from the multi-pass pipeline, not artificial inflation.
 */
function normalizeATSScore(rawScore: number): number {
  return Math.max(0, Math.min(100, rawScore));
}

/**
 * Main scoring function - scores a resume against a job description
 *
 * @param input - Complete ATS scoring input
 * @param options - Optional configuration
 * @returns Complete ATS scoring output with original and optimized scores
 */
export async function scoreResume(
  input: ATSScoreInput,
  options?: {
    /**
     * Supply the quick-wins generator to have quick wins produced.
     *
     * Injected rather than imported. That module reaches posthog-node, which
     * needs node:readline, and core.ts is transitively imported by a client
     * page via integration.ts -> optimization-review -> the review page. A
     * static or dynamic import here puts a Node built-in in the browser bundle
     * and the production build fails (WP-58). Server callers pass the
     * generator in; the browser never sees it.
     */
    quickWinsGenerator?: QuickWinsGenerator;
  }
): Promise<ATSScoreOutput> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Prepare inputs
    const preparedInput = await prepareInput(input);

    // Debug logging for job data extraction
    console.log('🔍 ATS Debug - Job Data:', {
      title: preparedInput.job_data.title,
      must_have_count: preparedInput.job_data.must_have.length,
      must_have_sample: preparedInput.job_data.must_have.slice(0, 10),
      nice_to_have_count: preparedInput.job_data.nice_to_have.length,
      nice_to_have_sample: preparedInput.job_data.nice_to_have.slice(0, 5),
      responsibilities_count: preparedInput.job_data.responsibilities.length,
    });

    // Run all analyzers in parallel for both original and optimized resumes.
    //
    // Each side gets its own format report and its own structured resume, so
    // format_parseability and recency_fit are measured the same way on both
    // sides of the comparison (WP-45 D3/D4). Sharing them made 22% of the
    // weighting either frozen or asymmetric across the before/after pair.
    // Both sides must be measured by the same function, so the comparison
    // reflects the resume rather than which representation happened to be
    // available. section_completeness, title_alignment, metrics_presence and
    // semantic_relevance all branch on `resume_json`, and in the shipping path
    // only the optimized side has it — production shows section_completeness
    // reading 99.7 optimized against 66.5 original, with 58 of 59 rows at 100,
    // because one side was measured by field presence and the other by a
    // header regex over messy extracted text (WP-45 S2).
    //
    // So: use the structured path only when BOTH sides are structured.
    // Recency is exempt — it takes `recency_json`, which is reconstructed for
    // the original side precisely so it stays comparable.
    const useStructured = Boolean(input.resume_original_json && input.resume_optimized_json);

    // Recency has to be measured with the same information on both sides, or
    // its delta reports which side happened to parse rather than what the
    // optimization did. Resolving each side independently was not enough:
    // cases remained where one side read 85 and the other fell back to 50,
    // handing the comparison a ~3-point swing no content change earned.
    //
    // So when either side has no dated history, neither side gets one. Both
    // land on the analyzer's no-data constant and recency contributes exactly
    // zero to the delta, which is the honest answer when we cannot date one of
    // the two documents (WP-45 D7).
    const originalRecency = resolveOriginalResumeJson(input);
    const optimizedRecency = resolveOptimizedResumeJson(input);
    const bothSidesDated =
      hasDatedExperience(originalRecency) && hasDatedExperience(optimizedRecency);

    const [originalRecencyJson, optimizedRecencyJson] = bothSidesDated
      ? [originalRecency, optimizedRecency]
      : [undefined, undefined];

    const [originalResults, optimizedResults] = await Promise.all([
      runAllAnalyzers({
        ...preparedInput,
        format_report: preparedInput.format_report_original,
        resume_text: input.resume_original_text,
        resume_json: useStructured ? input.resume_original_json : undefined,
        recency_json: originalRecencyJson,
      }),
      runAllAnalyzers({
        ...preparedInput,
        format_report: preparedInput.format_report_optimized,
        resume_text: input.resume_optimized_text,
        resume_json: useStructured ? input.resume_optimized_json : undefined,
        recency_json: optimizedRecencyJson,
      }),
    ]);

    // Aggregate scores
    const originalAggregate = aggregateScores(originalResults);
    const optimizedAggregate = aggregateScores(optimizedResults);

    // Debug logging for subscores
    console.log('📊 ATS Debug - Original Subscores:', originalAggregate.subscores);
    console.log('📊 ATS Debug - Optimized Subscores:', optimizedAggregate.subscores);
    console.log('📊 ATS Debug - Final Scores:', {
      original: originalAggregate.finalScore,
      optimized: optimizedAggregate.finalScore,
    });

    // Apply penalties
    const originalPenalized = applyPenalties(
      originalAggregate.finalScore,
      originalAggregate.subscores,
      {}
    );

    const optimizedPenalized = applyPenalties(
      optimizedAggregate.finalScore,
      optimizedAggregate.subscores,
      {}
    );

    // Normalize scores — clamp to [0, 100]; genuine lift comes from the pipeline
    const normalizedOriginal = normalizeATSScore(originalPenalized.penalizedScore);
    const normalizedOptimized = normalizeATSScore(optimizedPenalized.penalizedScore);

    const improvement = normalizedOptimized - normalizedOriginal;

    console.log('🔧 ATS Score Normalization:', {
      original: { raw: originalPenalized.penalizedScore, normalized: normalizedOriginal },
      optimized: { raw: optimizedPenalized.penalizedScore, normalized: normalizedOptimized },
      improvement: improvement,
      corrected: normalizedOptimized === normalizedOriginal && originalPenalized.penalizedScore !== optimizedPenalized.penalizedScore
    });

    // A number we cannot stand behind must never leave this function.
    //
    // Founder direction 2026-07-27, and it is the right rule: "no way users see
    // a score that is not measured". The accept path used to persist an
    // original side reading keyword_exact 0, semantic_relevance 0,
    // section_completeness 0 and format_parseability 100 — the signature of
    // scoring an empty document — and a user was shown 29 for a real 3376
    // character resume.
    //
    // Guarding at the one call site that produced the report would have left
    // the fit check, the free check and every rescan free to do the same thing,
    // so the check lives here, at the single point every score passes through.
    // Failing loudly is the point: an error surfaces as a retry, while a wrong
    // number surfaces as a user deciding the product is untrustworthy.
    assertMeasurable(originalAggregate.subscores, 'original');
    assertMeasurable(optimizedAggregate.subscores, 'optimized');

    // Estimate confidence
    const jdCompleteness = isJobExtractionComplete(preparedInput.job_data);
    const confidenceResult = estimateConfidence({
      analyzerResults: optimizedResults,
      jdExtractionCompleteness: jdCompleteness.completeness,
      resumeParsingQuality: 0.9, // TODO: Add actual resume parsing quality metric
      formatAnalysisAvailable: !!input.format_report,
    });

    // Generate suggestions based on optimized scores
    const suggestions = generateSuggestions({
      subscores: optimizedAggregate.subscores,
      analyzerResults: optimizedResults,
      targetScore: 85,
      jobData: preparedInput.job_data,
    });

    // Generate quick wins if requested
    let quickWins: QuickWinSuggestion[] | undefined;

    if (options?.quickWinsGenerator) {
      try {
        quickWins = await options.quickWinsGenerator({
          resume_text: input.resume_optimized_text,
          resume_json: input.resume_optimized_json || {} as any,
          job_data: preparedInput.job_data,
          subscores: optimizedAggregate.subscores,
          current_ats_score: Math.round(normalizedOptimized),
        });

        console.log('✨ Generated quick wins:', quickWins.length);
      } catch (error) {
        console.error('Quick wins generation failed, skipping:', error);
        // Don't block scoring if quick wins fail
      }
    }

    // Collect warnings
    if (originalAggregate.failedAnalyzers.length > 0) {
      warnings.push(`Some analyzers failed: ${originalAggregate.failedAnalyzers.join(', ')}`);
    }

    if (!jdCompleteness.isComplete) {
      warnings.push(`Incomplete JD extraction: missing ${jdCompleteness.missingFields.join(', ')}`);
    }

    // Build output with normalized scores
    // Round scores only at final output to preserve precision during calculations
    const output: ATSScoreOutput = {
      ats_score_original: Math.round(normalizedOriginal),
      ats_score_optimized: Math.round(normalizedOptimized),
      subscores: optimizedAggregate.subscores,
      subscores_original: originalAggregate.subscores,
      suggestions,
      ...(quickWins ? { quick_wins: quickWins } : {}),
      confidence: confidenceResult.confidence,
      metadata: {
        version: 2,
        score_version: SCORE_VERSION,
        scored_at: new Date(),
        processing_time_ms: Date.now() - startTime,
        warnings,
        analyzers_used: Array.from(optimizedResults.keys()),
        cache_stats: {
          embeddings_cached: false, // TODO: Get from embeddings client
        },
      },
    };

    return output;
  } catch (error) {
    console.error('ATS scoring failed:', error);

    // Rethrow. This used to return `createFallbackOutput`, an all-zero score
    // object with score 0 and every subscore 0, which callers then persisted
    // and displayed as though it had been measured.
    //
    // That is the mechanism behind "the app showed me a number that was never
    // measured": any failure anywhere in the pipeline became a confident-looking
    // 0 rather than an error. Founder direction 2026-07-27 — "no way users see a
    // score that is not measured" — makes this a hard failure. A caller that
    // cannot score must say so, retry, or show nothing; it may not invent a
    // number (WP-45 D8).
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Prepare and validate input
 */
async function prepareInput(input: ATSScoreInput) {
  // Extract or enhance job data if needed
  // Handle both database format (job_title) and scorer format (title)
  const hasValidJobData = input.job_extracted_json?.title || input.job_extracted_json?.job_title;

  const fallbackJobText =
    input.job_clean_text ||
    (input.job_extracted_json as { raw_text?: string; clean_text?: string }).clean_text ||
    (input.job_extracted_json as { raw_text?: string; clean_text?: string }).raw_text ||
    '';

  let job_data;
  if (hasValidJobData) {
    job_data = buildJobDataFromExtractedJson(input.job_extracted_json, fallbackJobText);
  } else {
    // Extract from text
    job_data = extractJobData(input.job_clean_text, input.job_extracted_json);
  }

  // Generate format report if not provided
  const format_report = input.format_report
    ? input.format_report
    : input.resume_optimized_json
    ? analyzeFormatWithTemplate(input.resume_optimized_json, null)
    : {
        has_tables: false,
        has_images: false,
        has_headers_footers: false,
        has_nonstandard_fonts: false,
        has_odd_glyphs: false,
        has_multi_column: false,
        format_safety_score: 70,
        issues: [],
      };

  // Resolve a report per side (WP-45 D3). An explicit per-side report always
  // wins — callers are responsible for deriving both from the same function.
  //
  // The analyzeFormatWithTemplate fallback only applies when BOTH sides are
  // structured. Applying it to whichever side happens to have JSON would score
  // one side with the JSON heuristic (base 100) and the other with whatever
  // the shared report holds, which is the same two-different-functions
  // comparison this field exists to eliminate (WP-45 S2).
  const bothStructured = Boolean(input.resume_original_json && input.resume_optimized_json);

  const format_report_original =
    input.format_report_original ??
    (bothStructured
      ? analyzeFormatWithTemplate(input.resume_original_json!, null)
      : format_report);

  const format_report_optimized =
    input.format_report_optimized ??
    (bothStructured
      ? analyzeFormatWithTemplate(input.resume_optimized_json!, null)
      : format_report);

  return {
    job_text: input.job_clean_text,
    job_data,
    format_report,
    format_report_original,
    format_report_optimized,
    timestamp: input.timestamp || new Date(),
  };
}

/**
 * The original resume usually arrives as plain text with no structured JSON,
 * which sends the recency analyzer down its "no experience data" path and pins
 * it at a constant 50 — while the optimized side, which always has JSON, gets a
 * real number. Deriving a minimal structure from the text makes the two sides
 * comparable. Returns undefined when nothing dated can be read, preserving the
 * previous behavior rather than scoring against a guess (WP-45 D4).
 *
 * The result is passed as `recency_json`, never as `resume_json`: the derived
 * object has no summary, skills or education, and section_completeness,
 * metrics_presence, title_alignment and semantic all branch on `resume_json`.
 * Feeding them the stub would read those empty fields as missing sections and
 * push the ORIGINAL score down, widening the reported improvement for reasons
 * unrelated to the optimization.
 */
function resolveOriginalResumeJson(input: ATSScoreInput) {
  if (hasDatedExperience(input.resume_original_json)) return input.resume_original_json;
  return (
    deriveResumeJsonFromText(input.resume_original_text) ??
    input.resume_original_json ??
    undefined
  );
}

/**
 * Does this resume carry work history the recency analyzer can actually date?
 *
 * `experience.length` alone is not enough. `estimateYearsAgo` falls back to
 * "index 0 is the current role" when an entry has no parseable end date, so an
 * undated list reads as perfectly current and inflates the score. Worse, it
 * would satisfy the both-sides-dated gate below and let a real measurement be
 * compared against a guess.
 */
function hasDatedExperience(resume: { experience?: unknown } | null | undefined): boolean {
  const experience = resume?.experience;
  if (!Array.isArray(experience) || experience.length === 0) return false;

  return experience.some(entry => {
    const role = entry as { startDate?: unknown; endDate?: unknown };
    return [role.startDate, role.endDate].some(
      value => typeof value === 'string' && /\b(19|20)\d{2}\b|present/i.test(value)
    );
  });
}

/**
 * The same resolution for the optimized side, so a comparison is never made
 * between one side that has dated work history and one that fell back.
 *
 * The original side alone used to get this treatment, which left the exact
 * asymmetry it was written to remove — just pointing the other way. A
 * benchmark case scored recency 93 original against 50 optimized, purely
 * because the optimized JSON carried no parseable dates, and reported the
 * optimization as -4. An optimization must not lose points because one
 * representation parsed and the other did not (WP-45 D7).
 */
function resolveOptimizedResumeJson(input: ATSScoreInput) {
  if (hasDatedExperience(input.resume_optimized_json)) {
    return input.resume_optimized_json;
  }
  return (
    deriveResumeJsonFromText(input.resume_optimized_text) ??
    input.resume_optimized_json ??
    undefined
  );
}

/**
 * Run all 8 analyzers
 */
async function runAllAnalyzers(analyzerInput: any): Promise<Map<SubScoreKey, AnalyzerResult>> {
  // Initialize all analyzers
  const analyzers = [
    new KeywordExactAnalyzer(),
    new KeywordPhraseAnalyzer(),
    new SemanticAnalyzer(),
    new TitleAlignmentAnalyzer(),
    new MetricsAnalyzer(),
    new SectionCompletenessAnalyzer(),
    new FormatAnalyzer(),
    new RecencyAnalyzer(),
  ];

  // Run all analyzers in parallel
  const results = await Promise.all(
    analyzers.map(async (analyzer) => {
      try {
        const result = await analyzer.analyze(analyzerInput);
        return { key: analyzer.name, result };
      } catch (error) {
        console.error(`Analyzer ${analyzer.name} failed:`, error);
        return {
          key: analyzer.name,
          result: {
            score: 0,
            evidence: { error: (error as Error).message },
            confidence: 0,
            warnings: ['Analyzer failed'],
          },
        };
      }
    })
  );

  // Convert to Map
  const resultsMap = new Map<SubScoreKey, AnalyzerResult>();
  results.forEach(({ key, result }) => {
    resultsMap.set(key, result);
  });

  return resultsMap;
}


/**
 * Re-score an existing optimization (for migration or rescan)
 */
export async function rescoreOptimization(params: {
  resume_original: any;
  resume_optimized: any;
  job_description: string;
  job_data?: any;
}): Promise<ATSScoreOutput> {
  const input: ATSScoreInput = {
    resume_original_text: extractResumeText(params.resume_original),
    resume_optimized_text: extractResumeText(params.resume_optimized),
    job_clean_text: params.job_description,
    job_extracted_json: params.job_data || extractJobData(params.job_description),
    format_report: analyzeFormatWithTemplate(params.resume_optimized, null),
    resume_original_json: params.resume_original,
    resume_optimized_json: params.resume_optimized,
  };

  return scoreResume(input);
}

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
