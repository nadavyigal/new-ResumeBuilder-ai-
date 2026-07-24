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

/**
 * Sections whose date ranges are not employment. Graduation years and
 * certification dates otherwise parse as jobs, and because the recency analyzer
 * treats the first entry as the current role, a degree from 2016 can be read as
 * the candidate's present position.
 */
const NON_EMPLOYMENT_SECTION =
  /^(education|certifications?|licenses?|projects?|publications?|awards?|volunteering|courses?|training)\b/i;

/** Sections that contain employment. Re-entering one resumes parsing. */
const EMPLOYMENT_SECTION =
  /^(experience|work experience|professional experience|employment|career history|work history)\b/i;

const BULLET = /^\s*(?:[•·▪◦*\-–—]|\d+[.)])\s+/;

const MAX_TITLE_LOOKBACK = 3;
const MAX_ACHIEVEMENTS = 12;

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
 * Does this leftover text read like a job title rather than a location or a
 * stray fragment? Used to decide whether the date line carries its own role:
 * "Data Engineer | 2019 - 2021" does, "Tel Aviv | Jan 2022 - Present" does not.
 */
function isRoleLike(text: string): boolean {
  if (!isPlausibleTitleLine(text)) return false;
  if (/\s+(?:at|@)\s+/i.test(text)) return true;
  return text.split(/\s+/).filter(Boolean).length >= 3;
}

/** Does a dated role begin within the next few non-blank lines? */
function startsNewRole(lines: string[], from: number): boolean {
  let seen = 0;
  for (let i = from; i < lines.length && seen < 3; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (NON_TITLE_LINE.test(trimmed)) return true;
    if (DATE_RANGE.test(lines[i])) return true;
    seen++;
  }
  return false;
}

/**
 * Collect what the person did in this role.
 *
 * Bulleted resumes are the easy case. Plain-prose resumes are common in PDF
 * exports, and treating every unbulleted line as the start of the next role
 * left achievements empty — which drove recency_fit toward 0, strictly worse
 * than the constant 50 it was meant to replace, because the only text left to
 * match against the job description was the title.
 */
function collectAchievements(lines: string[], dateLineIndex: number): string[] {
  const achievements: string[] = [];

  for (let ahead = dateLineIndex + 1; ahead < lines.length; ahead++) {
    if (achievements.length >= MAX_ACHIEVEMENTS) break;
    const line = lines[ahead];
    const trimmed = line.trim();

    // A new dated role, or a new section, ends this one.
    if (DATE_RANGE.test(line)) break;
    if (trimmed && !BULLET.test(line) && NON_TITLE_LINE.test(trimmed)) break;

    if (BULLET.test(line)) {
      achievements.push(line.replace(BULLET, '').trim());
      continue;
    }

    if (!trimmed) {
      // A blank line ends the role only when the next role starts right after.
      if (startsNewRole(lines, ahead + 1)) break;
      continue;
    }

    achievements.push(trimmed);
  }

  return achievements;
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
  let inNonEmploymentSection = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track which section we are in, so education and certification dates are
    // never read as jobs.
    if (trimmed && !BULLET.test(lines[i])) {
      if (NON_EMPLOYMENT_SECTION.test(trimmed)) {
        inNonEmploymentSection = true;
      } else if (EMPLOYMENT_SECTION.test(trimmed)) {
        inNonEmploymentSection = false;
      }
    }
    if (inNonEmploymentSection) continue;

    // A date range inside a bullet describes the work, it does not start a new
    // role: "Cut infra spend 30% across the 2019 - 2021 legacy stack" would
    // otherwise duplicate the role above it with the wrong end date.
    if (BULLET.test(lines[i])) continue;

    const dateMatch = lines[i].match(DATE_RANGE);
    if (!dateMatch) continue;

    // The date line may itself carry the role ("Data Engineer | 2019 - 2021").
    // Prefer it only when the leftover text actually looks like a role — a bare
    // "Tel Aviv" left over from "Tel Aviv | Jan 2022 - Present" does not.
    const residual = lines[i].replace(DATE_RANGE, '').replace(/[|,–—-]\s*$/, '').trim();
    let titleLine = isRoleLike(residual) ? residual : '';

    // Otherwise walk back for the nearest line that looks like a role heading.
    if (!titleLine) {
      for (let back = 1; back <= MAX_TITLE_LOOKBACK && i - back >= 0; back++) {
        const candidate = lines[i - back];
        if (isPlausibleTitleLine(candidate)) {
          titleLine = candidate;
          break;
        }
      }
    }

    if (!titleLine && isPlausibleTitleLine(residual)) titleLine = residual;
    if (!titleLine) continue;

    const { title, company } = splitTitleAndCompany(titleLine);

    roles.push({
      title,
      company,
      location: '',
      startDate: dateMatch[1].trim(),
      endDate: dateMatch[2].trim(),
      achievements: collectAchievements(lines, i),
    });
  }

  return roles;
}

/**
 * Build the minimal OptimizedResume shape the recency analyzer needs from
 * plain text.
 *
 * Returns null when no dated role can be read, so callers fall back to today's
 * behavior instead of scoring against an invented structure.
 *
 * The result must be passed as `recency_json`, never as `resume_json` — the
 * object has no summary, skills or education, and the analyzers that branch on
 * `resume_json` would read those empty fields as genuinely missing sections.
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
