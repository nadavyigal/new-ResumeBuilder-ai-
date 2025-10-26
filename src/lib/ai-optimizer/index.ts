import OpenAI from 'openai';
import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_USER_PROMPT,
  OPTIMIZATION_CONFIG,
} from '../prompts/resume-optimizer';
import { OPENAI_API_KEY } from '@/lib/env';
import { OptimizedResumeSchema } from '@/lib/validation/schemas';

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
 * Uses centralized environment validation from @/lib/env
 */
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

/**
 * Optimize a resume against a job description using OpenAI
 *
 * @param resumeText - Raw text extracted from the resume
 * @param jobDescription - Job description text
 * @returns Optimization result with structured resume data
 */
export async function optimizeResume(
  resumeText: string,
  jobDescription: string
): Promise<OptimizationResult> {
  try {
    const openai = getOpenAIClient();

    // Create the chat completion request
    const completion = await openai.chat.completions.create({
      model: OPTIMIZATION_CONFIG.model,
      temperature: OPTIMIZATION_CONFIG.temperature,
      max_tokens: OPTIMIZATION_CONFIG.maxTokens,
      response_format: { type: 'json_object' }, // Ensure JSON response
      messages: [
        {
          role: 'system',
          content: RESUME_OPTIMIZATION_SYSTEM_PROMPT,
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

    // Parse, normalize, and validate the JSON response using Zod
    try {
      const raw = JSON.parse(responseContent);

      // Normalize common variations to increase robustness
      const normalized: any = { ...raw };

      // Rename alternative keys if present
      if (normalized.improvements && !normalized.keyImprovements) {
        normalized.keyImprovements = normalized.improvements;
      }
      if (normalized.keywords && !normalized.missingKeywords) {
        normalized.missingKeywords = normalized.keywords;
      }

      // Ensure nested structures exist
      normalized.contact = normalized.contact || {
        name: '',
        email: '',
        phone: '',
        location: '',
      };
      normalized.skills = normalized.skills || { technical: [], soft: [] };
      normalized.skills.technical = normalized.skills.technical || [];
      normalized.skills.soft = normalized.skills.soft || [];
      normalized.experience = normalized.experience || [];
      normalized.education = normalized.education || [];
      normalized.projects = normalized.projects || [];
      normalized.certifications = normalized.certifications || [];

      // Coerce matchScore from string like "85%" to number 0-100
      if (typeof normalized.matchScore === 'string') {
        const cleaned = normalized.matchScore.replace(/%/g, '').trim();
        const parsed = parseFloat(cleaned);
        if (Number.isFinite(parsed)) normalized.matchScore = parsed;
      }

      const parsed = OptimizedResumeSchema.parse(normalized);

      return {
        success: true,
        optimizedResume: parsed,
        tokensUsed: completion.usage?.total_tokens,
      };
    } catch (validationError) {
      console.error('AI returned invalid resume structure:', validationError);
      return {
        success: false,
        error: 'AI returned invalid resume format. Please try again.',
      };
    }
  } catch (error: unknown) {
    console.error('Error optimizing resume:', error);
    const err = error as { code?: string; message?: string; status?: number };

    // Handle specific error types
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
 * Calculate ATS match score between resume and job description
 * This is a simpler keyword-based approach as a fallback
 *
 * @param resumeText - Resume text
 * @param jobDescription - Job description text
 * @returns Match score from 0-100
 */
export function calculateMatchScore(
  resumeText: string,
  jobDescription: string
): number {
  // Extract keywords from job description (simple approach)
  const jdWords = jobDescription
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3); // Filter short words

  // Count how many JD keywords appear in resume
  const resumeLower = resumeText.toLowerCase();
  const matchedKeywords = jdWords.filter(word => resumeLower.includes(word));

  // Calculate percentage
  const uniqueJdWords = [...new Set(jdWords)];
  const uniqueMatches = [...new Set(matchedKeywords)];

  return Math.round((uniqueMatches.length / uniqueJdWords.length) * 100);
}

/**
 * Extract keywords from job description
 *
 * @param jobDescription - Job description text
 * @returns Array of important keywords
 */
export function extractKeywords(jobDescription: string): string[] {
  // Common technical and professional keywords patterns
  const keywords: string[] = [];

  // Extract capitalized terms (likely proper nouns, technologies)
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const capitalized = jobDescription.match(capitalizedPattern) || [];

  // Extract acronyms and technical terms
  const acronymPattern = /\b[A-Z]{2,}\b/g;
  const acronyms = jobDescription.match(acronymPattern) || [];

  // Combine and deduplicate
  keywords.push(...capitalized, ...acronyms);

  return [...new Set(keywords)].slice(0, 50); // Limit to top 50
}
