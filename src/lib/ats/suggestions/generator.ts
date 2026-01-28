/**
 * Suggestions Generator
 *
 * Generates actionable suggestions based on sub-score gaps
 */

import type {
  Suggestion,
  SubScores,
  SubScoreKey,
  AnalyzerResult,
  SuggestionAction,
  JobExtraction,
} from '../types';
import { getTemplatesForSubScore, fillTemplate } from './templates';
import { SUGGESTION_THRESHOLDS } from '../config/thresholds';
import { estimateImpact } from './impact-estimator';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

/**
 * Generate suggestions based on low sub-scores
 */
export function generateSuggestions(params: {
  subscores: SubScores;
  analyzerResults: Map<SubScoreKey, AnalyzerResult>;
  targetScore?: number; // Target score to reach (default: 85)
  jobData?: JobExtraction;
}): Suggestion[] {
  const { subscores, analyzerResults, jobData } = params;

  const suggestions: Suggestion[] = [];

  // Identify low-scoring sub-scores
  const gaps = identifyGaps(subscores);

  // Generate suggestions for each gap
  for (const gap of gaps) {
    const templates = getTemplatesForSubScore(gap.subscore);
    const analyzerResult = analyzerResults.get(gap.subscore);

    if (!analyzerResult) continue;

    const evidence = analyzerResult.evidence;

    // Filter templates based on conditions
    const applicableTemplates = templates.filter(template => {
      if (!template.condition) return true;
      return template.condition(evidence, gap.score);
    });

    // Generate suggestions from templates
    for (const template of applicableTemplates) {
      const suggestion = createSuggestion(
        gap.subscore,
        template,
        evidence,
        gap.score,
        jobData
      );

      if (suggestion && suggestion.estimated_gain >= SUGGESTION_THRESHOLDS.min_gain) {
        suggestions.push(suggestion);
      }
    }
  }

  // Rank and filter suggestions
  return rankSuggestions(suggestions).slice(0, SUGGESTION_THRESHOLDS.max_suggestions);
}

/**
 * Identify gaps (low sub-scores) that need improvement
 */
function identifyGaps(subscores: SubScores): Array<{
  subscore: SubScoreKey;
  score: number;
  urgency: 'high' | 'medium' | 'low';
}> {
  const gaps: Array<{ subscore: SubScoreKey; score: number; urgency: 'high' | 'medium' | 'low' }> = [];

  for (const [key, score] of Object.entries(subscores) as Array<[SubScoreKey, number]>) {
    let urgency: 'high' | 'medium' | 'low' = 'low';

    if (score < SUGGESTION_THRESHOLDS.urgent_threshold) {
      urgency = 'high';
    } else if (score < SUGGESTION_THRESHOLDS.normal_threshold) {
      urgency = 'medium';
    } else {
      continue; // Skip if score is good enough
    }

    gaps.push({ subscore: key, score, urgency });
  }

  // Sort by urgency (high first) and weight (important sub-scores first)
  gaps.sort((a, b) => {
    const urgencyOrder = { high: 3, medium: 2, low: 1 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    }
    return SUB_SCORE_WEIGHTS[b.subscore] - SUB_SCORE_WEIGHTS[a.subscore];
  });

  return gaps;
}

/**
 * Create a suggestion from a template
 */
function createSuggestion(
  subscore: SubScoreKey,
  template: any,
  evidence: any,
  currentScore: number,
  jobData?: JobExtraction
): Suggestion | null {
  try {
    // Extract data for template filling
    const templateData = extractTemplateData(subscore, evidence, jobData);

    // Fill template
    const text = fillTemplate(template, templateData);

    // Estimate impact
    const estimatedGain = estimateImpact(subscore, currentScore, template.estimatedGain);

    // Generate unique ID
    const id = generateSuggestionId(subscore, text);

    const action = buildSuggestionAction(subscore, evidence, jobData);

    return {
      id,
      text,
      estimated_gain: estimatedGain,
      targets: [subscore],
      quick_win: template.quickWin && estimatedGain >= SUGGESTION_THRESHOLDS.quick_win_effort_threshold,
      category: template.category,
      action,
    };
  } catch (error) {
    console.error('Failed to create suggestion:', error);
    return null;
  }
}

/**
 * Extract data from evidence for template filling
 */
function extractTemplateData(
  subscore: SubScoreKey,
  evidence: any,
  jobData?: JobExtraction
): Record<string, any> {
  const data: Record<string, any> = {};

  switch (subscore) {
    case 'keyword_exact': {
      const keywordData = selectKeywordCandidates(evidence, jobData);
      if (keywordData.keywords.length > 0) {
        data.keyword = keywordData.keywords[0];
        data.keywords = keywordData.keywords;
        data.count = keywordData.keywords.length;
      }
      break;
    }

    case 'keyword_phrase': {
      const phrases = selectPhraseCandidates(evidence, jobData);
      if (phrases.length > 0) {
        data.phrase = phrases[0];
        data.phrases = phrases;
      }
      break;
    }

    case 'title_alignment':
      if (evidence.targetTitle) {
        data.targetTitle = evidence.targetTitle;
        data.seniority = evidence.targetSeniority || 'mid';
      }
      break;

    case 'metrics_presence':
      data.count = deriveMetricCount(evidence);
      break;

    case 'section_completeness':
      if (evidence.missing && evidence.missing.length > 0) {
        data.section = evidence.missing[0];
      }
      break;

    default:
      // Generic data
      break;
  }

  return data;
}

/**
 * Generate unique suggestion ID
 */
function generateSuggestionId(subscore: SubScoreKey, text: string): string {
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  return `${subscore}_${Math.abs(hash).toString(36)}`;
}

/**
 * Rank suggestions by impact and effort
 */
function rankSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.sort((a, b) => {
    // Quick wins first
    if (a.quick_win && !b.quick_win) return -1;
    if (!a.quick_win && b.quick_win) return 1;

    // Then by estimated gain
    return b.estimated_gain - a.estimated_gain;
  });
}

const JOB_POSTING_PATTERNS: RegExp[] = [
  /\bjob description\b/i,
  /\bresponsibilit(y|ies)\b/i,
  /\bqualifications\b/i,
  /\brequirements\b/i,
  /\bmust\s+have\b/i,
  /\bnice\s+to\s+have\b/i,
  /\byou will\b/i,
  /\bwe are\b/i,
  /\bapply\b/i,
  /\bequal opportunity\b/i,
  /\bbenefits?\b/i,
];

const GENERIC_KEYWORD_PATTERNS: RegExp[] = [
  /^job\s*title$/i,
  /^title$/i,
  /^company$/i,
  /^company\s*name$/i,
  /^about$/i,
  /^about\s+this\s+job$/i,
  /^nominal$/i,
  /^nominal\s+about$/i,
  /^responsibilities$/i,
  /^requirements$/i,
  /^qualifications$/i,
  /^location$/i,
  /^role$/i,
  /^position$/i,
];

function isGenericKeyword(keyword: string): boolean {
  const cleaned = keyword.trim().toLowerCase();
  if (cleaned.length < 3) return true;
  if (GENERIC_KEYWORD_PATTERNS.some((pattern) => pattern.test(cleaned))) return true;
  if (cleaned.startsWith('job title')) return true;
  if (cleaned.startsWith('company')) return true;
  if (cleaned.startsWith('about')) return true;
  if (cleaned.startsWith('responsibilit')) return true;
  if (cleaned.startsWith('requirement')) return true;
  if (cleaned.startsWith('qualification')) return true;
  return false;
}

function normalizePhrase(phrase: string): string {
  return phrase
    .replace(/^[\W_]+|[\W_]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(responsible for|experience with|experience in|knowledge of|ability to)\s+/i, '')
    .trim();
}

function isBoilerplatePhrase(phrase: string): boolean {
  return JOB_POSTING_PATTERNS.some((pattern) => pattern.test(phrase));
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function selectPhraseCandidates(evidence: any, jobData?: JobExtraction): string[] {
  const rawPhrases: string[] = Array.isArray(evidence?.missing)
    ? evidence.missing
    : Array.isArray(jobData?.responsibilities)
    ? jobData.responsibilities
    : [];

  const cleaned = rawPhrases
    .map((phrase) => normalizePhrase(String(phrase)))
    .filter((phrase) => phrase.length > 0)
    .filter((phrase) => !isBoilerplatePhrase(phrase))
    .filter((phrase) => {
      const wordCount = phrase.split(' ').length;
      return wordCount >= 2 && wordCount <= 8;
    });

  return dedupePreserveOrder(cleaned).slice(0, 3);
}

function selectKeywordCandidates(evidence: any, jobData?: JobExtraction): {
  keywords: string[];
  source: 'must_have' | 'nice_to_have' | 'keywords';
} {
  const missingTokens = Array.isArray(evidence?.missing)
    ? evidence.missing.map((token: string) => token.toLowerCase())
    : [];

  const mustHave = Array.isArray(jobData?.must_have) ? jobData.must_have : [];
  const niceToHave = Array.isArray(jobData?.nice_to_have) ? jobData.nice_to_have : [];

  const skillCandidates = [...mustHave, ...niceToHave];
  const matchedSkills = skillCandidates.filter((skill) => {
    const lower = String(skill).toLowerCase();
    return missingTokens.some((token: string) => lower.includes(token));
  });

  const fallbackTokens = missingTokens.filter((token: string) => token.length >= 3);
  const rawKeywords = matchedSkills.length > 0 ? matchedSkills : fallbackTokens;

  const keywords = dedupePreserveOrder(
    rawKeywords
      .map((keyword: string) => String(keyword).trim())
      .filter((keyword: string) => keyword.length >= 3)
      .filter((keyword: string) => !isGenericKeyword(keyword))
  ).slice(0, 5);

  const missingMustHave = Math.max(
    0,
    Number(evidence?.mustHaveTotal || 0) - Number(evidence?.mustHaveMatched || 0)
  );
  const source: 'must_have' | 'nice_to_have' | 'keywords' =
    missingMustHave > 0 ? 'must_have' : niceToHave.length > 0 ? 'nice_to_have' : 'keywords';

  return { keywords, source };
}

function deriveMetricCount(evidence: any): number {
  const idealMetrics = Number(evidence?.idealMetrics || 0);
  if (idealMetrics > 0) {
    return Math.min(3, idealMetrics);
  }
  return 3;
}

function buildSuggestionAction(
  subscore: SubScoreKey,
  evidence: any,
  jobData?: JobExtraction
): SuggestionAction | undefined {
  switch (subscore) {
    case 'keyword_exact': {
      const { keywords, source } = selectKeywordCandidates(evidence, jobData);
      if (keywords.length === 0) return undefined;
      return {
        type: 'add_keyword',
        params: {
          keywords,
          target: 'skills',
          source,
        },
      };
    }
    case 'keyword_phrase': {
      const phrases = selectPhraseCandidates(evidence, jobData);
      if (phrases.length === 0) return undefined;
      return {
        type: 'add_phrase',
        params: {
          phrases,
          target: 'experience',
          source: 'responsibilities',
        },
      };
    }
    case 'title_alignment': {
      if (!evidence?.targetTitle) return undefined;
      return {
        type: 'align_title',
        params: {
          targetTitle: String(evidence.targetTitle),
          targetSeniority: evidence.targetSeniority || 'mid',
          currentTitle: evidence?.bestMatch?.title,
          placement: 'summary',
        },
      };
    }
    case 'metrics_presence': {
      return {
        type: 'add_metric',
        params: {
          targetRoleIndex: 0,
          targetCount: deriveMetricCount(evidence),
          metricHint: 'impact',
        },
      };
    }
    default:
      return undefined;
  }
}
