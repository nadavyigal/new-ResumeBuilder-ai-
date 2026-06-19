/**
 * Resolve structured job data for ATS scoring when parsed_data is incomplete.
 */

import type { JobExtraction } from './types';
import { extractJobData } from './extractors/jd-extractor';

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

export function buildJobDataFromExtractedJson(
  extracted: Record<string, unknown>,
  jobCleanText?: string,
): JobExtraction {
  const title = String(extracted.title || extracted.job_title || '');
  const company = String(extracted.company || extracted.company_name || '');
  let must_have = resolveMustHaveFromExtracted(extracted);
  let nice_to_have = resolveNiceToHaveFromExtracted(extracted);
  const responsibilities = normalizeStringList(extracted.responsibilities);

  const fallbackText =
    jobCleanText ||
    String(extracted.clean_text || extracted.raw_text || '');

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

  return {
    title,
    company,
    must_have,
    nice_to_have,
    responsibilities,
    seniority: String(extracted.seniority || ''),
    location: String(extracted.location || ''),
    industry: String(extracted.industry || ''),
    job_title: (extracted.job_title as string | null | undefined) ?? null,
    company_name: (extracted.company_name as string | null | undefined) ?? null,
    requirements: (extracted.requirements as string[] | string | null | undefined) ?? null,
  };
}

/**
 * Normalize scraper output so requirements is populated when only qualifications exist.
 */
export function normalizeParsedJobData<T extends Record<string, unknown>>(parsed: T): T {
  const requirements = normalizeStringList(parsed.requirements);
  if (requirements.length > 0) {
    return { ...parsed, requirements };
  }

  const merged = resolveMustHaveFromExtracted(parsed);
  if (merged.length === 0) {
    return parsed;
  }

  return {
    ...parsed,
    requirements: merged,
  };
}
