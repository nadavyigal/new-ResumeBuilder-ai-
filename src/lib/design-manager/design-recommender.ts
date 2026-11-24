/**
 * Design Recommender Module
 * AI-powered template recommendation based on resume content and job description
 *
 * Reference: specs/003-i-want-to/research.md
 * Task: T019
 */

import OpenAI from 'openai';
import { adaptChatParams, logModelUsage, readUsage, selectModel, warnIfTruncated } from '@/lib/model-tiers';
import { DATA_NOTICE, resolveOutputLanguage, wrap } from '@/lib/prompts/shared';

const VALID_TEMPLATES = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'] as const;

/**
 * Structured output schema. The model used to return free text that was
 * JSON.parse'd; a schema makes the shape a guarantee instead of a hope.
 */
const RECOMMENDATION_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'template_recommendation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['templateId', 'reasoning', 'confidence'],
      properties: {
        templateId: { type: 'string', enum: [...VALID_TEMPLATES] },
        reasoning: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
};

/** FAST tier. gpt-4 was shut down on 2026-10-23, so the default is the new model. */
export function resolveRecommenderModel() {
  return selectModel('FAST', 'gpt-6-luna');
}

// Lazy initialization to avoid build-time errors
let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiInstance;
}

/**
 * The template numbers are internal readability estimates for ranking only
 * (founder decision 2026-11-23 keeps them); users read `reasoning`, so it must
 * never print a score or number (2026-11-24).
 */
export const DESIGN_SYSTEM_PROMPT = `# Role
You are a resume design consultant. Recommend the one template that fits the candidate's background and target role best.

${DATA_NOTICE}

# Templates (the number is an internal rough readability estimate, for your ranking only)
1. minimal-ssr: clean, text-focused, single column. Best for technical roles, academia, or conservative industries (law, finance). Readability estimate 98.
2. card-ssr: modern card-based layout with visual sections. Best for creative professionals, marketing, UX/UI roles. Readability estimate 92.
3. sidebar-ssr: sidebar layout with contact info set apart. Best for managers, consultants, executives. Readability estimate 94.
4. timeline-ssr: timeline layout that shows career progression. Best for roles that value an experience trajectory (PM, sales, leadership). Readability estimate 90.

# reasoning (the candidate reads this)
- 2 or 3 sentences on why this layout suits their background and the role.
- Do not print any score, percentage or other number, and do not repeat the readability estimates.
- Do not say a layout will beat, pass or get past applicant tracking systems; you may say it is easy for recruiters and screening software to read.
- Do not promise outcomes.

# Output
One JSON object: { "templateId": "minimal-ssr" | "card-ssr" | "sidebar-ssr" | "timeline-ssr", "reasoning": string, "confidence": number from 0 to 1 }`;

/**
 * Safety net for the rule above: drop any sentence of user-facing reasoning that
 * contains a digit (a score, a percentage). If nothing is left, use a neutral line.
 */
export function stripNumbersFromReasoning(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
  const kept = sentences.filter((sentence) => !/\d/.test(sentence));
  if (kept.length > 0) return kept.join(' ').trim();
  return /[\u0590-\u05FF]/.test(text)
    ? 'התבנית הזו מתאימה לרקע שלך ולתפקיד.'
    : 'This layout fits your background and the role.';
}

export interface RecommendationResult {
  templateId: string;
  reasoning: string;
  confidence: number;
}

/**
 * Recommends a design template based on resume and job description analysis
 * @param resumeData - Parsed resume content
 * @param jobDescription - Job description text
 * @returns Template recommendation with reasoning
 */
export async function recommendTemplate(
  resumeData: any,
  jobDescription: string
): Promise<RecommendationResult> {
  try {
    const prompt = buildRecommendationPrompt(resumeData, jobDescription);

    const selection = resolveRecommenderModel();
    const startedAt = Date.now();
    const completion = await getOpenAI().chat.completions.create(adaptChatParams(selection, {
      messages: [
        {
          role: 'system',
          content: DESIGN_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: RECOMMENDATION_SCHEMA,
    }));
    logModelUsage('design.recommendTemplate', selection, readUsage(completion.usage), Date.now() - startedAt, completion.choices[0]?.finish_reason);
    warnIfTruncated('design.recommendTemplate', completion);

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Structured output: the content is JSON matching RECOMMENDATION_SCHEMA
    const result = JSON.parse(responseText);

    // Validate response structure
    if (!result.templateId || !result.reasoning || typeof result.confidence !== 'number') {
      throw new Error('Invalid response format from OpenAI');
    }

    // Validate template ID
    if (!(VALID_TEMPLATES as readonly string[]).includes(result.templateId)) {
      // Fallback to minimal if invalid template returned
      return {
        templateId: 'minimal-ssr',
        reasoning: 'Defaulting to the minimal template: a clean single-column layout that recruiters and screening software read easily.',
        confidence: 0.7
      };
    }

    return {
      templateId: result.templateId,
      reasoning: stripNumbersFromReasoning(String(result.reasoning)),
      confidence: Math.min(1.0, Math.max(0.0, result.confidence))
    };
  } catch (error) {
    console.error('Error in template recommendation:', error);

    // Return safe default on error
    return {
      templateId: 'minimal-ssr',
      reasoning: 'Recommending the minimal template: a clean single-column layout that recruiters and screening software read easily.',
      confidence: 0.6
    };
  }
}

/**
 * Builds the recommendation prompt from resume and job description
 */
function buildRecommendationPrompt(resumeData: any, jobDescription: string): string {
  const data = resumeData.content || resumeData;

  const experience = data.experience || [];
  // OptimizedResume keeps skills as { technical, soft }; older rows used a flat list.
  // `.slice` on the object threw, so every call fell back to the default template.
  const rawSkills = data.skills || [];
  const skills: string[] = Array.isArray(rawSkills)
    ? rawSkills
    : [...(rawSkills.technical || []), ...(rawSkills.soft || [])];
  const summary = data.summary || '';
  const outputLanguage = resolveOutputLanguage(`${summary} ${skills.join(' ')}`, jobDescription);

  const experienceYears = calculateExperienceYears(experience);
  const industryKeywords = extractIndustryKeywords(jobDescription);

  return [
    `Write "reasoning" in ${outputLanguage === 'he' ? 'Hebrew' : 'English'}. JSON keys and template ids stay in English.`,
    wrap(
      'resume_summary',
      [
        `Years of experience: ${experienceYears}`,
        `Key skills: ${skills.slice(0, 10).join(', ')}`,
        `Professional summary: ${summary.substring(0, 200)}`,
        `Number of positions: ${experience.length}`,
        `Industry indicators from the posting: ${industryKeywords.join(', ')}`,
      ].join('\n')
    ),
    wrap('job_posting', jobDescription.substring(0, 500)),
    'Recommend the template, weighing industry norms (conservative or creative), career level, role type (technical, managerial or creative) and readability. Return only the JSON object.',
  ].join('\n\n');
}

/**
 * Calculates total years of experience from work history
 */
function calculateExperienceYears(experience: any[]): number {
  if (!experience || experience.length === 0) return 0;

  let totalMonths = 0;

  for (const exp of experience) {
    const startDate = new Date(exp.startDate || '2020-01-01');
    const endDate = exp.endDate && exp.endDate !== 'Present' ? new Date(exp.endDate) : new Date();

    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

/**
 * Extracts industry keywords from job description
 */
function extractIndustryKeywords(jobDescription: string): string[] {
  const keywords: string[] = [];

  const industryPatterns = {
    technical: /software|engineer|developer|programming|technical|code/i,
    creative: /design|creative|marketing|brand|visual|ux|ui/i,
    business: /business|management|consulting|strategy|operations/i,
    finance: /finance|accounting|banking|investment|financial/i,
    sales: /sales|account|revenue|business development/i
  };

  for (const [industry, pattern] of Object.entries(industryPatterns)) {
    if (pattern.test(jobDescription)) {
      keywords.push(industry);
    }
  }

  return keywords;
}
