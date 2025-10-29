/**
 * Suggestion Templates
 *
 * Pre-defined fix templates for each sub-score type
 */

import type { SubScoreKey, SuggestionCategory } from '../types';

export interface SuggestionTemplate {
  /** Template text with placeholders like {keyword}, {count}, etc. */
  text: string;

  /** Estimated score gain if applied */
  estimatedGain: number;

  /** Is this a quick win (high impact, low effort)? */
  quickWin: boolean;

  /** Category for grouping */
  category: SuggestionCategory;

  /** Condition for when to show this suggestion */
  condition?: (evidence: any, score: number) => boolean;
}

/**
 * Templates for each sub-score
 */
export const SUGGESTION_TEMPLATES: Record<SubScoreKey, SuggestionTemplate[]> = {
  keyword_exact: [
    {
      text: "Add exact term '{keyword}' to Skills section and latest role achievements",
      estimatedGain: 8,
      quickWin: true,
      category: 'keywords',
      condition: (evidence) => evidence.missing && evidence.missing.length > 0,
    },
    {
      text: "Include {count} missing must-have keywords: {keywords}",
      estimatedGain: 12,
      quickWin: false,
      category: 'keywords',
      condition: (evidence) => evidence.mustHaveTotal - evidence.mustHaveMatched >= 3,
    },
    {
      text: "Add nice-to-have skills to strengthen match: {keywords}",
      estimatedGain: 5,
      quickWin: true,
      category: 'keywords',
    },
  ],

  keyword_phrase: [
    {
      text: "Mirror JD phrase '{phrase}' in your experience bullets",
      estimatedGain: 6,
      quickWin: true,
      category: 'content',
    },
    {
      text: "Use exact phrases from job responsibilities: {phrases}",
      estimatedGain: 8,
      quickWin: false,
      category: 'content',
    },
  ],

  semantic_relevance: [
    {
      text: "Expand summary to better describe relevant experience",
      estimatedGain: 7,
      quickWin: false,
      category: 'content',
    },
    {
      text: "Add context to achievements showing how skills were applied",
      estimatedGain: 6,
      quickWin: false,
      category: 'content',
    },
  ],

  title_alignment: [
    {
      text: "Include '{targetTitle}' in your professional summary or headline",
      estimatedGain: 8,
      quickWin: true,
      category: 'content',
    },
    {
      text: "Adjust latest role title to match seniority level ({seniority})",
      estimatedGain: 5,
      quickWin: false,
      category: 'content',
    },
  ],

  metrics_presence: [
    {
      text: "Quantify {count} achievements with percentages, dollar amounts, or numbers",
      estimatedGain: 10,
      quickWin: false,
      category: 'metrics',
    },
    {
      text: "Add metrics to latest role (e.g., '% improvement', '$ saved', '# users')",
      estimatedGain: 7,
      quickWin: true,
      category: 'metrics',
    },
    {
      text: "Include timeframes showing speed of delivery (e.g., 'in 3 months')",
      estimatedGain: 4,
      quickWin: true,
      category: 'metrics',
    },
  ],

  section_completeness: [
    {
      text: "Add missing section: {section}",
      estimatedGain: 12,
      quickWin: false,
      category: 'structure',
    },
    {
      text: "Expand professional summary to 50-150 words",
      estimatedGain: 5,
      quickWin: true,
      category: 'structure',
    },
    {
      text: "Ensure all experience roles have achievement bullets",
      estimatedGain: 6,
      quickWin: false,
      category: 'structure',
    },
  ],

  format_parseability: [
    {
      text: "Switch to ATS-safe template (single column, no graphics)",
      estimatedGain: 15,
      quickWin: true,
      category: 'formatting',
      condition: (_, score) => score < 50,
    },
    {
      text: "Remove tables and use simple text formatting instead",
      estimatedGain: 12,
      quickWin: false,
      category: 'formatting',
    },
    {
      text: "Remove images, logos, and graphics - ATS cannot read them",
      estimatedGain: 8,
      quickWin: true,
      category: 'formatting',
    },
    {
      text: "Convert multi-column layout to single column",
      estimatedGain: 10,
      quickWin: false,
      category: 'formatting',
    },
  ],

  recency_fit: [
    {
      text: "Move recent relevant projects to latest role",
      estimatedGain: 6,
      quickWin: true,
      category: 'content',
    },
    {
      text: "Highlight continuous skill development in recent roles",
      estimatedGain: 5,
      quickWin: false,
      category: 'content',
    },
    {
      text: "Add recent certifications or training to show current expertise",
      estimatedGain: 4,
      quickWin: true,
      category: 'content',
    },
  ],
};

/**
 * Get templates for a specific sub-score
 */
export function getTemplatesForSubScore(subScore: SubScoreKey): SuggestionTemplate[] {
  return SUGGESTION_TEMPLATES[subScore] || [];
}

/**
 * Fill template with actual data
 */
export function fillTemplate(
  template: SuggestionTemplate,
  data: Record<string, any>
): string {
  let text = template.text;

  // Replace placeholders
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    if (text.includes(placeholder)) {
      // Format value based on type
      let formattedValue = value;
      if (Array.isArray(value)) {
        formattedValue = value.slice(0, 3).join(', ');
        if (value.length > 3) {
          formattedValue += `, and ${value.length - 3} more`;
        }
      }
      text = text.replace(placeholder, String(formattedValue));
    }
  }

  return text;
}
