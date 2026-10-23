/**
 * POST /api/ats/score
 *
 * Score a resume against a job description using ATS v2 engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { scoreResume } from '@/lib/ats';
import type { ATSScoreInput } from '@/lib/ats/types';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';
import { generateQuickWins } from '@/lib/ats/quick-wins/generator';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      resume_original,
      resume_optimized,
      job_description,
      job_data,
      generate_quick_wins // NEW: optional flag
    } = body;

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

    // Credits are export credits only (StoreKit spec section 11, step 3), so
    // this route never spends one. This is the only cap on OpenAI spend here.
    const rateResult = checkRateLimit(`ats-score:${user.id}`, RATE_LIMITS.ai);
    if (!rateResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rateResult.resetTime - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down and try again shortly.' },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateResult),
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMITS.ai.maxRequests.toString(),
          },
        }
      );
    }

    // Score the resume with optional quick wins. The generator is injected
    // rather than imported by the scorer — it reaches posthog-node, and
    // core.ts is transitively imported by a client page (WP-58).
    const result = await scoreResume(input, {
      ...(generate_quick_wins === true ? { quickWinsGenerator: generateQuickWins } : {}),
    });

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
