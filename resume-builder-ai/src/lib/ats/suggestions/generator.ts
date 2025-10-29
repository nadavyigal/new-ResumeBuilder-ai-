/**
 * Suggestions Generator
 *
 * Generates actionable suggestions based on sub-score gaps
 */

import type { Suggestion, SubScores, SubScoreKey, AnalyzerResult } from '../types';
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
}): Suggestion[] {
  const { subscores, analyzerResults, targetScore = 85 } = params;

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
        gap.score
      );

      if (suggestion && suggestion.estimated_gain >= SUGGESTION_THRESHOLDS.min_gain) {
        suggestions.push(suggestion);
      }
    }
  }

  // Rank and filter suggestions
  return rankSuggestions(suggestions, targetScore).slice(0, SUGGESTION_THRESHOLDS.max_suggestions);
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
  currentScore: number
): Suggestion | null {
  try {
    // Extract data for template filling
    const templateData = extractTemplateData(subscore, evidence);

    // Fill template
    const text = fillTemplate(template, templateData);

    // Estimate impact
    const estimatedGain = estimateImpact(subscore, currentScore, template.estimatedGain);

    // Generate unique ID
    const id = generateSuggestionId(subscore, text);

    return {
      id,
      text,
      estimated_gain: estimatedGain,
      targets: [subscore],
      quick_win: template.quickWin && estimatedGain >= SUGGESTION_THRESHOLDS.quick_win_effort_threshold,
      category: template.category,
    };
  } catch (error) {
    console.error('Failed to create suggestion:', error);
    return null;
  }
}

/**
 * Extract data from evidence for template filling
 */
function extractTemplateData(subscore: SubScoreKey, evidence: any): Record<string, any> {
  const data: Record<string, any> = {};

  switch (subscore) {
    case 'keyword_exact':
      if (evidence.missing) {
        data.keyword = evidence.missing[0];
        data.keywords = evidence.missing.slice(0, 5);
        data.count = evidence.missing.length;
      }
      break;

    case 'keyword_phrase':
      if (evidence.missing) {
        data.phrase = evidence.missing[0];
        data.phrases = evidence.missing.slice(0, 3);
      }
      break;

    case 'title_alignment':
      if (evidence.targetTitle) {
        data.targetTitle = evidence.targetTitle;
        data.seniority = evidence.targetSeniority || 'mid';
      }
      break;

    case 'metrics_presence':
      data.count = 3; // Suggest adding 3 metrics
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
function rankSuggestions(suggestions: Suggestion[], targetScore: number): Suggestion[] {
  return suggestions.sort((a, b) => {
    // Quick wins first
    if (a.quick_win && !b.quick_win) return -1;
    if (!a.quick_win && b.quick_win) return 1;

    // Then by estimated gain
    return b.estimated_gain - a.estimated_gain;
  });
}
