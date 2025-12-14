/**
 * POST /api/ats/score
 *
 * Score a resume against a job description using ATS v2 engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generalRateLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { scoreResume } from '@/lib/ats';
import type { ATSScoreInput } from '@/lib/ats/types';

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apply rate limiting (ATS scoring is an expensive operation)
    const rateLimitResult = await generalRateLimiter.check(user.id);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();

    // Validate payload size (prevent abuse)
    if (JSON.stringify(body).length > 500000) {
      return NextResponse.json(
        { error: 'Request payload too large. Maximum size is 500KB.' },
        { status: 413 }
      );
    }

    const { resume_original, resume_optimized, job_description, job_data } = body;

    // Validate required fields
    if (!resume_original || !resume_optimized || !job_description) {
      return NextResponse.json(
        { error: 'Missing required fields: resume_original, resume_optimized, job_description' },
        { status: 400 }
      );
    }

    // Prepare input
    const input: ATSScoreInput = {
      resume_original_text: typeof resume_original === 'string' ? resume_original : JSON.stringify(resume_original),
      resume_optimized_text: typeof resume_optimized === 'string' ? resume_optimized : JSON.stringify(resume_optimized),
      job_clean_text: job_description,
      job_extracted_json: job_data || {
        title: '',
        must_have: [],
        nice_to_have: [],
        responsibilities: [],
      },
      format_report: body.format_report,
      resume_original_json: typeof resume_original === 'object' ? resume_original : undefined,
      resume_optimized_json: typeof resume_optimized === 'object' ? resume_optimized : undefined,
    };

    // Score the resume
    const result = await scoreResume(input);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('ATS scoring error:', error);

    const err = error as Error;
    return NextResponse.json(
      {
        error: 'Failed to score resume',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
