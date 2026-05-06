/**
 * POST /api/ats/score
 *
 * Score a resume against a job description using ATS v2 engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { scoreResume } from '@/lib/ats';
import type { ATSScoreInput } from '@/lib/ats/types';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { consumeCredit } from '@/lib/credits';

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

    const creditResult = await consumeCredit(supabase as any, user.id, 'ats_score');
    if (!creditResult.ok) {
      if (creditResult.status === 402) {
        return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 });
      }
      return NextResponse.json(
        { error: 'credit_consume_failed', details: creditResult.details },
        { status: 500 }
      );
    }

    // Score the resume with optional quick wins
    const result = await scoreResume(input, {
      generateQuickWins: generate_quick_wins === true,
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
