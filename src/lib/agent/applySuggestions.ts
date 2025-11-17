/**
 * Apply suggestions to resume with smart keyword filtering
 * Updated: 2025-11-16 - Added context-aware skill validation
 */
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { Suggestion } from '@/lib/ats/types';

export interface ApplySuggestionsResult {
  resume: OptimizedResume;
  changesApplied: number;
  changeLog: string[];
}

/**
 * Apply multiple ATS suggestions to resume content
 * Returns the updated resume along with metadata about what changed
 */
export async function applySuggestions(
  resume: OptimizedResume,
  suggestions: Suggestion[]
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

    const result = await applySingleSuggestion(updated, suggestion);

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
 */
export async function applySuggestionsWithTracking(
  resume: OptimizedResume,
  suggestions: Suggestion[]
): Promise<ApplySuggestionsResult> {
  let updated = JSON.parse(JSON.stringify(resume)); // Deep clone
  let changesApplied = 0;
  const changeLog: string[] = [];

  for (const suggestion of suggestions) {
    const result = await applySingleSuggestion(updated, suggestion);
    if (result.changed) {
      updated = result.resume;
      changesApplied++;
      changeLog.push(result.changeDescription);
    }
  }

  console.log(`✅ Applied ${changesApplied}/${suggestions.length} suggestions:`, changeLog);

  return {
    resume: updated,
    changesApplied,
    changeLog,
  };
}

interface SuggestionResult {
  resume: OptimizedResume;
  changed: boolean;
  changeDescription: string;
}

async function applySingleSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): Promise<SuggestionResult> {
  const updated = JSON.parse(JSON.stringify(resume)); // Deep clone

  switch (suggestion.category) {
    case 'keywords':
      return applyKeywordSuggestion(updated, suggestion);

    case 'metrics':
      return applyMetricsSuggestion(updated, suggestion);

    case 'content':
      return applyContentSuggestion(updated, suggestion);

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
 * Apply keyword-related suggestions
 */
function applyKeywordSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): SuggestionResult {
  // Extract keywords from suggestion text
  const keywords = extractKeywordsFromText(suggestion.text);

  if (keywords.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: `No keywords extracted from: "${suggestion.text.substring(0, 50)}..."`,
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

  const next: OptimizedResume = JSON.parse(JSON.stringify(resume));
  next.skills = next.skills || { technical: [], soft: [] } as any;
  next.skills.technical = [...(next.skills.technical || []), ...newKeywords];

  return {
    resume: next,
    changed: true,
    changeDescription: `Added keywords: ${newKeywords.join(', ')}`,
  };
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
  const action: any = (suggestion as any).action;
  if (!action || action.type !== 'add_metric' || !action.params) {
    return {
      resume,
      changed: false,
      changeDescription: 'No metric action found in suggestion',
    };
  }

  const params = action.params as Record<string, unknown>;
  const metric = String(params.metric || '').trim();
  const value = String(params.value || '').trim();

  if (!metric || !value) {
    return {
      resume,
      changed: false,
      changeDescription: 'Missing metric or value parameters',
    };
  }

  if (!Array.isArray(resume.experience) || resume.experience.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: 'No experience section to add metrics to',
    };
  }

  const updated = JSON.parse(JSON.stringify(resume)) as OptimizedResume;
  const latestExp = updated.experience[0] as any;
  latestExp.achievements = Array.isArray(latestExp.achievements) ? latestExp.achievements : [];

  const hasQuant = (s: string) => /\d|%|\$|#/.test(s);
  let applied = false;
  for (let i = 0; i < latestExp.achievements.length; i++) {
    const a = latestExp.achievements[i];
    if (typeof a === 'string' && !hasQuant(a)) {
      latestExp.achievements[i] = `${a.replace(/[\s.]+$/, '')}. Increased ${metric} by ${value}.`;
      applied = true;
      break;
    }
  }

  if (!applied) {
    latestExp.achievements.push(`Increased ${metric} by ${value}.`);
  }

  updated.experience[0] = latestExp;

  return {
    resume: updated,
    changed: true,
    changeDescription: `Added metric: ${metric} by ${value} to ${latestExp.title || 'latest experience'}`,
  };
}

/**
 * Apply content suggestions
 *
 * Mirrors quoted phrases from the suggestion into experience achievements (or summary fallback)
 * without inserting visible banners.
 */
function applyContentSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): SuggestionResult {
  const phrases = extractQuotedPhrases(suggestion.text);
  if (phrases.length === 0) {
    return {
      resume,
      changed: false,
      changeDescription: 'No quoted phrases found in suggestion',
    };
  }

  const phrase = phrases[0];
  const updated = JSON.parse(JSON.stringify(resume)) as OptimizedResume;

  if (Array.isArray(updated.experience) && updated.experience.length > 0) {
    const latestExp = updated.experience[0] as any;
    latestExp.achievements = Array.isArray(latestExp.achievements) ? latestExp.achievements : [];

    const alreadyPresent = latestExp.achievements.some(
      (a: unknown) => typeof a === 'string' && a.toLowerCase().includes(phrase.toLowerCase())
    );
    if (!alreadyPresent) {
      latestExp.achievements.push(phrase);
      updated.experience[0] = latestExp;
      return {
        resume: updated,
        changed: true,
        changeDescription: `Added content: "${phrase.substring(0, 50)}${phrase.length > 50 ? '...' : ''}" to ${latestExp.title || 'latest experience'}`,
      };
    } else {
      return {
        resume,
        changed: false,
        changeDescription: `Content already present: "${phrase.substring(0, 30)}..."`,
      };
    }
  }

  // Fallback: ensure the phrase appears in the summary
  if (typeof updated.summary === 'string') {
    if (!updated.summary.toLowerCase().includes(phrase.toLowerCase())) {
      updated.summary = `${updated.summary ? updated.summary + ' ' : ''}${phrase}`;
      return {
        resume: updated,
        changed: true,
        changeDescription: `Added content: "${phrase.substring(0, 50)}..." to summary`,
      };
    } else {
      return {
        resume,
        changed: false,
        changeDescription: 'Content already in summary',
      };
    }
  }

  return {
    resume,
    changed: false,
    changeDescription: 'No experience or summary section to add content to',
  };
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
  // Numbers
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
]);

/**
 * Check if a term is likely a valid skill
 */
function isValidSkill(term: string): boolean {
  const lower = term.toLowerCase().trim();

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

  // 5. Look for capitalized technical terms (fallback for implicit skills)
  // Only use this if we haven't found explicit skills
  if (keywords.length === 0) {
    const techTerms = text.match(/\b([A-Z][a-z]*(?:[A-Z][a-z]*)*|\w+\+\+|[A-Z]#|\.NET)\b/g);
    if (techTerms) {
      const filtered = techTerms.filter(isValidSkill);
      keywords.push(...filtered);
    }
  }

  // Deduplicate and return
  return Array.from(new Set(keywords.map(k => k.trim()).filter(k => k.length > 0)));
}

/**
 * Extract phrases in single or double quotes
 */
function extractQuotedPhrases(text: string): string[] {
  const results: string[] = [];
  const dq = text.match(/"([^"]+)"/g) || [];
  const sq = text.match(/'([^']+)'/g) || [];
  for (const m of dq) results.push(m.replace(/"/g, ''));
  for (const m of sq) results.push(m.replace(/'/g, ''));
  return results;
}

