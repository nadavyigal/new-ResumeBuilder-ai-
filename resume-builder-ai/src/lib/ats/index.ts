/**
 * ATS v2 Scoring Engine - Main Orchestrator
 *
 * This is the entry point for the ATS scoring system.
 * Coordinates all analyzers and generates complete scoring output.
 */

import type { ATSScoreInput, ATSScoreOutput, AnalyzerResult, SubScoreKey } from './types';
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
import { extractResumeText } from './extractors/resume-text-extractor';
import { analyzeFormatWithTemplate } from './extractors/format-analyzer';

/**
 * Main scoring function - scores a resume against a job description
 *
 * @param input - Complete ATS scoring input
 * @returns Complete ATS scoring output with original and optimized scores
 */
export async function scoreResume(input: ATSScoreInput): Promise<ATSScoreOutput> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Prepare inputs
    const preparedInput = await prepareInput(input);

    // Run all analyzers in parallel for both original and optimized resumes
    const [originalResults, optimizedResults] = await Promise.all([
      runAllAnalyzers({
        ...preparedInput,
        resume_text: input.resume_original_text,
        resume_json: input.resume_original_json,
      }),
      runAllAnalyzers({
        ...preparedInput,
        resume_text: input.resume_optimized_text,
        resume_json: input.resume_optimized_json,
      }),
    ]);

    // Aggregate scores
    const originalAggregate = aggregateScores(originalResults);
    const optimizedAggregate = aggregateScores(optimizedResults);

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
    });

    // Collect warnings
    if (originalAggregate.failedAnalyzers.length > 0) {
      warnings.push(`Some analyzers failed: ${originalAggregate.failedAnalyzers.join(', ')}`);
    }

    if (!jdCompleteness.isComplete) {
      warnings.push(`Incomplete JD extraction: missing ${jdCompleteness.missingFields.join(', ')}`);
    }

    // Build output
    const output: ATSScoreOutput = {
      ats_score_original: originalPenalized.penalizedScore,
      ats_score_optimized: optimizedPenalized.penalizedScore,
      subscores: optimizedAggregate.subscores,
      subscores_original: originalAggregate.subscores,
      suggestions,
      confidence: confidenceResult.confidence,
      metadata: {
        version: 2,
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

    // Return fallback scores
    return createFallbackOutput(error as Error, startTime);
  }
}

/**
 * Prepare and validate input
 */
async function prepareInput(input: ATSScoreInput) {
  // Extract or enhance job data if needed
  const job_data = input.job_extracted_json?.title
    ? input.job_extracted_json
    : extractJobData(input.job_clean_text, input.job_extracted_json);

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

  return {
    job_text: input.job_clean_text,
    job_data,
    format_report,
    timestamp: input.timestamp || new Date(),
  };
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
 * Create fallback output when scoring fails
 */
function createFallbackOutput(error: Error, startTime: number): ATSScoreOutput {
  const fallbackSubscores = {
    keyword_exact: 0,
    keyword_phrase: 0,
    semantic_relevance: 0,
    title_alignment: 0,
    metrics_presence: 0,
    section_completeness: 0,
    format_parseability: 0,
    recency_fit: 0,
  };

  return {
    ats_score_original: 0,
    ats_score_optimized: 0,
    subscores: fallbackSubscores,
    subscores_original: fallbackSubscores,
    suggestions: [],
    confidence: 0,
    metadata: {
      version: 2,
      scored_at: new Date(),
      processing_time_ms: Date.now() - startTime,
      warnings: [`Fatal error: ${error.message}`],
      analyzers_used: [],
    },
  };
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
