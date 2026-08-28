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
/**
 * All four gain thresholds below were set against `estimateImpact`'s old output,
 * which multiplied an already-final-scale number by 100 and clamped it to 15
 * (WP-59 S1). On that scale every suggestion read 15, so `min_gain: 3` filtered
 * nothing and `quick_win_effort_threshold: 8` promoted everything.
 *
 * With the units corrected, real per-suggestion gains are 0.4-3.8 final-score
 * points. Carrying the old numbers forward would have silently emptied the
 * suggestions list — 3 is above almost every honest value — which is why they
 * move in the same change rather than in a follow-up.
 */
export const SUGGESTION_THRESHOLDS = {
  /** Sub-scores below this are "urgent" (red zone) */
  urgent_threshold: 50,

  /** Sub-scores below this generate normal suggestions (yellow zone) */
  normal_threshold: 70,

  /** Minimum estimated gain, in final-score points, to show a suggestion. */
  min_gain: 0.5,

  /** Maximum suggestions to return (avoid overwhelming user) */
  max_suggestions: 10,

  /** Minimum estimated gain, in final-score points, to mark as "quick win". */
  quick_win_effort_threshold: 1.5,

  /**
   * Minimum estimated gain, in final-score points, for the UI's "high impact"
   * grouping. Lives here rather than as a literal in each component, so the
   * grouping cannot drift away from the scale the estimator actually produces.
   */
  high_impact_threshold: 2,
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

  /** Minimum coverage to label a requirement matched in evidence/gap detection */
  match_classification_threshold: 0.6,

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

  /**
   * Technologies short enough to be deleted by `min_keyword_length`.
   *
   * `tokenize` and `skillCoverage` both drop tokens under 3 characters, so a
   * job requiring Go, AI, ML, QA, UX, BI or CI never measured whether the
   * candidate had it — the requirement was removed before matching rather than
   * scored as missing. Single letters (`r`, `c`) stay out: lowercased and
   * word-bounded they match far too much ordinary prose to be evidence of a
   * skill (WP-59 S3c).
   */
  short_skill_tokens: new Set([
    'go', 'js', 'ts', 'ai', 'ml', 'qa', 'ux', 'ui', 'bi', 'ci', 'cd', 'nlp',
    'etl', 'api', 'aws', 'gcp', 'sql', 'php', 'ios',
  ]),
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

  /**
   * Cosine similarity anchors for the 0-100 scale (WP-59 S3b).
   *
   * The analyzer used to map cosine with `(cos + 1) / 2`, the textbook
   * transform for a value that can legitimately reach -1. Embeddings of two
   * real documents never go near -1: measured across the 32-case benchmark the
   * component spanned only **61 to 84**, on cases a human labelled strong,
   * stretch AND weak. Eighteen percent of the composite was carrying a
   * 23-point usable range, so it could neither reward a genuine match nor
   * distinguish one from a poor one — and its floor of 61 is what made the
   * semantic-vs-keyword gap penalty fire on essentially every low-keyword
   * resume.
   *
   * These anchor the scale to the range embeddings actually produce here:
   * `floor` is two documents with nothing in common, `ceiling` is a resume that
   * reads like the job description. Values outside are clamped.
   *
   * Anything that changes these changes the scale, and the bands in
   * config/bands.ts must be re-derived in the same change.
   */
  cosine_floor: 0.10,
  cosine_ceiling: 0.70,
} as const;

/**
 * Thresholds for metrics detection
 */
export const METRICS_THRESHOLDS = {
  /** Minimum metrics across all experience roles */
  min_total_metrics: 3,

  /** Ideal metrics per role */
  ideal_metrics_per_role: 2,

  /**
   * Patterns that count as a quantified achievement.
   *
   * The first five are the original set. Between them they require a `%`, a
   * `$`, a `#`, an `x` or an uppercase K/M/B — so every ordinary quantity a
   * real engineer writes counted as NO metric at all:
   *
   *   "reduced p99 latency from 800ms to 120ms"   -> 0 metrics
   *   "led a team of 12 engineers"                -> 0 metrics
   *   "served 3 million requests per day"         -> 0 metrics
   *   "cut deploy time from 40 minutes to 6"      -> 0 metrics
   *
   * `metrics_presence` hard-clamps to 0 when nothing matches, so those resumes
   * forfeited the whole 11.4% weight. Measured across the 32-case benchmark the
   * component meaned 5.3 out of 100 — on fixtures written to contain metrics
   * (WP-59 S3d).
   *
   * The additions all require a number bound to a UNIT or a countable noun, or
   * an explicit before/after. A bare integer still does not count, so years
   * ("2019"), phone numbers and street numbers stay out.
   *
   * This changes what counts as a metric the candidate ALREADY WROTE. It does
   * not touch `stripFabricatedMetrics`, which stops the optimizer inventing
   * figures, and must stay exactly as strict as it is.
   */
  metric_patterns: [
    /\d+%/,           // Percentages: 25%
    /\$[\d,]+/,       // Dollar amounts: $50,000
    /#\d+/,           // Numbers: #1 ranking
    /\d+\s*x\b/i,     // Multipliers: 3x increase
    /\d+\s*[KMB]\b/,  // Abbreviated: 5K, 2M, 1B

    // Magnitude words: "3 million requests", "250 thousand users"
    /\b\d[\d,.]*\s*(?:million|billion|thousand|mn|bn)\b/i,

    // Durations and latencies: "800ms", "40 minutes", "3 weeks"
    /\b\d[\d,.]*\s*(?:ms|milliseconds?|s(?:ec(?:onds?)?)?|min(?:utes?)?|hrs?|hours?|days?|weeks?|months?|quarters?)\b/i,

    // Data and throughput: "2TB", "500 rps", "1.2GB"
    /\b\d[\d,.]*\s*(?:[kmgt]b|rps|qps|tps|iops|fps)\b/i,

    // Counted things a resume actually claims
    /\b\d[\d,.]*\s*(?:users?|customers?|clients?|accounts?|engineers?|developers?|people|reports?|requests?|queries|transactions?|records?|rows?|teams?|projects?|stores?|markets?|countries|languages?|integrations?|services?|microservices?|endpoints?)\b/i,

    // Explicit before/after, the clearest impact claim of all
    /\bfrom\s+\d[\d,.]*\s*\S*\s+to\s+\d/i,
  ],
} as const;

/**
 * Thresholds for recency analysis
 */
export const RECENCY_THRESHOLDS = {
  /** Years before decay starts (skills/roles older than this decay) */
  decay_start_years: 3,

  /**
   * Maximum decay rate for old skills.
   *
   * Bounded so that the worst real score stays at or above the 50 no-data
   * fallback: 100 * (1 - 0.28) * relevance_floor = 50.4. At the previous 0.5
   * the floor was 35, so a resume with genuinely stale dated history scored
   * BELOW one the parser could not read at all — the same "more information
   * scores you lower" defect this work removes, just in its other corner.
   *
   * Raising this above 0.28, or lowering relevance_floor, reopens it. The
   * relationship is asserted in recency-monotonicity.test.ts.
   */
  max_decay_rate: 0.28,

  /** Boost if latest role contains most JD keywords */
  latest_role_boost: 10,

  /**
   * Floor of the relevance modifier applied to the recency score.
   *
   * Relevance of the newest role scales recency between this value and 1.0.
   * At 0.7, a current role with no keyword overlap still scores 70 rather than
   * the 0 the previous multiplicative form produced. Recency measures how
   * recent the experience is; keyword_exact measures overlap, at 0.25 weight.
   * Lowering this back toward 0 re-couples the two (WP-45 D7).
   */
  relevance_floor: 0.7,

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
