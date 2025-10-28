/**
 * Threshold configuration for ATS v2 scoring
 *
 * These thresholds control penalties, suggestions, and quality checks
 */

/**
 * Penalty thresholds for cross-checks and quality issues
 */
export const PENALTY_THRESHOLDS = {
  /** Penalty if no quantified metrics found anywhere in resume */
  no_metrics_penalty: 5,

  /** Penalty if job title and seniority level don't align */
  title_mismatch_penalty: 3,

  /** Hard penalty if format_parseability < 50 (high ATS risk) */
  format_risk_penalty: 10,

  /** Penalty if semantic score high but keyword_exact low (suspicious) */
  semantic_keyword_gap_penalty: 5,

  /** Minimum format score before applying hard penalty */
  format_risk_threshold: 50,

  /** Maximum semantic vs keyword gap before penalty */
  semantic_keyword_gap_threshold: 30,
} as const;

/**
 * Thresholds for generating suggestions
 */
export const SUGGESTION_THRESHOLDS = {
  /** Sub-scores below this are "urgent" (red zone) */
  urgent_threshold: 50,

  /** Sub-scores below this generate normal suggestions (yellow zone) */
  normal_threshold: 70,

  /** Minimum estimated gain to show a suggestion (filter noise) */
  min_gain: 3,

  /** Maximum suggestions to return (avoid overwhelming user) */
  max_suggestions: 10,

  /** Minimum score difference to mark as "quick win" */
  quick_win_effort_threshold: 8,
} as const;

/**
 * Thresholds for confidence scoring
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence from all analyzers */
  min_analyzer_confidence: 0.5,

  /** Confidence penalty if JD extraction incomplete */
  jd_extraction_penalty: 0.2,

  /** Confidence penalty if resume parsing errors */
  resume_parsing_penalty: 0.15,

  /** Confidence penalty if format analysis fails */
  format_analysis_penalty: 0.1,

  /** Confidence boost if all analyzers agree (low variance) */
  analyzer_agreement_boost: 0.1,
} as const;

/**
 * Thresholds for keyword analysis
 */
export const KEYWORD_THRESHOLDS = {
  /** Minimum word length to consider as keyword */
  min_keyword_length: 3,

  /** Weight multiplier for must-have skills */
  must_have_weight: 2.0,

  /** Weight multiplier for nice-to-have skills */
  nice_to_have_weight: 1.0,

  /** Maximum keywords to extract from JD */
  max_keywords: 100,

  /** Minimum frequency for phrase extraction */
  min_phrase_frequency: 2,

  /** N-gram sizes to extract (3-6 words) */
  ngram_sizes: [3, 4, 5, 6],
} as const;

/**
 * Thresholds for semantic analysis
 */
export const SEMANTIC_THRESHOLDS = {
  /** Minimum cosine similarity to consider a match */
  min_similarity: 0.7,

  /** Top-k section pairs to compare */
  top_k_sections: 5,

  /** Semantic score cap if keyword_exact below threshold */
  keyword_cap_threshold: 40,

  /** Maximum semantic score when keyword_exact is low */
  capped_semantic_max: 70,
} as const;

/**
 * Thresholds for metrics detection
 */
export const METRICS_THRESHOLDS = {
  /** Minimum metrics across all experience roles */
  min_total_metrics: 3,

  /** Ideal metrics per role */
  ideal_metrics_per_role: 2,

  /** Patterns that count as metrics */
  metric_patterns: [
    /\d+%/,           // Percentages: 25%
    /\$[\d,]+/,       // Dollar amounts: $50,000
    /#\d+/,           // Numbers: #1 ranking
    /\d+x/,           // Multipliers: 3x increase
    /\d+[KMB]/,       // Abbreviated: 5K, 2M, 1B
  ],
} as const;

/**
 * Thresholds for recency analysis
 */
export const RECENCY_THRESHOLDS = {
  /** Years before decay starts (skills/roles older than this decay) */
  decay_start_years: 3,

  /** Maximum decay rate for old skills */
  max_decay_rate: 0.5,

  /** Boost if latest role contains most JD keywords */
  latest_role_boost: 10,

  /** Minimum keyword ratio in latest role for boost */
  latest_role_keyword_ratio: 0.6,
} as const;

/**
 * Thresholds for format analysis
 */
export const FORMAT_THRESHOLDS = {
  /** Penalty for multi-column layout */
  multi_column_penalty: 15,

  /** Penalty for tables */
  tables_penalty: 20,

  /** Penalty for images */
  images_penalty: 10,

  /** Penalty for headers/footers */
  headers_footers_penalty: 5,

  /** Penalty for non-standard fonts */
  nonstandard_fonts_penalty: 5,

  /** Base score if no format issues */
  base_format_score: 100,
} as const;

/**
 * Export all thresholds as a single object for convenience
 */
export const ATS_THRESHOLDS = {
  penalties: PENALTY_THRESHOLDS,
  suggestions: SUGGESTION_THRESHOLDS,
  confidence: CONFIDENCE_THRESHOLDS,
  keywords: KEYWORD_THRESHOLDS,
  semantic: SEMANTIC_THRESHOLDS,
  metrics: METRICS_THRESHOLDS,
  recency: RECENCY_THRESHOLDS,
  format: FORMAT_THRESHOLDS,
} as const;
