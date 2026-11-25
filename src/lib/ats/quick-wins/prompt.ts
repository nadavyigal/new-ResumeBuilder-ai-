/**
 * OpenAI Prompt Engineering for Quick Wins Generation
 *
 * This module builds optimized prompts for generating AI-powered
 * resume improvement suggestions with before/after text.
 */

import type { JobExtraction, SubScores, SubScoreKey } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { SUB_SCORE_WEIGHTS } from '../config/weights';
import { CONTENT_RULES, DATA_NOTICE, languageRules, resolveOutputLanguage, wrap } from '@/lib/prompts/shared';

interface QuickWinsPromptParams {
  resume_text: string;
  resume_json: OptimizedResume;
  job_data: JobExtraction;
  subscores: SubScores;
  current_ats_score: number;
  /** Raw job posting, when the caller has it; used only to pick the output language. */
  job_text?: string;
}

interface WeakSpot {
  name: string;
  score: number;
}

/**
 * Static system prompt: identical for every call, rules first. All variable
 * data goes in the user message (buildQuickWinsPrompt), inside data tags.
 * estimated_impact stays model-filled and is shown labelled as an estimate
 * (founder decisions 2 and 3, 2026-11-23).
 */
export const QUICK_WINS_SYSTEM_PROMPT = `# Role
You find up to 3 sentences in a candidate's resume that can be rewritten to fit a job posting better, using only what the resume already says.

${DATA_NOTICE}

# Rules (a rewrite that breaks one is discarded automatically)
1. original_text is copied character for character from <original_resume>, in its original language.
2. Every fact in optimized_text is already in the resume: numbers, counts, scope, tools, activities, outcomes.
3. Do not add any duty, skill, scope, audience or result from the posting that the resume does not state. Swapping one action verb for another is fine ("monitor" to "track"). Never append a job duty to a bullet.
4. Keep the candidate's level of contribution. If the original says they helped, assisted, supported or took part ("עזרתי", "השתתפתי"), the rewrite says so too. Never turn shared work into sole ownership ("helped document" must not become "documented").
5. Keep every number from the original sentence. You may derive a rate from two of its numbers ("38 of 41" becomes "93%"). Never replace a real number with a placeholder. Do not inflate ("over 150" when the resume says 150).
6. If the sentence has no number at all, you may add one bracket placeholder such as [X%] for the candidate to fill in. Never invent the number.
7. keywords_added lists only terms that appear in both optimized_text and the resume.

# Priorities
Bring the candidate's own results and numbers forward, use posting terms the resume already contains, use clear action, scope and outcome wording, and pick different sections where possible.

${CONTENT_RULES}

# Output
One JSON object: { "quick_wins": [ { "original_text": string, "optimized_text": string, "improvement_type": "keyword_optimization" | "quantified_achievement" | "action_verb" | "relevance_enhancement", "estimated_impact": integer from 5 to 15, your rough estimate of the points this one change could add, "location": { "section": "summary" | "experience" | "skills" | "education", "subsection": string }, "rationale": one short sentence, "keywords_added": [string] } ] }
Return up to 3 wins. Return fewer if fewer sentences can be honestly improved.`;

/** Longest resume text sent to the model; the free check is a public endpoint. */
export const QUICK_WINS_RESUME_CHAR_LIMIT = 12000;

/**
 * Build the user message for generating quick wins: language rules, then the
 * variable data, resume last.
 */
export function buildQuickWinsPrompt(params: QuickWinsPromptParams): string {
  const { resume_text, job_data, subscores, current_ats_score } = params;

  const weakSpots = identifyWeakSpots(subscores);
  const missingKeywords = extractMissingKeywords(job_data, resume_text);
  const resumeLower = resume_text.toLowerCase();
  const presentKeywords = job_data.must_have.filter(skill => resumeLower.includes(skill.toLowerCase()));
  const outputLanguage = resolveOutputLanguage(
    resume_text,
    params.job_text ?? [job_data.title, ...(job_data.must_have || [])].join(' ')
  );

  return [
    languageRules(outputLanguage),
    'optimized_text and rationale follow the language above; original_text stays exactly as the resume writes it.',
    wrap('job_title', job_data.title),
    `<current_match_score_estimate>${Math.round(current_ats_score)}/100 (estimate)</current_match_score_estimate>`,
    wrap('posting_terms_in_resume', presentKeywords.slice(0, 10).join(', ') || 'none'),
    wrap('posting_terms_not_in_resume', `${missingKeywords.slice(0, 15).join(', ') || 'none'} (do not claim these)`),
    wrap('weak_areas', weakSpots.map(spot => `${spot.name}: ${spot.score}/100`).join('\n') || 'none'),
    wrap('original_resume', resume_text.slice(0, QUICK_WINS_RESUME_CHAR_LIMIT)),
    'Return only the JSON object.',
  ].join('\n\n');
}

/**
 * Identify the 3 weakest sub-scores to prioritize in prompt
 */
function identifyWeakSpots(subscores: SubScores): WeakSpot[] {
  const entries = Object.entries(subscores) as Array<[SubScoreKey, number]>;

  return entries
    // Skip components that carry no weight — they are structurally low, so
    // they would crowd out the fixable dimensions and steer the model at
    // advice that cannot move the score (WP-45 D1).
    .filter(([key]) => SUB_SCORE_WEIGHTS[key] > 0)
    .filter(([, score]) => score < 70) // Only include weak scores
    .sort((a, b) => a[1] - b[1]) // Sort ascending (worst first)
    .slice(0, 3) // Top 3 weakest
    .map(([name, score]) => ({
      name: name.replace(/_/g, ' '), // Convert snake_case to readable
      score: Math.round(score)
    }));
}

/**
 * Extract missing must-have keywords to guide improvements
 */
function extractMissingKeywords(job_data: JobExtraction, resume_text: string): string[] {
  const resumeLower = resume_text.toLowerCase();

  const missingSkills = job_data.must_have
    .filter(skill => !resumeLower.includes(skill.toLowerCase()))
    .slice(0, 10); // Limit to 10 to save tokens

  return missingSkills;
}
