/**
 * Skill/requirement matching helpers for ATS keyword scoring.
 * Matches at the requirement-phrase level, not only individual tokens.
 */

import { normalizeText, tokenize, isShortSkillToken } from './utils/text-utils';
import { KEYWORD_THRESHOLDS } from './config/thresholds';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will',
  'are', 'been', 'has', 'had', 'was', 'were', 'can', 'may', 'could',
  'would', 'should', 'must', 'being', 'about', 'into', 'through', 'during',
  'your', 'our', 'their', 'you', 'all', 'any', 'able', 'work', 'team',
  'role', 'job', 'position', 'company', 'years', 'year', 'experience',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hebrew one-letter proclitics: and / the / in / to / from / that / like.
 *
 * Hebrew attaches "in", "the" and "and" directly to the noun, so a job asking
 * for בפיתוח ("in development") and a resume saying פיתוח ("development") are
 * the same requirement written two ways and never match as strings.
 */
const HEBREW_PROCLITIC = '[\\u05D5\\u05D4\\u05D1\\u05DC\\u05DE\\u05E9\\u05DB]?';
const STARTS_HEBREW = /^[\u0590-\u05FF]/;

function containsWholePhrase(normalizedResume: string, normalizedPhrase: string): boolean {
  if (!normalizedPhrase) return false;

  // Word boundaries must be Unicode-aware. `[^a-z0-9]` treats every Hebrew
  // character as a boundary, so "פיתוח" matched INSIDE "בפיתוח" — and equally
  // inside any longer word that merely contained those letters. That is
  // substring matching dressed up as whole-word matching, and it inflates
  // keyword_exact for every non-Latin script (WP-59 S3c).
  const boundary = '[^\\p{L}\\p{N}]';

  // Having made the boundary strict, allow the ONE thing it now wrongly
  // excludes: a leading Hebrew particle on the first word of the phrase.
  const prefix = STARTS_HEBREW.test(normalizedPhrase) ? HEBREW_PROCLITIC : '';

  const pattern = new RegExp(
    `(^|${boundary})${prefix}${escapeRegExp(normalizedPhrase)}(${boundary}|$)`,
    'u'
  );
  return pattern.test(normalizedResume);
}

/** Long enough to be evidence, or a known short technology name. */
function isScorableToken(word: string): boolean {
  return word.length >= KEYWORD_THRESHOLDS.min_keyword_length || isShortSkillToken(word);
}

function significantTokens(text: string): string[] {
  return tokenize(text).filter((word) => isScorableToken(word) && !STOP_WORDS.has(word));
}

/**
 * Returns true when a JD skill/requirement appears in the resume text.
 */
export function skillMatchesResume(skill: string, resumeText: string): boolean {
  const normalizedSkill = normalizeText(skill);
  const normalizedResume = normalizeText(resumeText);

  if (!normalizedSkill || !normalizedResume) {
    return false;
  }

  // Whole-phrase match (handles "Node.js", "machine learning", etc.)
  if (isScorableToken(normalizedSkill)) {
    if (containsWholePhrase(normalizedResume, normalizedSkill)) {
      return true;
    }
  }

  const skillTokens = significantTokens(skill);
  if (skillTokens.length === 0) {
    return false;
  }

  if (skillTokens.length === 1) {
    return containsWholePhrase(normalizedResume, skillTokens[0]);
  }

  const matchedCount = skillTokens.filter((token) =>
    containsWholePhrase(normalizedResume, token)
  ).length;
  const requiredMatches = Math.max(
    1,
    Math.ceil(skillTokens.length * KEYWORD_THRESHOLDS.match_classification_threshold),
  );
  return matchedCount >= requiredMatches;
}

/** Fraction (0-1) of a skill phrase's significant tokens present in the resume. */
export function skillCoverage(skill: string, resumeText: string): number {
  const normalizedSkill = normalizeText(skill);
  const normalizedResume = normalizeText(resumeText);

  if (!normalizedSkill || !normalizedResume) {
    return 0;
  }

  if (isScorableToken(normalizedSkill) && containsWholePhrase(normalizedResume, normalizedSkill)) {
    return 1;
  }

  const tokens = significantTokens(skill);
  if (tokens.length === 0) {
    return 0;
  }

  const matched = tokens.filter((token) =>
    containsWholePhrase(normalizedResume, token)
  ).length;
  return matched / tokens.length;
}

/**
 * Score a list of JD skills/requirements against resume text.
 */
export function scoreSkillListMatch(skills: string[], resumeText: string): {
  matched: string[];
  missing: string[];
  score: number;
} {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
  if (uniqueSkills.length === 0) {
    return { matched: [], missing: [], score: 50 };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of uniqueSkills) {
    if (skillMatchesResume(skill, resumeText)) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return {
    matched,
    missing,
    score: (matched.length / uniqueSkills.length) * 100,
  };
}

/** Score a skill list by average token coverage; matched/missing keep a threshold. */
export function scoreSkillCoverage(skills: string[], resumeText: string): {
  matched: string[];
  missing: string[];
  score: number;
} {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
  if (uniqueSkills.length === 0) {
    return { matched: [], missing: [], score: 50 };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  let coverageSum = 0;

  for (const skill of uniqueSkills) {
    const coverage = skillCoverage(skill, resumeText);
    coverageSum += coverage;

    if (coverage >= KEYWORD_THRESHOLDS.match_classification_threshold) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return {
    matched,
    missing,
    score: (coverageSum / uniqueSkills.length) * 100,
  };
}
