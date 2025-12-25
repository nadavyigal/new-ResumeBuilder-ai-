/**
 * Amendment Generator
 *
 * Parses ATS suggestions and generates structured amendments
 * with specific before/after values for resume sections.
 */

import OpenAI from 'openai';
import type { Suggestion } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { AffectedField } from '@/types/chat';

// Lazy initialization to prevent build-time errors
let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

/**
 * Amendment generation result
 */
export interface AmendmentGenerationResult {
  affectedFields: AffectedField[];
  success: boolean;
  error?: string;
}

/**
 * Generate amendments from an ATS suggestion
 *
 * Uses AI to analyze the suggestion text and map it to specific
 * resume sections with before/after values.
 */
export async function generateAmendments(
  suggestion: Suggestion,
  resumeContent: OptimizedResume
): Promise<AmendmentGenerationResult> {
  try {
    console.log(`📝 Generating amendments for suggestion: ${suggestion.id}`);

    const systemPrompt = `You are an expert resume editor. Your task is to analyze an ATS improvement suggestion and determine which specific resume sections need to be changed.

IMPORTANT: You must return a JSON object with an "affectedFields" array containing the changes:
{
  "affectedFields": [
    {
      "sectionId": "summary" | "experience-0" | "experience-1" | "skills" | "education-0" | etc.,
      "field": "text" | "achievements" | "technical" | "soft" | etc.,  // REQUIRED - NEVER leave this undefined!
      "originalValue": <current value as string or array>,
      "newValue": <proposed value as string or array>,
      "changeType": "add" | "modify" | "remove",
      "reason": "Brief explanation of why this change helps ATS scoring"
    }
  ]
}

Section ID Format:
- summary: Main summary section
- experience-N: Experience item (N is 0-indexed)
- skills: Skills section
- education-N: Education item (N is 0-indexed)
- certifications: Certifications section
- projects-N: Project item (N is 0-indexed)

Field Names:
- summary section: "text"
- experience items: "title", "company", "location", "achievements" (array)
- skills: "technical" (array), "soft" (array)
- education: "degree", "institution"
- certifications: "items" (array)
- projects: "name", "description", "technologies" (array)

CRITICAL Guidelines for Keyword/Skill Additions:

1. **Professional Skill Formatting**: When adding technical skills, use FULL PROFESSIONAL NAMES, not abbreviations:
   - ❌ BAD: "api", "ml", "ai", "cloud"
   - ✅ GOOD: "API Design", "REST API Development", "Machine Learning", "ML Model Development", "Cloud Architecture"

2. **Filter Job Description Noise**: NEVER add these as skills (they're job posting metadata, not skills):
   - ❌ Ignore: "job", "title", "posted", "company", "about", "see", "this", "senior", "manager", "description", "position", "role"
   - ✅ Focus on: actual technologies, tools, methodologies, and competencies

3. **Context Intelligence**: When a suggestion says "add X", interpret it professionally:
   - "add api" → Add ["API Design", "REST API Development", "API Integration"]
   - "add payment" → Add ["Payment Processing", "Payment Gateway Integration"]
   - "add cloud" → Add ["Cloud Architecture", "Cloud Computing", "AWS"]
   - "add security" → Add ["Security Engineering", "Information Security"]

4. **Technical vs Soft Skills**: Auto-categorize intelligently:
   - Technical: programming languages, frameworks, tools, platforms, methodologies
   - Soft: leadership, communication, teamwork, problem-solving

5. **Keyword Expansion Map**: Apply these professional expansions:
   - fintech → "FinTech Solutions", "Financial Technology"
   - blockchain → "Blockchain Development", "Distributed Ledger Technology"
   - devops → "DevOps Engineering", "CI/CD Pipeline Management"
   - frontend → "Frontend Development", "UI Development"
   - backend → "Backend Development", "Server-Side Development"
   - mobile → "Mobile App Development", "iOS/Android Development"
   - analytics → "Data Analytics", "Business Analytics"

General Guidelines:
1. ALWAYS include the "field" property - NEVER leave it undefined or missing!
2. Be specific - extract exact text changes from the suggestion
3. For keyword additions, append to existing arrays (don't replace)
4. For achievement improvements, modify the specific bullet point
5. Include clear before/after values
6. Return at least 1 affected field per suggestion
7. Maximum 5 affected fields per suggestion (prioritize highest impact)
8. Use context from the job description to infer professional skill names
9. Filter out noise words that aren't actual skills

Return ONLY the JSON object in the format shown above - no markdown, no code blocks, no explanation text outside the JSON.`;

    const userPrompt = `ATS Suggestion:
"${suggestion.text}"

${suggestion.explanation ? `Explanation: ${suggestion.explanation}` : ''}

Estimated Impact: +${suggestion.estimated_gain} points
Targets: ${suggestion.targets.join(', ')}
Category: ${suggestion.category}

Current Resume Content:
${JSON.stringify(resumeContent, null, 2)}

Analyze this suggestion and return the JSON array of affected fields with specific changes.`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent structured output
      response_format: { type: 'json_object' } as any,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the response
    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error(`Failed to parse amendment response: ${parseError}`);
    }

    // Extract affected fields array (handle different response formats)
    let affectedFields: AffectedField[] = [];

    if (Array.isArray(parsedResponse)) {
      affectedFields = parsedResponse;
    } else if (parsedResponse.affectedFields && Array.isArray(parsedResponse.affectedFields)) {
      affectedFields = parsedResponse.affectedFields;
    } else if (parsedResponse.amendments && Array.isArray(parsedResponse.amendments)) {
      affectedFields = parsedResponse.amendments;
    } else {
      console.warn('Unexpected response format, falling back to heuristic parsing');
      affectedFields = await generateAmendmentsHeuristic(suggestion, resumeContent);
    }

    // Post-process: Clean up keywords using smart expansion and noise filtering
    affectedFields = affectedFields.map(field => {
      // Only process skill additions
      if (field.sectionId === 'skills' &&
          (field.field === 'technical' || field.field === 'soft') &&
          (field.changeType === 'add' || field.changeType === 'modify')) {

        const values = Array.isArray(field.newValue) ? field.newValue : [field.newValue];

        // Extract keywords and apply smart expansion + noise filtering
        const cleanedKeywords: string[] = [];
        for (const value of values) {
          if (typeof value === 'string') {
            const expanded = smartKeywordExpansion([value]);
            cleanedKeywords.push(...expanded);
          }
        }

        if (cleanedKeywords.length > 0) {
          console.log(`🧹 Cleaned keywords for ${field.sectionId}.${field.field}:`, {
            before: values,
            after: cleanedKeywords
          });
          field.newValue = cleanedKeywords;
        }
      }
      return field;
    });

    // Validate and clean affected fields
    affectedFields = affectedFields
      .filter(field => field.sectionId && field.field && field.changeType)
      .slice(0, 5); // Limit to 5 fields

    if (affectedFields.length === 0) {
      console.warn('No valid affected fields generated, using fallback');
      affectedFields = await generateAmendmentsHeuristic(suggestion, resumeContent);
    }

    console.log(`✅ Generated ${affectedFields.length} amendments for suggestion ${suggestion.id}`);

    return {
      affectedFields,
      success: true,
    };
  } catch (error) {
    console.error('Error generating amendments:', error);

    // Fallback to heuristic generation
    console.log('Falling back to heuristic amendment generation');
    try {
      const affectedFields = await generateAmendmentsHeuristic(suggestion, resumeContent);
      return {
        affectedFields,
        success: true,
      };
    } catch (fallbackError) {
      return {
        affectedFields: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Heuristic fallback for amendment generation
 *
 * Uses pattern matching and keywords to infer changes
 * when AI generation fails or is unavailable.
 */
async function generateAmendmentsHeuristic(
  suggestion: Suggestion,
  resumeContent: OptimizedResume
): Promise<AffectedField[]> {
  const affectedFields: AffectedField[] = [];
  const lowerText = suggestion.text.toLowerCase();

  // Pattern 1: Keyword additions
  if (lowerText.includes('add') || lowerText.includes('include') || lowerText.includes('keyword')) {
    // Check if it's about skills
    if (lowerText.includes('skill') || suggestion.targets.includes('keyword_exact')) {
      const keywords = extractKeywords(suggestion.text);
      if (keywords.length > 0) {
        affectedFields.push({
          sectionId: 'skills',
          field: 'technical',
          originalValue: resumeContent.skills.technical,
          newValue: [...resumeContent.skills.technical, ...keywords],
          changeType: 'modify',
        });
      }
    }
  }

  // Pattern 2: Summary improvements
  if (lowerText.includes('summary') || lowerText.includes('professional statement')) {
    affectedFields.push({
      sectionId: 'summary',
      field: 'text',
      originalValue: resumeContent.summary,
      newValue: resumeContent.summary + ' [Suggested improvements to be reviewed]',
      changeType: 'modify',
    });
  }

  // Pattern 3: Achievement/metrics additions
  if (lowerText.includes('achievement') || lowerText.includes('metric') || lowerText.includes('quantif')) {
    const experienceIndex = 0; // Target most recent job
    if (resumeContent.experience.length > 0) {
      const exp = resumeContent.experience[experienceIndex];
      affectedFields.push({
        sectionId: `experience-${experienceIndex}`,
        field: 'achievements',
        originalValue: exp.achievements,
        newValue: [...exp.achievements, '[Add quantified achievement based on suggestion]'],
        changeType: 'modify',
      });
    }
  }

  // Pattern 4: Format/structure suggestions
  if (lowerText.includes('format') || lowerText.includes('readability') || suggestion.category === 'formatting') {
    affectedFields.push({
      sectionId: 'summary',
      field: 'text',
      originalValue: resumeContent.summary,
      newValue: resumeContent.summary,
      changeType: 'modify',
    });
  }

  // If no patterns matched, create a generic summary change
  if (affectedFields.length === 0) {
    affectedFields.push({
      sectionId: 'summary',
      field: 'text',
      originalValue: resumeContent.summary,
      newValue: resumeContent.summary + ' [Review and apply suggestion]',
      changeType: 'modify',
    });
  }

  return affectedFields;
}

/**
 * Extract keywords from suggestion text
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // Pattern: "add keywords like X, Y, and Z"
  const match1 = text.match(/keywords? (?:like|such as|including) ([^.]+)/i);
  if (match1) {
    const items = match1[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
    keywords.push(...items);
  }

  // Pattern: quoted keywords
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches) {
    keywords.push(...quotedMatches.map(q => q.replace(/"/g, '')));
  }

  return smartKeywordExpansion(keywords.slice(0, 3));
}

/**
 * Intelligently expand and filter keywords to be more professional and contextual
 *
 * Examples:
 * - "api" → ["API Design", "REST API Development", "API Integration"]
 * - "payment" → ["Payment Processing", "Payment Gateway Integration"]
 * - "job" → [] (filtered as noise)
 */
function smartKeywordExpansion(keywords: string[]): string[] {
  // Professional expansion map for common tech/business terms
  const expansionMap: Record<string, string[]> = {
    'api': ['API Design', 'REST API Development', 'API Integration'],
    'payment': ['Payment Processing', 'Payment Gateway Integration', 'Payment Systems'],
    'fintech': ['FinTech Solutions', 'Financial Technology'],
    'blockchain': ['Blockchain Development', 'Distributed Ledger Technology', 'Smart Contracts'],
    'cloud': ['Cloud Architecture', 'Cloud Computing', 'AWS', 'Azure'],
    'ml': ['Machine Learning', 'ML Model Development'],
    'ai': ['Artificial Intelligence', 'AI/ML Solutions'],
    'database': ['Database Design', 'Database Management', 'SQL'],
    'frontend': ['Frontend Development', 'UI Development'],
    'backend': ['Backend Development', 'Server-Side Development'],
    'mobile': ['Mobile App Development', 'iOS/Android Development'],
    'security': ['Security Engineering', 'Information Security', 'Cybersecurity'],
    'devops': ['DevOps Engineering', 'CI/CD Pipeline Management'],
    'analytics': ['Data Analytics', 'Business Analytics'],
    'compliance': ['Regulatory Compliance', 'Compliance Management'],
  };

  // Noise words from job descriptions that aren't real skills
  const noiseWords = new Set([
    'job', 'title', 'posted', 'company', 'about', 'see', 'this', 'and', 'the',
    'for', 'with', 'senior', 'manager', 'description', 'position', 'role'
  ]);

  const result: string[] = [];

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase().trim();

    // Filter out noise words
    if (noiseWords.has(lower) || lower.length < 3) {
      console.log(`🗑️ Filtered out noise keyword: "${keyword}"`);
      continue;
    }

    // Expand if we have a mapping
    if (expansionMap[lower]) {
      console.log(`✨ Expanding "${keyword}" →`, expansionMap[lower]);
      result.push(...expansionMap[lower]);
    } else {
      // Keep original but capitalize properly
      const capitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      console.log(`📝 Keeping keyword as-is: "${keyword}" → "${capitalized}"`);
      result.push(capitalized);
    }
  }

  return result;
}

/**
 * Generate amendments for multiple suggestions in batch
 */
export async function generateAmendmentsBatch(
  suggestions: Suggestion[],
  resumeContent: OptimizedResume
): Promise<Map<string, AmendmentGenerationResult>> {
  const results = new Map<string, AmendmentGenerationResult>();

  for (const suggestion of suggestions) {
    const result = await generateAmendments(suggestion, resumeContent);
    results.set(suggestion.id, result);
  }

  return results;
}
