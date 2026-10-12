/**
 * Job description extractor
 *
 * Enhanced extraction of structured data from job descriptions
 */

import type { JobExtraction } from '../types';
import { extractKeywords } from '../utils/text-utils';

/**
 * Extract structured data from job description text
 *
 * This enhances the basic JD extraction with additional parsing
 * for must-have vs nice-to-have skills, responsibilities, etc.
 */
export function extractJobData(jobText: string, existingExtraction?: Partial<JobExtraction>): JobExtraction {
  // Start with existing extraction if provided
  const extraction: JobExtraction = {
    title: existingExtraction?.title || extractJobTitle(jobText),
    company: existingExtraction?.company || '',
    must_have: existingExtraction?.must_have || extractMustHaveSkills(jobText),
    nice_to_have: existingExtraction?.nice_to_have || extractNiceToHaveSkills(jobText),
    responsibilities: existingExtraction?.responsibilities || extractResponsibilities(jobText),
    seniority: existingExtraction?.seniority || detectSeniority(jobText),
    location: existingExtraction?.location || '',
    industry: existingExtraction?.industry || '',
  };

  // If no must_have skills found, use technical keyword extraction as fallback.
  // Filter generic business words so the keyword denominator stays realistic.
  if (extraction.must_have.length === 0) {
    const genericFallbackTerms = new Set([
      'job', 'role', 'position', 'company', 'team', 'work', 'working',
      'experience', 'years', 'ability', 'strong', 'excellent', 'good',
      'communication', 'skills', 'responsibilities', 'requirements',
      'description', 'summary', 'overview', 'preferred', 'required',
    ]);
    extraction.must_have = extractKeywords(jobText)
      .filter((keyword) => !genericFallbackTerms.has(keyword.toLowerCase()))
      .slice(0, 12);
  }

  return extraction;
}

/**
 * Extract job title from text (look for common patterns)
 */
function extractJobTitle(text: string): string {
  // Common patterns for job titles in JDs.
  //
  // All three original patterns depend on Latin script and on capitalisation.
  // Hebrew has no case, so a Hebrew job description returned '' — which sent
  // title_alignment to its "no target title" constant of 50 for EVERY Hebrew
  // job, and left the {targetTitle} placeholder uninterpolated in the diagnosis
  // bullets the user reads. The Hebrew patterns below anchor on the hiring
  // verbs instead of on capitalisation (WP-59 S3e).
  //
  // Same approach as the resume-side extractor in title-alignment.ts: add
  // script-specific patterns rather than loosening the Latin ones, which would
  // start matching ordinary prose.
  const patterns = [
    /(?:position|role|title|job):\s*([^\n]+)/i,
    /we are (?:looking for|hiring|seeking) (?:a|an)\s+([^\n.]+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\s*$/m,  // Capitalized multi-word title

    // Hebrew labelled forms: משרה / תפקיד / דרוש / דרושה followed by the role.
    /(?:משרה|תפקיד|התפקיד|דרוש|דרושה|דרוש\/ה|מחפשים|מגייסים)\s*[:\-]?\s*([^\n]{2,60})/,

    // Hebrew "we are looking for a ..." without a label.
    /(?:אנחנו|אנו)\s+(?:מחפשים|מגייסים)\s+([^\n.]{2,60})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract must-have skills (required, essential)
 */
function extractMustHaveSkills(text: string): string[] {
  const skills = new Set<string>();

  // Look for sections with "required", "must have", "essential"
  const requiredSection = extractSection(text, [
    'required qualifications',
    'required skills',
    'must have',
    'essential skills',
    'minimum qualifications',
    'requirements',
  ]);

  if (requiredSection) {
    // Extract bullet points or comma-separated items
    const items = extractListItems(requiredSection);
    items.forEach(item => skills.add(item));
  }

  // Also look for explicit "required" keywords
  const requiredPattern = /(?:required|must have|essential)[:\s]+([^.\n]+)/gi;
  const matches = text.matchAll(requiredPattern);

  for (const match of matches) {
    const skillsExtracted = extractKeywords(match[1]);
    skillsExtracted.forEach(skill => skills.add(skill));
  }

  return Array.from(skills).slice(0, 20);
}

/**
 * Extract nice-to-have skills (preferred, bonus)
 */
function extractNiceToHaveSkills(text: string): string[] {
  const skills = new Set<string>();

  // Look for sections with "preferred", "nice to have", "bonus"
  const preferredSection = extractSection(text, [
    'preferred qualifications',
    'preferred skills',
    'nice to have',
    'bonus skills',
    'plus',
    'desirable',
  ]);

  if (preferredSection) {
    const items = extractListItems(preferredSection);
    items.forEach(item => skills.add(item));
  }

  // Also look for explicit "preferred" keywords
  const preferredPattern = /(?:preferred|nice to have|bonus|plus)[:\s]+([^.\n]+)/gi;
  const matches = text.matchAll(preferredPattern);

  for (const match of matches) {
    const skillsExtracted = extractKeywords(match[1]);
    skillsExtracted.forEach(skill => skills.add(skill));
  }

  return Array.from(skills).slice(0, 15);
}

/**
 * Extract responsibilities from job description
 */
function extractResponsibilities(text: string): string[] {
  const responsibilities: string[] = [];

  // Look for responsibility section
  const respSection = extractSection(text, [
    'responsibilities',
    'duties',
    'what you will do',
    'what you\'ll do',
    'your role',
    'day to day',
  ]);

  if (respSection) {
    const items = extractListItems(respSection);
    responsibilities.push(...items);
  }

  return responsibilities.slice(0, 10);
}

/**
 * Detect seniority level from text
 */
function detectSeniority(text: string): string {
  const textLower = text.toLowerCase();

  // Senior/Lead levels
  if (
    textLower.includes('senior') ||
    textLower.includes('lead') ||
    textLower.includes('principal') ||
    textLower.includes('staff')
  ) {
    return 'senior';
  }

  // Executive levels
  if (
    textLower.includes('director') ||
    textLower.includes('vp') ||
    textLower.includes('vice president') ||
    textLower.includes('chief') ||
    textLower.includes('head of')
  ) {
    return 'executive';
  }

  // Entry level
  if (
    textLower.includes('entry level') ||
    textLower.includes('junior') ||
    textLower.includes('intern') ||
    textLower.includes('associate') ||
    textLower.includes('0-2 years')
  ) {
    return 'entry';
  }

  // Mid-level (default if no other indicators)
  return 'mid';
}

/**
 * Extract a section from text based on header keywords
 */
function extractSection(text: string, headers: string[]): string | null {
  for (const header of headers) {
    // Case-insensitive search for header
    const headerRegex = new RegExp(`(?:^|\\n)\\s*${header}[:\\s]*\\n?([\\s\\S]*?)(?=\\n\\s*(?:[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*:)|$)`, 'i');
    const match = text.match(headerRegex);

    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract list items from text (bullet points, numbered lists, or comma-separated)
 */
function extractListItems(text: string): string[] {
  const items: string[] = [];

  // Try bullet point pattern (•, -, *, numbers)
  const bulletPattern = /^[\s•\-\*\d.]+(.+)$/gm;
  const bulletMatches = text.matchAll(bulletPattern);

  for (const match of bulletMatches) {
    if (match[1]) {
      items.push(match[1].trim());
    }
  }

  // If no bullets found, try line-by-line
  if (items.length === 0) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    items.push(...lines);
  }

  // Clean up items (remove empty, too short, or too long)
  return items
    .filter(item => item.length > 5 && item.length < 300)
    .slice(0, 20);
}

/**
 * Check if job extraction is complete
 */
export function isJobExtractionComplete(extraction: JobExtraction): {
  isComplete: boolean;
  completeness: number;  // 0-1
  missingFields: string[];
} {
  const requiredFields: (keyof JobExtraction)[] = ['title', 'must_have', 'responsibilities'];
  const missingFields: string[] = [];
  let filledFields = 0;
  const totalFields = requiredFields.length;

  for (const field of requiredFields) {
    const value = extraction[field];

    if (!value || (Array.isArray(value) && value.length === 0)) {
      missingFields.push(field);
    } else {
      filledFields++;
    }
  }

  return {
    isComplete: missingFields.length === 0,
    completeness: filledFields / totalFields,
    missingFields,
  };
}

// "Kesher Commerce is looking for a Data Analyst to join ...". The role ends at
// the first preposition, relative word or punctuation: "a Data Analyst to join",
// "a Senior Product Designer who loves", "an Account Executive for the EMEA region".
const HIRING_SENTENCE =
  /(?:^|[.!?]\s+)([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,3})\s+(?:is|are)\s+(?:looking for|hiring|seeking)\s+(?:a|an)\s+([A-Z][^\n.,;:!?]*?)(?=\s+(?:to|who|that|for|in|at|on|with|and|based)\b|[\n.,;:!?]|$)/m;

/** Capitalised sentence openers that are not company names. */
const NON_COMPANY_SUBJECTS = new Set(['the', 'our', 'this', 'your', 'we', 'it', 'company', 'team']);

/**
 * Title and company from a pasted post's "<Company> is looking for a <Title>"
 * sentence, for LABELLING the saved job only.
 *
 * Deliberately not wired into `extractJobData`: a non-empty job title makes
 * title_alignment compare against the resume's titles, and when those cannot be
 * parsed from flattened PDF text the analyzer returns 20 instead of its neutral
 * 50. On the 2026-10-12 Maya fixture that cost a real Data Analyst 4 points.
 * Changing the score is its own story; this only stops the saved job reading
 * "Job Position" / "Company Name" in the iOS preview header.
 */
export function extractHiringSentence(text: string): { title: string; company: string } {
  const match = text.match(HIRING_SENTENCE);
  if (!match) return { title: '', company: '' };
  const subject = match[1].trim();
  const generic = NON_COMPANY_SUBJECTS.has(subject.split(/\s+/)[0].toLowerCase());
  return { title: match[2].trim(), company: generic ? '' : subject };
}
