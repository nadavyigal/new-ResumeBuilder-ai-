/**
 * Experience Text Extractor
 *
 * Derives a minimal structured experience list from a plain-text resume.
 *
 * Why this exists (WP-45 D4): the scoring engine compares an original resume
 * against an optimized one, but only the optimized side has structured JSON.
 * The recency analyzer returns a constant 50 when no experience array is
 * present, so the original side was scored against a placeholder while the
 * optimized side got a real number — a systematic bias in every reported
 * before/after delta that had nothing to do with the optimization.
 *
 * This extractor is deliberately conservative. It returns null unless it finds
 * at least one dated role, so a resume it cannot read keeps today's behavior
 * rather than being scored against a guess.
 */

import type { OptimizedResume } from '@/lib/ai-optimizer';

const MONTH =
  '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const YEAR = '(?:19|20)\\d{2}';
const DATE_POINT = `(?:${MONTH}\\s+)?${YEAR}`;
const RANGE_SEPARATOR = '\\s*(?:-|–|—|to)\\s*';

/** e.g. "Jan 2022 - Present", "2019 – 2021", "March 2020 to Aug 2023" */
const DATE_RANGE = new RegExp(
  `(${DATE_POINT})${RANGE_SEPARATOR}(present|current|${DATE_POINT})`,
  'i'
);

/** Section headings and contact noise that must never be read as a job title. */
const NON_TITLE_LINE =
  /^(experience|work experience|professional experience|employment|education|skills|core competencies|key skills|technical expertise|certifications|projects|summary|professional summary|contact|languages|tools|frameworks)\b/i;

const BULLET = /^\s*(?:[•·▪◦*\-–—]|\d+[.)])\s+/;

const MAX_TITLE_LOOKBACK = 3;

export interface DerivedExperience {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  achievements: string[];
  responsibilities?: string[];
}

/**
 * Parse a "Title at Company" / "Title, Company" / "Title | Company" line.
 */
function splitTitleAndCompany(line: string): { title: string; company: string } {
  const atMatch = line.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  }

  const delimited = line.split(/\s*[|,–—]\s*/).filter(Boolean);
  if (delimited.length >= 2) {
    return { title: delimited[0].trim(), company: delimited[1].trim() };
  }

  return { title: line.trim(), company: '' };
}

function isPlausibleTitleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (BULLET.test(line)) return false;
  if (NON_TITLE_LINE.test(trimmed)) return false;
  if (DATE_RANGE.test(trimmed)) return false;
  if (trimmed.includes('@') && /\S+@\S+\.\S+/.test(trimmed)) return false; // email
  // A heading in ALL CAPS with no lowercase is a section marker, not a role.
  if (trimmed === trimmed.toUpperCase() && /[A-Z]{4,}/.test(trimmed)) return false;
  return trimmed.length <= 120;
}

/**
 * Extract dated roles from plain resume text, most recent first (document
 * order — the recency analyzer treats index 0 as the current role, which is
 * the near-universal resume convention).
 *
 * Returns an empty array when nothing dated can be read.
 */
export function extractExperienceFromText(text: string): DerivedExperience[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const roles: DerivedExperience[] = [];

  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(DATE_RANGE);
    if (!dateMatch) continue;

    // Walk back for the nearest line that looks like a role heading.
    let titleLine = '';
    for (let back = 1; back <= MAX_TITLE_LOOKBACK && i - back >= 0; back++) {
      const candidate = lines[i - back];
      if (isPlausibleTitleLine(candidate)) {
        titleLine = candidate;
        break;
      }
    }

    // The date line itself may carry the role ("Data Engineer | 2019 - 2021").
    if (!titleLine) {
      const withoutDates = lines[i].replace(DATE_RANGE, '').replace(/[|,–—-]\s*$/, '').trim();
      if (isPlausibleTitleLine(withoutDates)) {
        titleLine = withoutDates;
      }
    }

    if (!titleLine) continue;

    const { title, company } = splitTitleAndCompany(titleLine);

    // Collect the bullets that follow, until the next blank-line-separated block.
    const achievements: string[] = [];
    for (let ahead = i + 1; ahead < lines.length; ahead++) {
      const line = lines[ahead];
      if (BULLET.test(line)) {
        achievements.push(line.replace(BULLET, '').trim());
        continue;
      }
      if (!line.trim()) {
        if (achievements.length > 0) break;
        continue;
      }
      if (DATE_RANGE.test(line) || isPlausibleTitleLine(line)) break;
    }

    roles.push({
      title,
      company,
      location: '',
      startDate: dateMatch[1].trim(),
      endDate: dateMatch[2].trim(),
      achievements,
    });
  }

  return roles;
}

/**
 * Build the minimal OptimizedResume shape the analyzers need from plain text.
 *
 * Returns null when no dated role can be read, so callers fall back to today's
 * behavior instead of scoring against an invented structure.
 */
export function deriveResumeJsonFromText(text: string): OptimizedResume | null {
  const experience = extractExperienceFromText(text);
  if (experience.length === 0) return null;

  return {
    summary: '',
    contact: { name: '', email: '', phone: '', location: '' },
    skills: { technical: [], soft: [] },
    experience,
    education: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  };
}
