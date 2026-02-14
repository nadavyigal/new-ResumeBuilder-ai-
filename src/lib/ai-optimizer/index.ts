import OpenAI from 'openai';
import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_USER_PROMPT,
  OPTIMIZATION_CONFIG,
} from '../prompts/resume-optimizer';

/**
 * Optimized resume structure returned by AI
 */
export interface OptimizedResume {
  summary: string;
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    title?: string;
    company?: string;
    linkedin?: string;
    portfolio?: string;
  };
  skills: {
    technical: string[];
    soft: string[];
  };
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    achievements: string[];
    responsibilities?: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    graduationDate: string;
    gpa?: string;
  }>;
  certifications?: string[];
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
  matchScore: number;
  keyImprovements: string[];
  missingKeywords: string[];
}

/**
 * Result of the optimization process
 */
export interface OptimizationResult {
  success: boolean;
  optimizedResume?: OptimizedResume;
  error?: string;
  tokensUsed?: number;
}

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({ apiKey });
}

/**
 * Optimize a resume against a job description using OpenAI
 */
export async function optimizeResume(
  resumeText: string,
  jobDescription: string
): Promise<OptimizationResult> {
  try {
    const openai = getOpenAIClient();

    // Detect if resume or job description is in Hebrew.
    const hebrewPattern = /[\u0590-\u05FF]/;
    const isHebrew = hebrewPattern.test(resumeText) || hebrewPattern.test(jobDescription);

    const languageInstruction = isHebrew
      ? `\n\nHEBREW OUTPUT REQUIREMENT:
- Write all resume content values in Hebrew.
- Keep JSON field names in English exactly as required by the schema.
- Preserve natural right-to-left Hebrew phrasing.
- Keep proper nouns (company names, product names, tools) in their original form when needed.
- Use truthful, professional Hebrew and avoid unnecessary English text.`
      : '';

    console.log('Language Detection:', {
      isHebrew,
      resumeHasHebrew: hebrewPattern.test(resumeText),
      jobHasHebrew: hebrewPattern.test(jobDescription),
      resumePreview: resumeText.substring(0, 100),
      jobPreview: jobDescription.substring(0, 100),
    });

    const completion = await openai.chat.completions.create({
      model: OPTIMIZATION_CONFIG.model,
      temperature: OPTIMIZATION_CONFIG.temperature,
      max_tokens: OPTIMIZATION_CONFIG.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: RESUME_OPTIMIZATION_SYSTEM_PROMPT + languageInstruction,
        },
        {
          role: 'user',
          content: RESUME_OPTIMIZATION_USER_PROMPT(resumeText, jobDescription),
        },
      ],
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      return {
        success: false,
        error: 'No response from OpenAI',
      };
    }

    const optimizedResume = JSON.parse(responseContent) as OptimizedResume;

    return {
      success: true,
      optimizedResume,
      tokensUsed: completion.usage?.total_tokens,
    };
  } catch (error: unknown) {
    console.error('Error optimizing resume:', error);
    const err = error as { code?: string; message?: string; status?: number };

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        success: false,
        error: 'Optimization timeout - please try again',
      };
    }

    if (err.status === 401) {
      return {
        success: false,
        error: 'Invalid OpenAI API key',
      };
    }

    if (err.status === 429) {
      return {
        success: false,
        error: 'OpenAI rate limit exceeded - please try again later',
      };
    }

    return {
      success: false,
      error: err.message || 'Failed to optimize resume',
    };
  }
}

/**
 * Calculate ATS match score between resume and job description.
 * This is a simple keyword-based fallback.
 */
export function calculateMatchScore(
  resumeText: string,
  jobDescription: string
): number {
  const jdWords = jobDescription
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);

  const resumeLower = resumeText.toLowerCase();
  const matchedKeywords = jdWords.filter(word => resumeLower.includes(word));

  const uniqueJdWords = [...new Set(jdWords)];
  const uniqueMatches = [...new Set(matchedKeywords)];

  return Math.round((uniqueMatches.length / uniqueJdWords.length) * 100);
}

/**
 * Extract keywords from job description.
 */
export function extractKeywords(jobDescription: string): string[] {
  const keywords: string[] = [];

  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const capitalized = jobDescription.match(capitalizedPattern) || [];

  const acronymPattern = /\b[A-Z]{2,}\b/g;
  const acronyms = jobDescription.match(acronymPattern) || [];

  keywords.push(...capitalized, ...acronyms);

  return [...new Set(keywords)].slice(0, 50);
}
