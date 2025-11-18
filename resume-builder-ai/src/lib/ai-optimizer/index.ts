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
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
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

    // Detect if resume is in Hebrew
    const hebrewPattern = /[\u0590-\u05FF]/;
    const isHebrew = hebrewPattern.test(resumeText) || hebrewPattern.test(jobDescription);

    // Language instruction
    const languageInstruction = isHebrew
      ? `\n\n🔴 CRITICAL LANGUAGE REQUIREMENT - HEBREW (עברית) 🔴

YOU MUST WRITE THE ENTIRE OPTIMIZED RESUME IN HEBREW LANGUAGE WITH RIGHT-TO-LEFT (RTL) TEXT DIRECTION.

MANDATORY RULES:
1. ALL text content MUST be in Hebrew (עברית) - summary, skills, achievements, job titles, descriptions, etc.
2. Use ONLY Hebrew characters: א-ת, no English letters in Hebrew text
3. Text direction: RIGHT-TO-LEFT (RTL) - Hebrew reads from right to left: ←
4. Numbers: Use Western numerals (2024, 5, etc.) but maintain RTL flow
5. Keep proper nouns in their original form (company names, software tools like "Excel", "Python")
6. Dates: Use Hebrew month names or format: "ינואר 2024" or "2024-01"
7. JSON structure: Field names stay in English ("summary", "skills"), but ALL VALUES in Hebrew

TEXT DIRECTION EXAMPLES:
✅ CORRECT RTL: "מנהל פיתוח עסקי בכיר עם 10+ שנות ניסיון בניהול צוותים"
❌ WRONG LTR: "Manager Development Business senior with experience years 10+"

CONTENT EXAMPLES:
✅ CORRECT: "summary": "מנהל פיתוח עסקי מנוסה עם רקע חזק בניהול קשרי לקוחות ופיתוח אסטרטגיות עסקיות"
✅ CORRECT: "title": "מנהל פיתוח עסקי"
✅ CORRECT: "achievements": ["ניהול תיק לקוחות בהיקף של 5 מיליון שקל בשנה"]
❌ WRONG: "summary": "Experienced Business Development Manager..."
❌ WRONG: "title": "Business Development Manager"

REMEMBER: Hebrew is written RIGHT-TO-LEFT (←). The optimized resume must read naturally in Hebrew RTL direction.

DO NOT TRANSLATE TO ENGLISH. DO NOT USE ENGLISH TEXT WHERE HEBREW IS REQUIRED.`
      : '';

    console.log('🌍 Language Detection:', {
      isHebrew,
      resumeHasHebrew: hebrewPattern.test(resumeText),
      jobHasHebrew: hebrewPattern.test(jobDescription),
      resumePreview: resumeText.substring(0, 100),
      jobPreview: jobDescription.substring(0, 100)
    });

    // Create the chat completion request
    const completion = await openai.chat.completions.create({
      model: OPTIMIZATION_CONFIG.model,
      temperature: OPTIMIZATION_CONFIG.temperature,
      max_tokens: OPTIMIZATION_CONFIG.maxTokens,
      response_format: { type: 'json_object' }, // Ensure JSON response
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

    // Parse the JSON response
    const optimizedResume = JSON.parse(responseContent) as OptimizedResume;

    return {
      success: true,
      optimizedResume,
      tokensUsed: completion.usage?.total_tokens,
    };
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
