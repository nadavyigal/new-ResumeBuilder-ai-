import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/pdf-parser';
import { scoreResume } from '@/lib/ats';
import type { ATSScoreInput } from '@/lib/ats/types';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limiting/check-rate-limit';
import { getClientIP } from '@/lib/rate-limiting/get-client-ip';
import { hashContent } from '@/lib/utils/hash-content';
import { scrapeJobDescription } from '@/lib/job-scraper';
import { extractJob } from '@/lib/scraper/jobExtractor';
import type { ExtractedJobData } from '@/lib/scraper/jobExtractor';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FREE_CHECKS = 5;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_JOB_DATA = {
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
  const jobDescriptionRaw = formData.get('jobDescription');
  const jobDescriptionUrlRaw = formData.get('jobDescriptionUrl');

  if (!(resumeFile instanceof File)) {
    return NextResponse.json({ error: 'Resume file is required.' }, { status: 400 });
  }

  if (resumeFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Resume file must be under 10MB.' }, { status: 400 });
  }

  const isPdf = resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return NextResponse.json({ error: 'Only PDF resumes are supported.' }, { status: 400 });
  }

  let jobDescription = typeof jobDescriptionRaw === 'string' ? jobDescriptionRaw.trim() : '';
  const jobDescriptionUrl = typeof jobDescriptionUrlRaw === 'string' ? jobDescriptionUrlRaw.trim() : '';

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
  if (wordCount < 100) {
    return NextResponse.json(
      { error: 'Please paste the full job description (at least 100 words).' },
      { status: 400 }
    );
  }

  const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
  const pdfData = await parsePdf(fileBuffer);
  const resumeText = pdfData?.text?.trim();

  if (!resumeText) {
    return NextResponse.json(
      { error: 'We could not read your resume. Try exporting it as a text-based PDF.' },
      { status: 400 }
    );
  }

  const resumeHash = hashContent(resumeText);
  const jobHash = hashContent(jobDescription);
  const supabase = createServiceRoleClient();

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
    return NextResponse.json(formatResponse(cachedScore, sessionId, rateLimitResult.remaining));
  }

  const atsInput: ATSScoreInput = {
    resume_original_text: resumeText,
    resume_optimized_text: resumeText,
    job_clean_text: jobDescription,
    job_extracted_json: DEFAULT_JOB_DATA,
    format_report: DEFAULT_FORMAT_REPORT,
  };

  const scoreResult = await scoreResume(atsInput);

  const { data: insertedScore, error: insertError } = await supabase
    .from('anonymous_ats_scores')
    .insert({
      session_id: sessionId,
      ip_address: ip,
      ats_score: scoreResult.ats_score_optimized,
      ats_subscores: scoreResult.subscores,
      ats_suggestions: scoreResult.suggestions,
      resume_hash: resumeHash,
      job_description_hash: jobHash,
    })
    .select('*')
    .single();

  if (insertError || !insertedScore) {
    console.error('Anonymous score insert error:', insertError);
    return NextResponse.json({ error: 'Failed to save ATS score.' }, { status: 500 });
  }

  return NextResponse.json(formatResponse(insertedScore, sessionId, rateLimitResult.remaining));
}

function formatResponse(score: any, sessionId: string, remaining: number) {
  const suggestions = Array.isArray(score.ats_suggestions) ? score.ats_suggestions : [];
  const topIssues = suggestions.slice(0, 3);

  return {
    success: true,
    sessionId,
    score: {
      overall: score.ats_score,
      timestamp: score.created_at,
    },
    preview: {
      topIssues,
      totalIssues: suggestions.length,
      lockedCount: Math.max(0, suggestions.length - 3),
    },
    checksRemaining: remaining,
  };
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeJobUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Job description URL is required.');
  }
  const withProtocol = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
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
  } catch (error) {
    extractedText = '';
  }

  if (countWords(extractedText) >= 100) {
    return extractedText;
  }

  try {
    const scraped = await scrapeJobDescription(normalizedUrl);
    if (scraped && scraped.trim().length > 0) {
      return scraped.trim();
    }
  } catch (error) {
    // Fall through to error below.
  }

  if (extractedText) {
    return extractedText;
  }

  throw new Error('Unable to extract a full job description from that URL. Please paste it instead.');
}
