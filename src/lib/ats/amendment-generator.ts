/**
 * Amendment Generator
 *
 * Parses ATS suggestions and generates structured amendments
 * with specific before/after values for resume sections.
 */

import OpenAI from 'openai';
import type { JobExtraction, Suggestion } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { AffectedField } from '@/types/chat';
import { adaptChatParams, logModelUsage, readUsage, selectModel, warnIfTruncated } from '@/lib/model-tiers';
import {
  CONTENT_RULES,
  DATA_NOTICE,
  TRUTH_RULES,
  languageRules,
  resolveOutputLanguage,
  wrap,
} from '@/lib/prompts/shared';

/**
 * System prompt for turning one suggestion into field edits (prompt upgrade S6).
 * No expansion map: the old one told the model that "add cloud" means AWS.
 */
export const AMENDMENT_SYSTEM_PROMPT = `# Role
You turn one resume-improvement suggestion into specific field edits that the candidate will preview before applying.

${DATA_NOTICE}

${TRUTH_RULES}

# Edit rules
- Propose 0 to 5 edits, highest value first.
- Skills: add a skill only if the resume already shows it in a bullet, the summary or a project. Write it in its common professional form ("REST APIs", not "api"). Never add a related skill the resume does not show, even if the suggestion names it.
- If the suggestion cannot be applied truthfully, return {"affectedFields": []}. The app then tells the candidate to add it only if it is true.
- Bullets: modify the specific bullet, keep its numbers, and do not append job duties.
- Never copy whole sentences or boilerplate (responsibilities, requirements, benefits) from the posting.
- Ignore posting metadata words ("job", "posted", "about", "senior", "role").

# Fields
sectionId: "summary" | "skills" | "certifications" | "experience-N" | "education-N" | "projects-N" (N starts at 0)
field: summary -> "text"; experience -> "title" | "company" | "location" | "achievements"; skills -> "technical" | "soft"; education -> "degree" | "institution"; certifications -> "items"; projects -> "name" | "description" | "technologies"
changeType: "add" | "modify" | "remove". For arrays, newValue is the full new array (existing items plus additions).
reason: one sentence on why the edit makes the resume clearer for this posting.

${CONTENT_RULES}

# Output
One JSON object: { "affectedFields": [ { "sectionId": string, "field": string, "originalValue": string | [string], "newValue": string | [string], "changeType": "add" | "modify" | "remove", "reason": string } ] }`;

/** Shown when no edit can be made truthfully (preview route, iOS shows it as text). */
export const NO_TRUTHFUL_EDIT_MESSAGE = {
  en: "This can't be added from what your resume already says. Add it yourself only if it is true.",
  he: 'אי אפשר להוסיף את זה ממה שכבר כתוב בקורות החיים. הוסיפו את זה בעצמכם רק אם זה נכון.',
} as const;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
}

/** Every text value in the resume, one per line. */
export function resumeText(resume: OptimizedResume): string {
  const out: string[] = [];
  collectStrings(resume, out);
  return out.join('\n');
}

function normalizeForMatch(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim()} `;
}

/** True when the resume already shows this term (whole-word, case-insensitive). */
export function resumeShows(term: string, source: string): boolean {
  const needle = normalizeForMatch(term).trim();
  return needle.length > 0 && normalizeForMatch(source).includes(` ${needle} `);
}

const GROUNDED_LIST_FIELDS = new Set(['skills.technical', 'skills.soft', 'certifications.items']);

/**
 * Drop any skill or certification an edit would add that the resume does not
 * already show. Applies to the model path and the heuristic path alike. An
 * edit left with no additions and no removals is dropped.
 */
export function groundAffectedFields(fields: AffectedField[], resume: OptimizedResume): AffectedField[] {
  const source = resumeText(resume);
  const grounded: AffectedField[] = [];
  for (const field of fields) {
    const key = `${String(field.sectionId).replace(/-\d+$/, '')}.${field.field}`;
    if (!GROUNDED_LIST_FIELDS.has(key) || !Array.isArray(field.newValue)) {
      grounded.push(field);
      continue;
    }
    const before = Array.isArray(field.originalValue) ? (field.originalValue as unknown[]).map(String) : [];
    const beforeLower = new Set(before.map((v) => v.toLowerCase()));
    const kept = (field.newValue as unknown[]).map(String).filter((item) => {
      if (beforeLower.has(item.toLowerCase())) return true;
      const ok = resumeShows(item, source);
      if (!ok) console.log(`🛡️ Dropped unsupported addition: "${item}"`);
      return ok;
    });
    const added = kept.some((item) => !beforeLower.has(item.toLowerCase()));
    const removed = before.some((item) => !kept.some((k) => k.toLowerCase() === item.toLowerCase()));
    if (added || removed) grounded.push({ ...field, newValue: kept });
  }
  return grounded;
}

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
  /**
   * True when no edit could be made from what the resume already says (the model
   * returned none on purpose, or every edit was unsupported). The heuristic is
   * not run in that case, because it would add the job's keywords as claims.
   */
  noTruthfulEdit?: boolean;
  /** Language for any message about this result. */
  outputLanguage?: 'he' | 'en';
}

export interface AmendmentGenerationContext {
  jobDescriptionText?: string;
  jobData?: JobExtraction;
}

/**
 * Generate amendments from an ATS suggestion
 *
 * Uses AI to analyze the suggestion text and map it to specific
 * resume sections with before/after values.
 */
export async function generateAmendments(
  suggestion: Suggestion,
  resumeContent: OptimizedResume,
  context?: AmendmentGenerationContext
): Promise<AmendmentGenerationResult> {
  try {
    console.log(`📝 Generating amendments for suggestion: ${suggestion.id}`);

    const outputLanguage = resolveOutputLanguage(resumeText(resumeContent), context?.jobDescriptionText || '');
    const systemPrompt = AMENDMENT_SYSTEM_PROMPT;
    const actionText = suggestion.action ? JSON.stringify(suggestion.action) : 'none';
    const suggestionBlock = [
      `Suggestion: ${suggestion.text}`,
      suggestion.explanation ? `Explanation: ${suggestion.explanation}` : '',
      `Estimated impact (rough estimate): +${suggestion.estimated_gain} points`,
      `Targets: ${suggestion.targets.join(', ')}`,
      `Category: ${suggestion.category}`,
      `Action: ${actionText}`,
    ].filter(Boolean).join('\n');
    const userPrompt = [
      languageRules(outputLanguage),
      wrap('suggestion', suggestionBlock),
      wrap('job_posting', context?.jobDescriptionText || 'none'),
      wrap('current_resume_json', JSON.stringify(resumeContent, null, 2)),
      'Return only the JSON object with the "affectedFields" array.',
    ].join('\n\n');

    const selection = selectModel('FAST', 'gpt-4o-mini');
    const startedAt = Date.now();
    const response = await getOpenAI().chat.completions.create(adaptChatParams(selection, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent structured output
      response_format: { type: 'json_object' },
    }));
    logModelUsage('ats.amendment-generator', selection, readUsage(response.usage), Date.now() - startedAt, response.choices[0]?.finish_reason);
    warnIfTruncated('ats.amendment-generator', response);

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
      affectedFields = await generateAmendmentsHeuristic(suggestion, resumeContent, context);
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

    affectedFields = filterBoilerplateAffectedFields(affectedFields);

    // Validate and clean affected fields
    const proposed = affectedFields.filter(field => field.sectionId && field.field && field.changeType);
    affectedFields = groundAffectedFields(proposed, resumeContent).slice(0, 5); // Limit to 5 fields

    if (affectedFields.length === 0) {
      // The model proposed nothing, only unsupported additions, or an unknown shape
      // the heuristic could not turn into a grounded edit. Running the keyword
      // heuristic again would add the job's terms as claims, so don't.
      console.warn(`No truthful amendment for suggestion ${suggestion.id}`);
      return { affectedFields: [], success: true, noTruthfulEdit: true, outputLanguage };
    }

    console.log(`✅ Generated ${affectedFields.length} amendments for suggestion ${suggestion.id}`);

    return {
      affectedFields,
      success: true,
      outputLanguage,
    };
  } catch (error) {
    console.error('Error generating amendments:', error);

    // Fallback to heuristic generation
    console.log('Falling back to heuristic amendment generation');
    try {
      const affectedFields = groundAffectedFields(
        filterBoilerplateAffectedFields(await generateAmendmentsHeuristic(suggestion, resumeContent, context)),
        resumeContent
      ).slice(0, 5);
      return {
        affectedFields,
        success: true,
        outputLanguage: resolveOutputLanguage(resumeText(resumeContent), context?.jobDescriptionText || ''),
        ...(affectedFields.length === 0 ? { noTruthfulEdit: true } : {}),
      };
    } catch {
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
  resumeContent: OptimizedResume,
  context?: AmendmentGenerationContext
): Promise<AffectedField[]> {
  void context;
  const affectedFields: AffectedField[] = [];
  const action = suggestion.action;

  if (action?.type === 'add_keyword' && Array.isArray(action.params.keywords)) {
    const keywords = smartKeywordExpansion(action.params.keywords);
    const existing = new Set((resumeContent.skills?.technical || []).map((skill) => skill.toLowerCase()));
    const additions = keywords.filter((keyword) => !existing.has(keyword.toLowerCase()));
    if (additions.length > 0) {
      affectedFields.push({
        sectionId: 'skills',
        field: 'technical',
        originalValue: resumeContent.skills.technical,
        newValue: [...resumeContent.skills.technical, ...additions],
        changeType: 'modify',
      });
    }
  }

  if (affectedFields.length === 0 && action?.type === 'add_phrase') {
    const phrase = sanitizePhrase(action.params.phrases?.[0]);
    // "Experience with X" is a claim; make it only when the resume shows X.
    if (phrase && resumeShows(phrase, resumeText(resumeContent))) {
      const summary = resumeContent.summary || '';
      const newSummary = summary
        ? `${summary.replace(/\s+$/, '')}${summary.endsWith('.') ? '' : '.'} Experience with ${phrase}.`
        : `Experience with ${phrase}.`;
      affectedFields.push({
        sectionId: 'summary',
        field: 'text',
        originalValue: resumeContent.summary,
        newValue: newSummary,
        changeType: 'modify',
      });
    }
  }

  if (affectedFields.length === 0 && action?.type === 'align_title' && action.params.targetTitle) {
    const targetTitle = action.params.targetTitle.trim();
    if (targetTitle.length > 0 && !isBoilerplateText(targetTitle)) {
      const summary = resumeContent.summary || '';
      if (!summary.toLowerCase().includes(targetTitle.toLowerCase())) {
        const newSummary = summary
          ? `${summary.replace(/\s+$/, '')}${summary.endsWith('.') ? '' : '.'} Target role: ${targetTitle}.`
          : `Target role: ${targetTitle}.`;
        affectedFields.push({
          sectionId: 'summary',
          field: 'text',
          originalValue: resumeContent.summary,
          newValue: newSummary,
          changeType: 'modify',
        });
      }
    }
  }

  if (affectedFields.length === 0 && suggestion.category === 'keywords') {
    const fallbackKeywords = extractKeywords(suggestion.text);
    if (fallbackKeywords.length > 0) {
      const existing = new Set((resumeContent.skills?.technical || []).map((skill) => skill.toLowerCase()));
      const additions = fallbackKeywords.filter((keyword) => !existing.has(keyword.toLowerCase()));
      if (additions.length > 0) {
        affectedFields.push({
          sectionId: 'skills',
          field: 'technical',
          originalValue: resumeContent.skills.technical,
          newValue: [...resumeContent.skills.technical, ...additions],
          changeType: 'modify',
        });
      }
    }
  }

  return affectedFields;
}

const JOB_POSTING_PATTERNS: RegExp[] = [
  /\bjob description\b/i,
  /\babout the role\b/i,
  /\bresponsibilit(y|ies)\b/i,
  /\brequirements\b/i,
  /\bqualifications\b/i,
  /\bmust\s+have\b/i,
  /\bnice\s+to\s+have\b/i,
  /\byou will\b/i,
  /\bwe are\b/i,
  /\bapply\b/i,
  /\bequal opportunity\b/i,
  /\bbenefits?\b/i,
  /\bsalary\b/i,
  /\bcompany\b/i,
];

function isBoilerplateText(text: string): boolean {
  return JOB_POSTING_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizePhrase(phrase?: string | null): string | null {
  if (!phrase) return null;
  const cleaned = phrase
    .replace(/^[\W_]+|[\W_]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(responsible for|experience with|experience in|knowledge of|ability to)\s+/i, '')
    .trim();

  if (!cleaned || isBoilerplateText(cleaned)) return null;
  const wordCount = cleaned.split(' ').length;
  if (wordCount < 2 || wordCount > 8) return null;
  return cleaned;
}

function filterBoilerplateAffectedFields(fields: AffectedField[]): AffectedField[] {
  const filtered: AffectedField[] = [];

  for (const field of fields) {
    if (typeof field.newValue === 'string') {
      if (!isBoilerplateText(field.newValue)) {
        filtered.push(field);
      }
      continue;
    }

    if (Array.isArray(field.newValue)) {
      const cleaned = field.newValue.filter(
        (item) => typeof item !== 'string' || !isBoilerplateText(item)
      );
      if (cleaned.length > 0) {
        filtered.push({
          ...field,
          newValue: cleaned,
        });
      }
      continue;
    }

    filtered.push(field);
  }

  return filtered;
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
 * Clean keywords: drop job-posting noise and fix casing. It never expands a
 * keyword into other terms: the old expansion map turned "cloud" into AWS and
 * Azure, "database" into SQL and "mobile" into iOS/Android, all claims the
 * resume may not support.
 *
 * Examples:
 * - "api" → ["API"]
 * - "payment processing" → ["Payment processing"]
 * - "job" → [] (filtered as noise)
 */
function smartKeywordExpansion(keywords: string[]): string[] {
  const knownCasing: Record<string, string> = {
    api: 'API', apis: 'APIs', sql: 'SQL', aws: 'AWS', gcp: 'GCP', css: 'CSS', html: 'HTML',
    rest: 'REST', saas: 'SaaS', b2b: 'B2B', b2c: 'B2C', crm: 'CRM', erp: 'ERP', seo: 'SEO',
    kpi: 'KPI', kpis: 'KPIs', etl: 'ETL', nlp: 'NLP', sdk: 'SDK', devops: 'DevOps', fintech: 'FinTech',
  };

  // Noise words from job descriptions that aren't real skills
  const noiseWords = new Set([
    'job', 'title', 'posted', 'company', 'about', 'see', 'this', 'and', 'the',
    'for', 'with', 'senior', 'manager', 'description', 'position', 'role',
    'responsibilities', 'responsibility', 'requirements', 'qualification', 'qualifications',
    'candidate', 'applicant', 'apply', 'benefits', 'salary', 'location', 'remote', 'hybrid'
  ]);

  const result: string[] = [];

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase().trim();

    // Filter out noise words
    if (noiseWords.has(lower) || lower.length < 3) {
      console.log(`🗑️ Filtered out noise keyword: "${keyword}"`);
      continue;
    }

    if (knownCasing[lower]) {
      result.push(knownCasing[lower]);
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
  resumeContent: OptimizedResume,
  context?: AmendmentGenerationContext
): Promise<Map<string, AmendmentGenerationResult>> {
  const results = new Map<string, AmendmentGenerationResult>();

  for (const suggestion of suggestions) {
    const result = await generateAmendments(suggestion, resumeContent, context);
    results.set(suggestion.id, result);
  }

  return results;
}
