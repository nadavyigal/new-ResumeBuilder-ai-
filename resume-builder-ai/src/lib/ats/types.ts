/**
 * TypeScript type definitions for ATS v2 Scoring System
 *
 * This module defines all interfaces and types for the improved
 * multi-dimensional ATS scoring engine.
 */

import type { OptimizedResume } from '@/lib/ai-optimizer';

// ============================================================================
// Input Types
// ============================================================================

/**
 * Complete input required for ATS scoring
 */
export interface ATSScoreInput {
  /** Plain text extracted from original resume */
  resume_original_text: string;

  /** Plain text extracted from optimized resume */
  resume_optimized_text: string;

  /** Cleaned and normalized job description text */
  job_clean_text: string;

  /** Structured data extracted from job description */
  job_extracted_json: JobExtraction;

  /** Format analysis report for both resumes */
  format_report: FormatReport;

  /** Timestamp for recency calculations (defaults to now) */
  timestamp?: Date;

  /** Original resume JSON structure */
  resume_original_json?: OptimizedResume;

  /** Optimized resume JSON structure */
  resume_optimized_json?: OptimizedResume;
}

/**
 * Structured job description data extracted by parsers
 */
export interface JobExtraction {
  /** Job title */
  title: string;

  /** Company name */
  company?: string;

  /** Must-have skills and requirements (high priority) */
  must_have: string[];

  /** Nice-to-have skills and requirements (lower priority) */
  nice_to_have: string[];

  /** Key responsibilities from JD */
  responsibilities: string[];

  /** Seniority level (entry, mid, senior, lead, executive) */
  seniority?: string;

  /** Location (for recency and relevance) */
  location?: string;

  /** Industry or domain */
  industry?: string;
}

/**
 * Format analysis report identifying ATS risk factors
 */
export interface FormatReport {
  /** Has multi-column layout */
  has_tables: boolean;

  /** Has images or graphics */
  has_images: boolean;

  /** Has headers or footers */
  has_headers_footers: boolean;

  /** Uses non-standard fonts */
  has_nonstandard_fonts: boolean;

  /** Has unusual characters or glyphs */
  has_odd_glyphs: boolean;

  /** Uses multiple columns */
  has_multi_column: boolean;

  /** Overall format risk score (0-100, higher = safer) */
  format_safety_score: number;

  /** Specific format issues detected */
  issues: string[];
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Complete ATS scoring output
 */
export interface ATSScoreOutput {
  /** ATS match score for original resume (0-100) */
  ats_score_original: number;

  /** ATS match score for optimized resume (0-100) */
  ats_score_optimized: number;

  /** Breakdown of all sub-scores */
  subscores: SubScores;

  /** Original subscores (for comparison) */
  subscores_original: SubScores;

  /** Actionable suggestions ranked by impact */
  suggestions: Suggestion[];

  /** Confidence in the scoring (0.0-1.0) */
  confidence: number;

  /** Metadata about the scoring process */
  metadata: ScoringMetadata;
}

/**
 * All 8 sub-scores that comprise the final ATS score
 */
export interface SubScores {
  /** Exact keyword matches from job description (weight: 0.22) */
  keyword_exact: number;

  /** Phrase-level matches using n-grams (weight: 0.12) */
  keyword_phrase: number;

  /** Semantic similarity via embeddings (weight: 0.16) */
  semantic_relevance: number;

  /** Job title and seniority alignment (weight: 0.10) */
  title_alignment: number;

  /** Quantified achievements presence (%, $, #) (weight: 0.10) */
  metrics_presence: number;

  /** Resume section completeness (weight: 0.08) */
  section_completeness: number;

  /** ATS-safe format compliance (weight: 0.14) */
  format_parseability: number;

  /** Temporal relevance of skills/roles (weight: 0.08) */
  recency_fit: number;
}

/**
 * Keys for sub-scores (used for type safety)
 */
export type SubScoreKey = keyof SubScores;

/**
 * Actionable suggestion to improve ATS score
 */
export interface Suggestion {
  /** Unique identifier for this suggestion */
  id: string;

  /** Human-readable suggestion text */
  text: string;

  /** Estimated point gain if applied (1-15) */
  estimated_gain: number;

  /** Which sub-scores this suggestion targets */
  targets: SubScoreKey[];

  /** True if this is a quick win (high impact, low effort) */
  quick_win: boolean;

  /** Category for grouping suggestions */
  category: SuggestionCategory;

  /** Detailed explanation (optional) */
  explanation?: string;

  /** Specific action to take (optional) */
  action?: SuggestionAction;
}

/**
 * Suggestion categories for UI grouping
 */
export type SuggestionCategory =
  | 'keywords'
  | 'formatting'
  | 'content'
  | 'structure'
  | 'metrics';

/**
 * Actionable fix that can be auto-applied
 */
export interface SuggestionAction {
  /** Type of action */
  type: 'add_keyword' | 'switch_template' | 'add_metric' | 'add_section' | 'reorder';

  /** Parameters for the action */
  params: Record<string, unknown>;
}

/**
 * Metadata about the scoring process
 */
export interface ScoringMetadata {
  /** Version of the scoring engine (always 2) */
  version: number;

  /** Timestamp when scoring was performed */
  scored_at: Date;

  /** Processing time in milliseconds */
  processing_time_ms: number;

  /** Warnings encountered during scoring */
  warnings: string[];

  /** Which analyzers were used */
  analyzers_used: SubScoreKey[];

  /** Cache hit/miss stats for embeddings */
  cache_stats?: {
    embeddings_cached: boolean;
    cache_key?: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Weight configuration for sub-scores is defined in ./config/weights
 * Import SUB_SCORE_WEIGHTS from there to use weight values.
 */

/**
 * Penalty thresholds for cross-checks
 */
export interface PenaltyThresholds {
  /** Penalty if no quantified metrics found */
  no_metrics_penalty: number;

  /** Penalty if title/seniority mismatch is high */
  title_mismatch_penalty: number;

  /** Penalty if format score below threshold */
  format_risk_penalty: number;

  /** Penalty if high semantic but low keyword exact (suspicious) */
  semantic_keyword_gap_penalty: number;
}

export const DEFAULT_PENALTIES: PenaltyThresholds = {
  no_metrics_penalty: 5,
  title_mismatch_penalty: 3,
  format_risk_penalty: 10,
  semantic_keyword_gap_penalty: 5,
};

/**
 * Thresholds for determining suggestion urgency
 */
export interface SuggestionThresholds {
  /** Sub-score below this triggers urgent suggestions */
  urgent_threshold: number;

  /** Sub-score below this triggers normal suggestions */
  normal_threshold: number;

  /** Minimum estimated gain to include suggestion */
  min_gain: number;

  /** Maximum suggestions to return */
  max_suggestions: number;
}

export const DEFAULT_SUGGESTION_THRESHOLDS: SuggestionThresholds = {
  urgent_threshold: 50,
  normal_threshold: 70,
  min_gain: 3,
  max_suggestions: 10,
};

// ============================================================================
// Analyzer Types
// ============================================================================

/**
 * Base interface for all analyzers
 */
export interface Analyzer {
  /** Unique name for this analyzer */
  name: SubScoreKey;

  /** Weight of this analyzer in final score */
  weight: number;

  /** Analyze resume against job description */
  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
}

/**
 * Input to individual analyzers
 */
export interface AnalyzerInput {
  /** Resume text to analyze */
  resume_text: string;

  /** Resume JSON structure (optional) */
  resume_json?: OptimizedResume;

  /** Job description text */
  job_text: string;

  /** Job extraction data */
  job_data: JobExtraction;

  /** Format report */
  format_report?: FormatReport;

  /** Timestamp for recency calculations */
  timestamp?: Date;
}

/**
 * Result from individual analyzers
 */
export interface AnalyzerResult {
  /** Score from this analyzer (0-100) */
  score: number;

  /** Evidence supporting the score */
  evidence: AnalyzerEvidence;

  /** Confidence in this analysis (0.0-1.0) */
  confidence: number;

  /** Warnings or issues detected */
  warnings: string[];
}

/**
 * Evidence collected by analyzers
 */
export interface AnalyzerEvidence {
  /** Keywords or phrases matched/missing */
  matched?: string[];
  missing?: string[];

  /** Numeric metrics detected */
  metrics?: {
    found: number;
    expected: number;
    examples: string[];
  };

  /** Sections analyzed */
  sections?: {
    present: string[];
    missing: string[];
  };

  /** Any other relevant data */
  [key: string]: unknown;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result of text normalization
 */
export interface NormalizedText {
  /** Original text */
  original: string;

  /** Normalized lowercase text */
  normalized: string;

  /** Tokens/words extracted */
  tokens: string[];

  /** N-grams (2-6 words) */
  ngrams: string[];
}

/**
 * Embedding vector result from OpenAI
 */
export interface EmbeddingResult {
  /** Text that was embedded */
  text: string;

  /** 1536-dimensional embedding vector */
  vector: number[];

  /** Whether this was from cache */
  cached: boolean;

  /** Cache key used */
  cache_key?: string;
}

/**
 * Cosine similarity result between two embeddings
 */
export interface SimilarityResult {
  /** Similarity score (0.0-1.0) */
  score: number;

  /** Text 1 */
  text1: string;

  /** Text 2 */
  text2: string;
}
