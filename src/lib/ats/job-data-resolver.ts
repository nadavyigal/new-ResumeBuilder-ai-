/**
 * Resolve structured job data for ATS scoring when parsed_data is incomplete.
 */

import type { JobExtraction } from './types';
import { extractJobData } from './extractors/jd-extractor';
import { extractSkillPhrases } from './extractors/skill-phrase-extractor';
import type { ExtractedJobData } from '@/lib/scraper/jobExtractor';

export function toParsedJobRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function mergeUniqueLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const list of lists) {
    for (const item of list) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
  }

  return merged;
}

export function resolveMustHaveFromExtracted(extracted: Record<string, unknown>): string[] {
  const requirements = normalizeStringList(extracted.requirements);
  if (requirements.length > 0) {
    return requirements;
  }

  return mergeUniqueLists(
    normalizeStringList(extracted.qualifications),
    normalizeStringList(extracted.responsibilities),
    normalizeStringList(extracted.must_have),
  );
}

export function resolveNiceToHaveFromExtracted(extracted: Record<string, unknown>): string[] {
  return normalizeStringList(extracted.nice_to_have);
}

export function preferJobDescriptionText(jd: {
  raw_text?: string | null;
  clean_text?: string | null;
}): string {
  const raw = (jd.raw_text || '').trim();
  const clean = (jd.clean_text || '').trim();

  if (clean.length > raw.length) {
    return clean;
  }

  return raw || clean;
}

export function buildJobDescriptionTextFromParsed(parsed: unknown): string {
  const record = toParsedJobRecord(parsed);
  const parts: string[] = [];

  const title = record.job_title || record.title;
  const company = record.company_name || record.company;
  if (title) parts.push(`Job Title: ${title}`);
  if (company) parts.push(`Company: ${company}`);
  if (record.location) parts.push(`Location: ${String(record.location)}`);
  if (record.about_this_job) parts.push(`About: ${String(record.about_this_job)}`);

  const requirements = normalizeStringList(record.requirements);
  const qualifications = normalizeStringList(record.qualifications);
  const responsibilities = normalizeStringList(record.responsibilities);
  const niceToHave = normalizeStringList(record.nice_to_have);

  if (requirements.length > 0) {
    parts.push(`Requirements: ${requirements.join('; ')}`);
  } else if (qualifications.length > 0) {
    parts.push(`Qualifications: ${qualifications.join('; ')}`);
  }
  if (responsibilities.length > 0) {
    parts.push(`Responsibilities: ${responsibilities.join('; ')}`);
  }
  if (niceToHave.length > 0) {
    parts.push(`Nice to have: ${niceToHave.join('; ')}`);
  }

  return parts.join('\n').trim();
}

/** Pick the richest JD text available for scoring (persisted jd_text > clean > raw > parsed). */
export function resolveJobDescriptionText(input: {
  raw_text?: string | null;
  clean_text?: string | null;
  parsed_data?: unknown;
  jd_text?: string | null;
}): string {
  const candidates = [
    (input.jd_text || '').trim(),
    (input.clean_text || '').trim(),
    (input.raw_text || '').trim(),
    buildJobDescriptionTextFromParsed(input.parsed_data),
  ].filter((value) => value.length > 0);

  return candidates.reduce(
    (longest, current) => (current.length > longest.length ? current : longest),
    '',
  );
}

export function buildParsedDataFromPlainText(
  text: string,
  meta?: { jobTitle?: string | null; company?: string | null; sourceUrl?: string | null },
): ExtractedJobData {
  const trimmed = text.trim();
  const fromText = extractJobData(trimmed, {
    title: meta?.jobTitle || undefined,
    company: meta?.company || undefined,
  });

  let sourceDomain = 'manual';
  if (meta?.sourceUrl) {
    try {
      sourceDomain = new URL(meta.sourceUrl).hostname;
    } catch {
      sourceDomain = 'manual';
    }
  }

  return normalizeParsedJobData({
    source_url: meta?.sourceUrl || '',
    source_domain: sourceDomain,
    scraped_at: new Date().toISOString(),
    company_name: meta?.company || fromText.company || null,
    job_title: meta?.jobTitle || fromText.title || null,
    contact_person: null,
    location: fromText.location || null,
    employment_type: null,
    seniority: fromText.seniority || null,
    compensation: null,
    about_this_job: trimmed.length <= 4000 ? trimmed : trimmed.slice(0, 4000),
    requirements: fromText.must_have.length > 0 ? fromText.must_have : null,
    qualifications: fromText.must_have.length > 0 ? fromText.must_have : null,
    responsibilities: fromText.responsibilities.length > 0 ? fromText.responsibilities : null,
    nice_to_have: fromText.nice_to_have.length > 0 ? fromText.nice_to_have : null,
    benefits: null,
    application_instructions: null,
    posting_id: null,
    provenance: { source: 'plain_text' },
    summary_for_ui: {
      company_name: meta?.company || fromText.company || null,
      job_title: meta?.jobTitle || fromText.title || null,
      contact_person: null,
      location: fromText.location || null,
    },
  });
}

export function buildJobDataFromExtractedJson(
  extracted: unknown,
  jobCleanText?: string,
): JobExtraction {
  const record = toParsedJobRecord(extracted);
  const title = String(record.title || record.job_title || '');
  const company = String(record.company || record.company_name || '');
  let must_have = resolveMustHaveFromExtracted(record);
  let nice_to_have = resolveNiceToHaveFromExtracted(record);
  const responsibilities = normalizeStringList(record.responsibilities);

  const fallbackText =
    jobCleanText ||
    String(record.clean_text || record.raw_text || '');

  if (must_have.length === 0 && fallbackText) {
    const fromText = extractJobData(fallbackText, {
      title,
      company,
      must_have: [],
      nice_to_have: [],
      responsibilities,
    });
    must_have = fromText.must_have;
    if (nice_to_have.length === 0) {
      nice_to_have = fromText.nice_to_have;
    }
  }

  const atomizedMustHave = extractSkillPhrases(must_have);
  if (atomizedMustHave.length > 0) {
    must_have = atomizedMustHave;
  }

  const atomizedNiceToHave = extractSkillPhrases(nice_to_have);
  if (atomizedNiceToHave.length > 0) {
    nice_to_have = atomizedNiceToHave;
  }

  return {
    title,
    company,
    must_have,
    nice_to_have,
    responsibilities,
    seniority: String(record.seniority || ''),
    location: String(record.location || ''),
    industry: String(record.industry || ''),
    job_title: (record.job_title as string | null | undefined) ?? null,
    company_name: (record.company_name as string | null | undefined) ?? null,
    requirements: (record.requirements as string[] | string | null | undefined) ?? null,
  };
}

/**
 * Normalize scraper output so requirements is populated when only qualifications exist.
 */
export function normalizeParsedJobData(parsed: ExtractedJobData): ExtractedJobData {
  const requirements = normalizeStringList(parsed.requirements);
  if (requirements.length > 0) {
    return { ...parsed, requirements };
  }

  const merged = resolveMustHaveFromExtracted(toParsedJobRecord(parsed));
  if (merged.length === 0) {
    return parsed;
  }

  return {
    ...parsed,
    requirements: merged,
  };
}
