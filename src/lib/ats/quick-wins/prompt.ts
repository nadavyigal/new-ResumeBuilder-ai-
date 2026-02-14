/**
 * OpenAI Prompt Engineering for Quick Wins Generation
 *
 * This module builds optimized prompts for generating AI-powered
 * resume improvement suggestions with before/after text.
 */

import type { JobExtraction, SubScores, SubScoreKey } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';

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

**Current Resume**:
${truncatedResume}${resumeSuffix}

**Target Job**:
- Title: ${job_data.title}
- Must-have skills: ${job_data.must_have.slice(0, 10).join(', ')}
- Key responsibilities: ${job_data.responsibilities.slice(0, 3).join('; ')}

**Current ATS Score**: ${current_ats_score}/100

**Weak Areas** (prioritize these):
${weakSpots.map(spot => `- ${spot.name}: ${spot.score}/100`).join('\n')}

**Missing Keywords**: ${missingKeywords.slice(0, 15).join(', ')}

**Instructions**:
1. Select 3 specific sentences or bullets from the resume that can be improved.
2. Rewrite each one to improve ATS match while staying truthful.
3. Prioritize:
   - Relevant keywords from the job description
   - Clear action + scope + outcome phrasing
   - Quantification when it is supported by the source text
4. If exact metrics are missing, use bracket placeholders like [X%], [N users], or [timeframe] instead of fabricating numbers.
5. Target different resume sections when possible.
6. Keep rationale short and practical.

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
