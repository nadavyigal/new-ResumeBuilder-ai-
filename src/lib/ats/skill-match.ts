/**
 * Skill/requirement matching helpers for ATS keyword scoring.
 * Matches at the requirement-phrase level, not only individual tokens.
 */

import { normalizeText, tokenize } from './utils/text-utils';
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

function containsWholePhrase(normalizedResume: string, normalizedPhrase: string): boolean {
  if (!normalizedPhrase) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedPhrase)}([^a-z0-9]|$)`);
  return pattern.test(normalizedResume);
}

function significantTokens(text: string): string[] {
  return tokenize(text).filter(
    (word) => word.length >= KEYWORD_THRESHOLDS.min_keyword_length && !STOP_WORDS.has(word)
  );
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
  if (normalizedSkill.length >= KEYWORD_THRESHOLDS.min_keyword_length) {
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

  if (
    normalizedSkill.length >= KEYWORD_THRESHOLDS.min_keyword_length &&
    containsWholePhrase(normalizedResume, normalizedSkill)
  ) {
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
