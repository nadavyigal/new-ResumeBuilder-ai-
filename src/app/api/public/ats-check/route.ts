import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/pdf-parser';
import { scoreResume } from '@/lib/ats';
import type { ATSScoreInput, JobExtraction } from '@/lib/ats/types';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limiting/check-rate-limit';
import { getClientIP } from '@/lib/rate-limiting/get-client-ip';
import { hashContent } from '@/lib/utils/hash-content';
import { isPdfUpload } from '@/lib/utils/pdf-validation';
import { scrapeJobDescription } from '@/lib/job-scraper';
import { extractJob } from '@/lib/scraper/jobExtractor';
import type { ExtractedJobData } from '@/lib/scraper/jobExtractor';
import {
  buildPublicAtsCheckResponse,
  type FitSource,
} from '@/lib/ats/public-ats-check-response';
import { PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS } from '@/lib/ats/public-ats-check-constants';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FREE_CHECKS = 5;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_JOB_DATA: JobExtraction = {
  title: '',
  must_have: [],
  nice_to_have: [],
  responsibilities: [],
};

const DEFAULT_FORMAT_REPORT = {
  has_tables: false,
  has_images: false,
  has_headers_footers: false,
  has_nonstandard_fonts: false,
  has_odd_glyphs: false,
  has_multi_column: false,
  format_safety_score: 70,
  issues: [],
};

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const sessionHeader = request.headers.get('x-session-id');
  const sessionId = sessionHeader && sessionHeader.trim().length > 0
    ? sessionHeader
    : crypto.randomUUID();

  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(ip, 'ats-check', {
      maxRequests: MAX_FREE_CHECKS,
      windowMs: WINDOW_MS,
    });
  } catch (error: any) {
    console.error('Rate limit error:', error);
    return NextResponse.json({ error: 'Rate limit check failed' }, { status: 500 });
  }

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        resetAt: rateLimitResult.resetAt.toISOString(),
        sessionId,
      },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const resumeFile = formData.get('resume');
  const resumeIdRaw = formData.get('resumeId') ?? formData.get('resume_id');
  const jobDescriptionRaw = formData.get('jobDescription');
  const jobDescriptionUrlRaw = formData.get('jobDescriptionUrl');
  const resumeId = typeof resumeIdRaw === 'string' ? resumeIdRaw.trim() : '';

  let jobDescription = typeof jobDescriptionRaw === 'string' ? jobDescriptionRaw.trim() : '';
  const jobDescriptionUrl = typeof jobDescriptionUrlRaw === 'string' ? jobDescriptionUrlRaw.trim() : '';
  const hasUrlInput = Boolean(jobDescriptionUrl);

  if (!jobDescription && jobDescriptionUrl) {
    try {
      jobDescription = await resolveJobDescriptionFromUrl(jobDescriptionUrl);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || 'Unable to fetch job description from URL.' },
        { status: 400 }
      );
    }
  }

  if (!jobDescription) {
    return NextResponse.json({ error: 'Job description is required.' }, { status: 400 });
  }

  const wordCount = countWords(jobDescription);
  if (wordCount < PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS && !hasUrlInput) {
    return NextResponse.json(
      { error: `Please paste the full job description (at least ${PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS} words).` },
      { status: 400 }
    );
  }

  let resumeText = '';
  if (resumeId) {
    const authSupabase = await createRouteHandlerClient(request);
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: resumeData, error: resumeError } = await authSupabase
      .from('resumes')
      .select('raw_text')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (resumeError) {
      console.error('Resume lookup error:', resumeError);
      return NextResponse.json({ error: 'Failed to load resume.' }, { status: 500 });
    }

    if (!resumeData) {
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
    }

    resumeText = (resumeData as { raw_text?: string | null }).raw_text?.trim() || '';
  } else {
    if (!(resumeFile instanceof File)) {
      return NextResponse.json({ error: 'Resume file is required.' }, { status: 400 });
    }

    if (resumeFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Resume file must be under 10MB.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
    if (!isPdfUpload(resumeFile, fileBuffer)) {
      return NextResponse.json({ error: 'Only PDF resumes are supported.' }, { status: 400 });
    }

    let pdfData;
    try {
      pdfData = await parsePdf(fileBuffer);
    } catch (error) {
      console.error('PDF parse error:', error);
      return NextResponse.json(
        { error: 'We could not read your resume. Try exporting it as a text-based PDF.' },
        { status: 400 }
      );
    }
    resumeText = pdfData?.text?.trim() || '';
  }

  if (!resumeText) {
    return NextResponse.json(
      { error: 'We could not read your resume. Try exporting it as a text-based PDF.' },
      { status: 400 }
    );
  }

  const resumeHash = hashContent(resumeText);
  const jobHash = hashContent(jobDescription);
  const supabase = createServiceRoleClient();

  // Extract job data from job description for better quick wins
  let jobData: JobExtraction = DEFAULT_JOB_DATA;
  try {
    const extractedJob = await extractJob(jobDescription);
    const requirements = extractedJob.requirements || [];
    if (requirements.length > 0) {
      jobData = {
        title: extractedJob.job_title || '',
        must_have: requirements,
        nice_to_have: extractedJob.nice_to_have || [],
        responsibilities: extractedJob.responsibilities || [],
      };
      console.log('✅ Extracted job data:', {
        title: jobData.title,
        must_have_count: jobData.must_have.length,
        nice_to_have_count: jobData.nice_to_have.length,
      });
    }
  } catch (error) {
    console.error('Job extraction failed, using defaults:', error);
    // Continue with DEFAULT_JOB_DATA
  }

  const { data: cachedScore, error: cacheError } = await supabase
    .from('anonymous_ats_scores')
    .select('*')
    .eq('session_id', sessionId)
    .eq('resume_hash', resumeHash)
    .eq('job_description_hash', jobHash)
    .gt('created_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) {
    console.error('Cache lookup error:', cacheError);
  }

  if (cachedScore) {
    return NextResponse.json(formatResponse(cachedScore, sessionId, rateLimitResult.remaining, {
      resumeText,
      jobData,
      jobDescription,
    }));
  }

  const atsInput: ATSScoreInput = {
    resume_original_text: resumeText,
    resume_optimized_text: resumeText,
    job_clean_text: jobDescription,
    job_extracted_json: jobData,
    format_report: DEFAULT_FORMAT_REPORT,
  };

  const scoreResult = await scoreResume(atsInput, {
    generateQuickWins: true, // Enable Quick Wins for free ATS checker
  });

  const baseScoreRow = {
    session_id: sessionId,
    ip_address: ip,
    ats_score: scoreResult.ats_score_optimized,
    ats_subscores: scoreResult.subscores,
    ats_suggestions: scoreResult.suggestions,
    ats_quick_wins: scoreResult.quick_wins || [], // Save quick wins
    resume_hash: resumeHash,
    job_description_hash: jobHash,
  };

  // WP-49: retained only so signup can carry the check into the new account;
  // cleared on conversion, expired otherwise.
  const carryoverColumns = {
    resume_text: resumeText,
    job_description_text: jobDescription,
    job_title: jobData.title || null,
    job_source_url: jobDescriptionUrl || null,
  };

  let { data: insertedScore, error: insertError } = await supabase
    .from('anonymous_ats_scores')
    .insert({ ...baseScoreRow, ...carryoverColumns })
    .select('*')
    .single();

  // If migration 20260720000000 has not been applied yet, fall back to the
  // score-only row rather than failing the whole free check. The user loses the
  // artifact carryover, not the product. Ref: WP-39, where code shipped ahead
  // of an unapplied migration and silently broke the write path.
  if (insertError && isUndefinedColumnError(insertError)) {
    console.error(
      'Anonymous carryover columns missing — apply migration 20260720000000. Falling back to score-only insert.',
      insertError,
    );
    ({ data: insertedScore, error: insertError } = await supabase
      .from('anonymous_ats_scores')
      .insert(baseScoreRow)
      .select('*')
      .single());
  }

  if (insertError || !insertedScore) {
    console.error('Anonymous score insert error:', insertError);
    return NextResponse.json({ error: 'Failed to save ATS score.' }, { status: 500 });
  }

  return NextResponse.json(formatResponse(insertedScore, sessionId, rateLimitResult.remaining, {
    resumeText,
    jobData,
    jobDescription,
  }));
}

export function formatResponse(score: any, sessionId: string, remaining: number, fitSource?: FitSource) {
  return buildPublicAtsCheckResponse(score, sessionId, remaining, fitSource);
}

// Postgres 42703 = undefined_column. PostgREST also reports the schema-cache
// miss as PGRST204 before the cache reloads.
function isUndefinedColumnError(error: { code?: string | null } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeJobUrl(rawUrl: string) {
  const trimmed = rawUrl
    .trim()
    // Strip directional marks or other invisible characters that can appear in mobile copy/paste.
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");

  if (!trimmed) {
    throw new Error('Job description URL is required.');
  }

  const withProtocol = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    // Fall back to the raw value so downstream extraction can attempt to use it.
    return withProtocol;
  }
}

function buildJobDescriptionFromExtracted(extracted: ExtractedJobData) {
  const parts: string[] = [];
  if (extracted.job_title) parts.push(`Job Title: ${extracted.job_title}`);
  if (extracted.company_name) parts.push(`Company: ${extracted.company_name}`);
  if (extracted.location) parts.push(`Location: ${extracted.location}`);
  if (extracted.about_this_job) parts.push(`About: ${extracted.about_this_job}`);
  if (extracted.requirements?.length) parts.push(`Requirements: ${extracted.requirements.join('; ')}`);
  if (extracted.responsibilities?.length) {
    parts.push(`Responsibilities: ${extracted.responsibilities.join('; ')}`);
  }
  if (extracted.qualifications?.length) {
    parts.push(`Qualifications: ${extracted.qualifications.join('; ')}`);
  }
  return parts.join('\n').trim();
}

async function resolveJobDescriptionFromUrl(rawUrl: string) {
  const normalizedUrl = normalizeJobUrl(rawUrl);

  let extractedText = '';
  try {
    const extracted = await extractJob(normalizedUrl);
    extractedText = buildJobDescriptionFromExtracted(extracted);
  } catch {
    extractedText = '';
  }

  if (countWords(extractedText) >= PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS) {
    return extractedText;
  }

  try {
    const scraped = await scrapeJobDescription(normalizedUrl);
    if (scraped && scraped.trim().length > 0) {
      return scraped.trim();
    }
  } catch {
    // Fall through to error below.
  }

  if (extractedText) {
    return extractedText;
  }

  return `Job Posting URL: ${normalizedUrl}`;
}
