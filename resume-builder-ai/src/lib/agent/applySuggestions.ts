import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { Suggestion } from '@/lib/ats/types';

/**
 * Apply multiple ATS suggestions to resume content
 */
export async function applySuggestions(
  resume: OptimizedResume,
  suggestions: Suggestion[]
): Promise<OptimizedResume> {
  let updated = structuredClone(resume); // Deep clone - 2-5x faster than JSON.parse/stringify

  for (const suggestion of suggestions) {
    updated = await applySingleSuggestion(updated, suggestion);
  }

  return updated;
}

async function applySingleSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): Promise<OptimizedResume> {
  const updated = structuredClone(resume); // Deep clone - 2-5x faster than JSON.parse/stringify
  
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
      console.log(`Suggestion category ${suggestion.category} acknowledged but requires manual review`);
      return updated;
    
    default:
      console.warn(`Suggestion category ${suggestion.category} not yet implemented`);
      return updated;
  }
}

/**
 * Apply keyword-related suggestions
 */
function applyKeywordSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): OptimizedResume {
  // Extract keywords from suggestion text
  const keywords = extractKeywordsFromText(suggestion.text);
  
  if (keywords.length === 0) {
    return resume;
  }
  
  // Add to technical skills (avoid duplicates)
  const existingSkills = new Set(resume.skills.technical.map(s => s.toLowerCase()));
  const newKeywords = keywords.filter(k => !existingSkills.has(k.toLowerCase()));
  
  if (newKeywords.length === 0) {
    return resume;
  }
  
  return {
    ...resume,
    skills: {
      ...resume.skills,
      technical: [...resume.skills.technical, ...newKeywords],
    },
  };
}

/**
 * Apply metrics-related suggestions
 */
function applyMetricsSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): OptimizedResume {
  // Add guidance note to most recent experience
  if (resume.experience.length === 0) {
    return resume;
  }
  
  const updated = { ...resume };
  const latestExp = { ...updated.experience[0] };
  
  // Add metric reminder as a template
  const metricTemplate = `📊 [Add quantified metric: e.g., "Increased efficiency by X%" or "Managed $Y budget" or "Reduced costs by Z%"]`;
  
  // Only add if not already present
  if (!latestExp.achievements.some(a => a.includes('Add quantified metric'))) {
    latestExp.achievements = [...latestExp.achievements, metricTemplate];
  }
  
  updated.experience = [latestExp, ...updated.experience.slice(1)];
  
  return updated;
}

/**
 * Apply content suggestions
 */
function applyContentSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): OptimizedResume {
  // For general content suggestions, add a note to the summary
  const contentNote = `💡 [Tip applied: ${suggestion.text}]`;
  
  // Check if already applied
  if (resume.summary.includes(suggestion.text)) {
    return resume;
  }
  
  return {
    ...resume,
    summary: resume.summary + ` ${contentNote}`
  };
}

/**
 * Extract keywords from suggestion text
 */
function extractKeywordsFromText(text: string): string[] {
  // Look for quoted terms first
  const quotedMatch = text.match(/"([^"]+)"/g);
  if (quotedMatch) {
    return quotedMatch.map(m => m.replace(/"/g, ''));
  }
  
  // Look for keywords after "add" or "include"
  const addMatch = text.match(/(?:add|include)\s+([A-Z][A-Za-z+#.\s]+?)(?:\s+keyword|\s+to|,|$)/i);
  if (addMatch) {
    return [addMatch[1].trim()];
  }
  
  // Look for specific technical terms (case-sensitive)
  const techTerms = text.match(/\b([A-Z][a-z]*(?:[A-Z][a-z]*)*|\w+\+\+|[A-Z]#)\b/g);
  if (techTerms) {
    return techTerms.filter(term => 
      // Filter out common words
      !['Add', 'Include', 'Use', 'Apply', 'The', 'To', 'From'].includes(term)
    );
  }
  
  return [];
}




