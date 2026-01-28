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

  return `You are an expert ATS (Applicant Tracking System) optimization specialist. Your task is to identify the TOP 3 most impactful improvements to this resume for the target job.

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
1. Identify 3 specific sentences/bullet points in the resume that can be improved
2. Rewrite each to maximize ATS score by:
   - Adding relevant keywords from the job description naturally
   - Quantifying achievements with metrics (%, $, #, timeframes)
   - Using strong action verbs (led, optimized, increased, delivered)
   - Aligning with job requirements while staying truthful
3. Each improvement should target a different resume section when possible
4. Focus on high-impact changes (5+ point score improvement each)

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

**Example**:
{
  "quick_wins": [
    {
      "original_text": "Managed team projects and delivered results",
      "optimized_text": "Led cross-functional team of 8 engineers to deliver 3 major product releases, increasing user engagement by 45% and reducing deployment time by 30%",
      "improvement_type": "quantified_achievement",
      "estimated_impact": 12,
      "location": {
        "section": "experience",
        "subsection": "Senior Software Engineer at Tech Corp"
      },
      "rationale": "Added specific metrics (team size, deliverables, impact percentages) and action verb 'Led' to demonstrate quantifiable leadership impact",
      "keywords_added": ["cross-functional", "product releases", "user engagement"]
    }
  ]
}

Generate exactly 3 quick wins. Return ONLY valid JSON.`;
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
