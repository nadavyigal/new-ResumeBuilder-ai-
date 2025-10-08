/**
 * Design Recommender Module
 * AI-powered template recommendation based on resume content and job description
 *
 * Reference: specs/003-i-want-to/research.md
 * Task: T019
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional resume design consultant. Your job is to recommend the most appropriate resume template based on the candidate's background and target role.

Available templates:
1. minimal-ssr: Clean, text-focused layout. Best for technical roles, academia, or conservative industries (law, finance). ATS score: 98
2. card-ssr: Modern card-based layout with visual sections. Best for creative professionals, marketing, UX/UI roles. ATS score: 92
3. sidebar-ssr: Professional sidebar layout with contact info separation. Best for managers, consultants, executives. ATS score: 94
4. timeline-ssr: Timeline-based layout emphasizing career progression. Best for roles valuing experience trajectory (PM, sales, leadership). ATS score: 90

Respond in JSON format:
{
  "templateId": "template-slug",
  "reasoning": "2-3 sentence explanation",
  "confidence": 0.85
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response
    const result = JSON.parse(responseText);

    // Validate response structure
    if (!result.templateId || !result.reasoning || typeof result.confidence !== 'number') {
      throw new Error('Invalid response format from OpenAI');
    }

    // Validate template ID
    const validTemplates = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];
    if (!validTemplates.includes(result.templateId)) {
      // Fallback to minimal if invalid template returned
      return {
        templateId: 'minimal-ssr',
        reasoning: 'Defaulting to minimal template for maximum ATS compatibility.',
        confidence: 0.7
      };
    }

    return {
      templateId: result.templateId,
      reasoning: result.reasoning,
      confidence: Math.min(1.0, Math.max(0.0, result.confidence))
    };
  } catch (error) {
    console.error('Error in template recommendation:', error);

    // Return safe default on error
    return {
      templateId: 'minimal-ssr',
      reasoning: 'Recommending minimal template as a safe default for ATS compatibility.',
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
  const skills = data.skills || [];
  const summary = data.summary || '';

  const experienceYears = calculateExperienceYears(experience);
  const industryKeywords = extractIndustryKeywords(jobDescription);

  return `Analyze this resume and job description to recommend the best template.

RESUME SUMMARY:
- Years of experience: ${experienceYears}
- Key skills: ${skills.slice(0, 10).join(', ')}
- Professional summary: ${summary.substring(0, 200)}
- Number of positions: ${experience.length}

JOB DESCRIPTION:
${jobDescription.substring(0, 500)}

INDUSTRY INDICATORS:
${industryKeywords.join(', ')}

Recommend the most appropriate template considering:
1. Industry norms (conservative vs. creative)
2. Career level (entry vs. senior)
3. Role type (technical vs. managerial vs. creative)
4. ATS compatibility requirements`;
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
