/**
 * OpenAI Prompt Engineering for Quick Wins Generation
 *
 * This module builds optimized prompts for generating AI-powered
 * resume improvement suggestions with before/after text.
 */

import type { JobExtraction, SubScores, SubScoreKey } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

interface QuickWinsPromptParams {
  resume_text: string;
  resume_json: OptimizedResume;
  job_data: JobExtraction;
  subscores: SubScores;
  current_ats_score: number;
}

interface WeakSpot {
  name: string;
  score: number;
}

/**
 * Build OpenAI prompt for generating quick wins
 */
export function buildQuickWinsPrompt(params: QuickWinsPromptParams): string {
  const { resume_text, job_data, subscores, current_ats_score } = params;

  // Identify weakest subscores
  const weakSpots = identifyWeakSpots(subscores);

  // Extract missing keywords
  const missingKeywords = extractMissingKeywords(job_data, resume_text);

  // Truncate resume text to save tokens
  const truncatedResume = resume_text.slice(0, 2000);
  const resumeSuffix = resume_text.length > 2000 ? '...' : '';

  return `You are an ATS optimization specialist. Identify the 3 highest-impact resume improvements for the target job.

**Current Resume** (the ONLY source of facts about the candidate):
${truncatedResume}${resumeSuffix}

**Target Job**:
- Title: ${job_data.title}
- Job vocabulary: ${job_data.must_have.slice(0, 10).join(', ')}

**Current ATS Score**: ${current_ats_score}/100

**Weak Areas** (prioritize these):
${weakSpots.map(spot => `- ${spot.name}: ${spot.score}/100`).join('\n')}

**Job terms NOT found in the resume (do not claim these)**: ${missingKeywords.slice(0, 15).join(', ')}

**Truth rules** (a rewrite that breaks one is discarded):
1. Every fact in optimized_text must already be in the resume: numbers, counts, scopes, tools, activities, outcomes.
2. The job may lend WORDS for something the bullet already says ("monitor" -> "track"). It may never add a number, a scope, a duty or a result the candidate did not write. Never copy a job duty into a bullet.
3. Keep every number from the original bullet. If the bullet has numbers, build on them (you may compute a rate from two of them, e.g. "38 of 41" -> "93%"). Never replace a real number with a placeholder.
4. Use a bracket placeholder like [X%] only when the bullet has no number at all, and never invent one.
5. Do not inflate numbers ("over 150" when the resume says 150).
6. original_text must be copied exactly from the resume.

**Instructions**:
1. Select 3 specific sentences or bullets from the resume that can be improved.
2. Rewrite each one to improve ATS match while following the truth rules.
3. Prioritize:
   - Moving the candidate's own results and numbers forward
   - Clear action + scope + outcome phrasing, using only what the resume says
   - Job vocabulary for activities the resume already describes
4. Target different resume sections when possible.
5. Keep rationale short and practical.
6. keywords_added lists only terms that actually appear in optimized_text.

**Output Format** (strict JSON):
{
  "quick_wins": [
    {
      "original_text": "exact text from resume",
      "optimized_text": "improved version",
      "improvement_type": "keyword_optimization" | "quantified_achievement" | "action_verb" | "relevance_enhancement",
      "estimated_impact": 5-15,
      "location": {
        "section": "summary" | "experience" | "skills" | "education",
        "subsection": "optional job title or section name"
      },
      "rationale": "brief explanation of improvement",
      "keywords_added": ["keyword1", "keyword2"]
    }
  ]
}

Generate exactly 3 quick wins.
Return ONLY valid JSON (no markdown, no commentary).`;
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
