/**
 * Apply suggestions to resume with smart keyword filtering
 * Updated: 2025-11-16 - Added context-aware skill validation
 * Updated: 2025-11-18 - Integrated field-based modification system (Phase 3, T018)
 */
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { JobExtraction, Suggestion } from '@/lib/ats/types';
import type { AffectedField } from '@/types/chat';
import { applyModification, applyModifications, type ModificationOperation } from '../resume/modification-applier';

export interface ApplySuggestionsResult {
  resume: OptimizedResume;
  changesApplied: number;
  changeLog: string[];
  modifications: ModificationOperation[]; // Track all modifications for audit trail (Phase 3)
}

export interface ApplySuggestionsContext {
  jobDescriptionText?: string;
  jobData?: JobExtraction;
  resumeOriginalText?: string;
}

/**
 * Apply multiple ATS suggestions to resume content
 * Returns the updated resume along with metadata about what changed
 */
export async function applySuggestions(
  resume: OptimizedResume,
  suggestions: Suggestion[],
  context?: ApplySuggestionsContext
): Promise<OptimizedResume> {
  console.log(`🔄 Starting to apply ${suggestions.length} suggestions...`);
  console.log(`📝 Suggestions to apply:`, suggestions.map((s, i) => `#${i + 1}: ${s.category} - ${s.text.substring(0, 60)}...`));

  let updated = JSON.parse(JSON.stringify(resume)); // Deep clone
  let changesApplied = 0;
  const changeLog: string[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    console.log(`\n🔧 Applying suggestion #${i + 1}/${suggestions.length}:`, {
      category: suggestion.category,
      text: suggestion.text.substring(0, 100),
    });

    const result = await applySingleSuggestion(updated, suggestion, context);

    console.log(`📊 Suggestion #${i + 1} result:`, {
      changed: result.changed,
      description: result.changeDescription,
    });

    if (result.changed) {
      updated = result.resume;
      changesApplied++;
      changeLog.push(`#${i + 1}: ${result.changeDescription}`);
      console.log(`✅ Suggestion #${i + 1} APPLIED. Total applied: ${changesApplied}`);
    } else {
      console.log(`⏭️ Suggestion #${i + 1} SKIPPED: ${result.changeDescription}`);
    }
  }

  console.log(`\n✅ FINAL: Applied ${changesApplied}/${suggestions.length} suggestions`);
  console.log(`📝 Change log:`, changeLog);

  return updated;
}

/**
 * Apply multiple ATS suggestions with detailed change tracking
 * Now includes modification operations for database audit trail (Phase 3)
 */
export async function applySuggestionsWithTracking(
  resume: OptimizedResume,
  suggestions: Suggestion[],
  context?: ApplySuggestionsContext
): Promise<ApplySuggestionsResult> {
  let updated = JSON.parse(JSON.stringify(resume)); // Deep clone
  let changesApplied = 0;
  const changeLog: string[] = [];
  const modifications: ModificationOperation[] = [];

  for (const suggestion of suggestions) {
    const result = await applySingleSuggestion(updated, suggestion, context);
    if (result.changed) {
      updated = result.resume;
      changesApplied++;
      changeLog.push(result.changeDescription);

      // Track modification operations for database logging (Phase 3)
      if (result.modifications && result.modifications.length > 0) {
        modifications.push(...result.modifications);
      }
    }
  }

  console.log(`✅ Applied ${changesApplied}/${suggestions.length} suggestions:`, changeLog);
  console.log(`📝 Tracked ${modifications.length} field modifications for audit trail`);

  return {
    resume: updated,
    changesApplied,
    changeLog,
    modifications,
  };
}

interface SuggestionResult {
  resume: OptimizedResume;
  changed: boolean;
  changeDescription: string;
  modifications?: ModificationOperation[]; // Optional: Field-based modifications for audit trail
}

async function applySingleSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion,
  context?: ApplySuggestionsContext
): Promise<SuggestionResult> {
  const updated = JSON.parse(JSON.stringify(resume)); // Deep clone

  switch (suggestion.category) {
    case 'keywords':
      return applyKeywordSuggestion(updated, suggestion, context);

    case 'metrics':
      return applyMetricsSuggestion(updated, suggestion);

    case 'content':
      return applyContentSuggestion(updated, suggestion, context);

    case 'formatting':
    case 'structure':
      // These are more complex and may require template changes
      // No-op here — handled by design/template subsystems
      return {
        resume: updated,
        changed: false,
        changeDescription: `Skipped ${suggestion.category} suggestion (handled by design system)`,
      };

    default:
      return {
        resume: updated,
        changed: false,
        changeDescription: `Unknown category: ${suggestion.category}`,
      };
  }
}

/**
 * Apply keyword-related suggestions using field-based modifications (Phase 3)
 */
function applyKeywordSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion,
  context?: ApplySuggestionsContext
): SuggestionResult {
  const actionKeywords =
    suggestion.action?.type === 'add_keyword'
      ? suggestion.action.params.keywords
      : [];
  const keywordCandidates =
    actionKeywords.length > 0 ? actionKeywords : extractKeywordsFromText(suggestion.text);
  const keywords = normalizeKeywords(keywordCandidates, context?.jobData);

  if (keywords.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: `No valid keywords found for: "${suggestion.text.substring(0, 50)}..."`,
    };
  }

  // Add to technical skills (avoid duplicates)
  const existing = new Set((resume.skills?.technical || []).map((s) => s.toLowerCase()));
  const newKeywords = keywords.filter((k) => !existing.has(k.toLowerCase()));

  if (newKeywords.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: `Keywords already present: ${keywords.join(', ')}`,
    };
  }

  // USE FIELD-BASED MODIFICATION (Phase 3) - append keywords to skills.technical array
  try {
    let updated = resume;

    // Ensure skills.technical exists before appending
    if (!resume.skills || !Array.isArray(resume.skills.technical)) {
      // Initialize the skills structure if needed
      updated = JSON.parse(JSON.stringify(resume));
      updated.skills = updated.skills || ({} as any);
      updated.skills.technical = updated.skills.technical || [];
    }

    // Track all modifications for audit trail
    const modifications: ModificationOperation[] = [];

    // Append each new keyword using field-based modification
    for (const keyword of newKeywords) {
      const modification: ModificationOperation = {
        operation: 'append',
        field_path: 'skills.technical',
        new_value: keyword,
        old_value: undefined,
      };

      updated = applyModification(updated, modification);
      modifications.push(modification);
    }

    return {
      resume: updated,
      changed: true,
      changeDescription: `Added keywords: ${newKeywords.join(', ')}`,
      modifications,
    };
  } catch (error) {
    console.error('Failed to apply keyword modifications:', error);
    return {
      resume,
      changed: false,
      changeDescription: `Failed to add keywords: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Apply metrics-related suggestions
 *
 * Only auto-apply when concrete parameters are provided to avoid fabricating numbers.
 */
function applyMetricsSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): SuggestionResult {
  const action = suggestion.action;
  if (!action || action.type !== 'add_metric') {
    return {
      resume,
      changed: false,
      changeDescription: 'No metric action found in suggestion',
    };
  }

  const metric = typeof action.params.metric === 'string' ? action.params.metric.trim() : '';
  const value = typeof action.params.value === 'string' ? action.params.value.trim() : '';
  const targetRoleIndex =
    typeof action.params.targetRoleIndex === 'number' ? action.params.targetRoleIndex : 0;

  if (!metric || !value) {
    return {
      resume,
      changed: false,
      changeDescription: 'Metric action requires concrete metric and value',
    };
  }

  if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: 'No experience section to add metrics to',
    };
  }

  let updated = JSON.parse(JSON.stringify(resume)) as OptimizedResume;
  const roleIndex = Math.min(targetRoleIndex, updated.experience.length - 1);
  const latestExp = updated.experience[roleIndex] as any;
  latestExp.achievements = Array.isArray(latestExp.achievements) ? latestExp.achievements : [];

  const hasQuant = (s: string) => /\d|%|\$|#/.test(s);
  let applied = false;
  const modifications: ModificationOperation[] = [];

  for (let i = 0; i < latestExp.achievements.length; i++) {
    const a = latestExp.achievements[i];
    if (typeof a === 'string' && !hasQuant(a)) {
      const newValue = `${a.replace(/[\s.]+$/, '')}. Increased ${metric} by ${value}.`;
      const modification: ModificationOperation = {
        operation: 'replace',
        field_path: `experience[${roleIndex}].achievements[${i}]`,
        new_value: newValue,
        old_value: a,
      };
      updated = applyModification(updated, modification);
      modifications.push(modification);
      applied = true;
      break;
    }
  }

  if (!applied) {
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: `experience[${roleIndex}].achievements`,
      new_value: `Increased ${metric} by ${value}.`,
      old_value: undefined,
    };
    updated = applyModification(updated, modification);
    modifications.push(modification);
  }

  return {
    resume: updated,
    changed: true,
    changeDescription: `Added metric: ${metric} by ${value} to ${latestExp.title || 'latest experience'}`,
    modifications,
  };
}

/**
 * Apply content suggestions using structured amendments
 *
 * Uses amendment generation to avoid direct JD phrase insertion.
 */
async function applyContentSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion,
  context?: ApplySuggestionsContext
): Promise<SuggestionResult> {
  return applySuggestionViaAmendments(resume, suggestion, context);
}

async function applySuggestionViaAmendments(
  resume: OptimizedResume,
  suggestion: Suggestion,
  context?: ApplySuggestionsContext
): Promise<SuggestionResult> {
  try {
    const { generateAmendments } = await import('@/lib/ats/amendment-generator');
    const result = await generateAmendments(suggestion, resume, {
      jobDescriptionText: context?.jobDescriptionText,
      jobData: context?.jobData,
    });

    if (!result.success || result.affectedFields.length === 0) {
      return {
        resume,
        changed: false,
        changeDescription: 'No structured amendments generated for suggestion',
      };
    }

    const modifications = buildModificationsFromAffectedFields(result.affectedFields);
    if (modifications.length === 0) {
      return {
        resume,
        changed: false,
        changeDescription: 'No applicable amendments after filtering',
      };
    }

    const updated = applyModifications(resume, modifications);
    return {
      resume: updated,
      changed: true,
      changeDescription: `Applied ${modifications.length} amendment(s)`,
      modifications,
    };
  } catch (error) {
    console.error('Failed to apply amendments:', error);
    return {
      resume,
      changed: false,
      changeDescription: `Failed to apply amendments: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function buildModificationsFromAffectedFields(
  affectedFields: AffectedField[]
): ModificationOperation[] {
  const modifications: ModificationOperation[] = [];

  for (const field of affectedFields) {
    const fieldMods = buildModificationsFromAffectedField(field);
    if (fieldMods.length > 0) {
      modifications.push(...fieldMods);
    }
  }

  return modifications;
}

function buildModificationsFromAffectedField(
  field: AffectedField
): ModificationOperation[] {
  const path = mapSectionFieldToPath(field.sectionId, field.field);
  if (!path) return [];

  const originalValue = field.originalValue;
  const newValue = field.newValue;

  if (field.changeType === 'remove') {
    return [
      {
        operation: 'remove',
        field_path: path,
        old_value: originalValue,
      },
    ];
  }

  if (areValuesEqual(originalValue, newValue)) {
    return [];
  }

  const originalArray = Array.isArray(originalValue) ? originalValue : null;
  const newArray = Array.isArray(newValue) ? newValue : null;

  if (originalArray || newArray) {
    const baseArray = originalArray || [];
    const incoming = newArray || [newValue];

    if (field.changeType === 'add') {
      const additions = incoming.filter((item) => !arrayContainsValue(baseArray, item));
      return additions.map((item) => ({
        operation: 'append',
        field_path: path,
        new_value: item,
        old_value: undefined,
      }));
    }

    return [
      {
        operation: 'replace',
        field_path: path,
        new_value: incoming,
        old_value: originalValue,
      },
    ];
  }

  if (typeof originalValue === 'string' && typeof newValue === 'string' && field.changeType === 'add') {
    if (newValue.startsWith(originalValue)) {
      const suffix = newValue.slice(originalValue.length);
      if (suffix.trim().length > 0) {
        return [
          {
            operation: 'suffix',
            field_path: path,
            new_value: suffix,
            old_value: originalValue,
          },
        ];
      }
    }
  }

  if (newValue === undefined) return [];

  return [
    {
      operation: 'replace',
      field_path: path,
      new_value: newValue,
      old_value: originalValue,
    },
  ];
}

function mapSectionFieldToPath(sectionId: string, field: string): string | null {
  if (!sectionId || !field) return null;

  if (sectionId === 'summary') {
    return field === 'text' || field === 'summary' ? 'summary' : null;
  }

  if (sectionId === 'skills') {
    if (field === 'technical' || field === 'soft') {
      return `skills.${field}`;
    }
    return null;
  }

  if (sectionId === 'certifications') {
    return 'certifications';
  }

  const sectionMatch = sectionId.match(/^(experience|education|projects)-(\d+)$/);
  if (sectionMatch) {
    const [, section, indexStr] = sectionMatch;
    const index = Number(indexStr);
    if (Number.isNaN(index)) return null;
    return `${section}[${index}].${field}`;
  }

  return null;
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function arrayContainsValue(array: unknown[], value: unknown): boolean {
  const normalizedValue = normalizeArrayValue(value);
  return array.some((item) => normalizeArrayValue(item) === normalizedValue);
}

function normalizeArrayValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * List of common non-skill words to filter out
 * These are typically structural words, not actual skills
 */
const NON_SKILL_WORDS = new Set([
  // Structural words
  'and', 'or', 'the', 'a', 'an', 'to', 'in', 'at', 'of', 'for', 'with', 'by',
  'from', 'as', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  // Action words (these should be in achievements, not skills)
  'add', 'include', 'use', 'apply', 'implement', 'create', 'develop',
  // Generic terms
  'job', 'title', 'position', 'role', 'work', 'company', 'skills', 'skill',
  'section', 'resume', 'more', 'other', 'also', 'plus',
  'responsibility', 'responsibilities', 'requirement', 'requirements',
  'qualification', 'qualifications', 'candidate', 'applicant', 'posted',
  'description', 'preferred', 'benefit', 'benefits', 'salary', 'location',
  'remote', 'hybrid',
  // Numbers
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
]);

const GENERIC_ACRONYMS = new Set(['api', 'apis', 'qa', 'sql']);

const ACRONYM_ENRICHMENT_MAP: Record<string, string[]> = {
  api: ['REST API', 'REST APIs', 'GraphQL API', 'GraphQL APIs', 'SOAP API', 'SOAP APIs', 'Web API', 'Web APIs'],
  apis: ['REST API', 'REST APIs', 'GraphQL API', 'GraphQL APIs', 'SOAP API', 'SOAP APIs', 'Web API', 'Web APIs'],
  sql: ['SQL databases', 'SQL queries', 'SQL reporting'],
  qa: ['Quality Assurance', 'QA automation', 'QA testing'],
};

/**
 * Check if a term is likely a valid skill
 */
function isValidSkill(term: string): boolean {
  const lower = term.toLowerCase().trim();

  if (GENERIC_ACRONYMS.has(lower) && !lower.includes(' ')) {
    return false;
  }

  // Too short to be a meaningful skill
  if (lower.length < 3) return false;

  // Check against blacklist
  if (NON_SKILL_WORDS.has(lower)) return false;

  // Only numbers
  if (/^\d+$/.test(lower)) return false;

  // Valid skill patterns:
  // - Technical terms (React, Python, JavaScript)
  // - Multi-word skills (Project Management, Data Analysis)
  // - Skills with special chars (C++, C#, .NET)
  const validPatterns = [
    /^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/, // CamelCase (JavaScript, TypeScript)
    /^[A-Z]{2,}$/, // Acronyms (SQL, AWS, API)
    /^[A-Za-z]+[+#]$/, // C++, C#
    /^\.[A-Z]+$/, // .NET
    /^[A-Za-z]+(?:\s+[A-Za-z]+){1,2}$/, // Multi-word (max 3 words)
  ];

  // Check if it matches any valid pattern
  const matchesPattern = validPatterns.some(pattern => pattern.test(term));
  if (matchesPattern) return true;

  // For lowercase single words, check if they're substantive (not structural)
  // Allow them if they're at least 4 chars and not in blacklist
  if (/^[a-z]{4,}$/.test(lower) && !NON_SKILL_WORDS.has(lower)) {
    return true;
  }

  return false;
}

function findAcronymContext(acronym: string, text: string): string | null {
  const escapedAcronym = acronym.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const beforePattern = new RegExp(`\\b([A-Za-z][\\w+#.]+\\s+${escapedAcronym}s?(?:\\s+[A-Za-z][\\w+#.]*)?)\\b`, 'gi');
  const afterPattern = new RegExp(`\\b(${escapedAcronym}s?\\s+[A-Za-z][\\w+#.]*?(?:\\s+[A-Za-z][\\w+#.]*)?)\\b`, 'gi');

  const beforeMatch = beforePattern.exec(text);
  if (beforeMatch && isValidSkill(beforeMatch[1])) {
    return beforeMatch[1];
  }

  const afterMatch = afterPattern.exec(text);
  if (afterMatch && isValidSkill(afterMatch[1])) {
    return afterMatch[1];
  }

  const enrichmentOptions = ACRONYM_ENRICHMENT_MAP[acronym.toLowerCase()] || [];
  for (const phrase of enrichmentOptions) {
    const escaped = phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const phraseRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (phraseRegex.test(text)) {
      return phrase;
    }
  }

  return null;
}

function normalizeKeywords(rawKeywords: string[], jobData?: JobExtraction): string[] {
  const cleaned = dedupePreserveOrder(
    rawKeywords
      .map((keyword) => String(keyword).trim())
      .filter((keyword) => keyword.length > 0)
  );

  const expanded = expandKeywordsFromJobData(cleaned, jobData);
  return dedupePreserveOrder(expanded.filter((keyword) => isValidSkill(keyword)));
}

function expandKeywordsFromJobData(keywords: string[], jobData?: JobExtraction): string[] {
  if (!jobData) return keywords;

  const jobSkills = [
    ...(Array.isArray(jobData.must_have) ? jobData.must_have : []),
    ...(Array.isArray(jobData.nice_to_have) ? jobData.nice_to_have : []),
  ]
    .map((skill) => String(skill).trim())
    .filter((skill) => skill.length > 0);

  if (jobSkills.length === 0) return keywords;

  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const expanded = jobSkills.filter((skill) => {
    const lower = skill.toLowerCase();
    return loweredKeywords.some((token) => lower.includes(token));
  });

  const filteredExpanded = expanded.filter((skill) => isValidSkill(skill));
  return filteredExpanded.length > 0 ? filteredExpanded : keywords;
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Extract keywords from suggestion text
 * Enhanced with context awareness to avoid extracting non-skills
 */
function extractKeywordsFromText(text: string): string[] {
  const keywords: string[] = [];

  // 1. HIGHEST PRIORITY: Look for single-quoted terms (explicit skills)
  // Example: "Add exact term 'leadership' to..."
  const singleQuotedMatch = text.match(/'([^']+)'/g);
  if (singleQuotedMatch) {
    const terms = singleQuotedMatch
      .map((m) => m.replace(/'/g, '').trim())
      .filter(isValidSkill);
    keywords.push(...terms);
  }

  // 2. Look for double-quoted terms (explicit skills)
  const doubleQuotedMatch = text.match(/"([^"]+)"/g);
  if (doubleQuotedMatch) {
    const terms = doubleQuotedMatch
      .map((m) => m.replace(/"/g, '').trim())
      .filter(isValidSkill);
    keywords.push(...terms);
  }

  // 3. ONLY if we found quoted terms, return them (they're explicit)
  if (keywords.length > 0) {
    return Array.from(new Set(keywords));
  }

  // 4. Look for "Add [keyword] to..." pattern for unquoted skills
  // Example: "Add React to technical skills"
  const addPattern = /(?:add|include)\s+(?:exact\s+term\s+)?([A-Z][A-Za-z+#.]+)(?:\s+to|\s+keyword)/gi;
  let match;
  while ((match = addPattern.exec(text)) !== null) {
    const term = match[1].trim();
    if (isValidSkill(term)) {
      keywords.push(term);
    }
  }

  // 5. Prefer contextual, multi-word phrases around generic acronyms before falling back
  const contextualAcronymPattern = /\b([A-Za-z][\w+#.]*\s+(?:API|APIs|SQL|QA)(?:\s+[A-Za-z][\w+#.]*)?)\b/gi;
  while ((match = contextualAcronymPattern.exec(text)) !== null) {
    const term = match[1].trim();
    if (isValidSkill(term)) {
      keywords.push(term);
    }
  }

  // 6. Look for capitalized technical terms (fallback for implicit skills)
  const techTerms = text.match(/\b([A-Z][a-z]*(?:[A-Z][a-z]*)*|\w+\+\+|[A-Z]#|\.NET)\b/g);
  if (techTerms) {
    for (const term of techTerms) {
      const lowerTerm = term.toLowerCase();
      if (GENERIC_ACRONYMS.has(lowerTerm)) {
        const enriched = findAcronymContext(term, text);
        if (enriched && isValidSkill(enriched)) {
          keywords.push(enriched);
        }
        continue;
      }

      if (isValidSkill(term)) {
        keywords.push(term);
      }
    }
  }

  // Deduplicate and return
  return Array.from(new Set(keywords.map(k => k.trim()).filter(k => k.length > 0)));
}
