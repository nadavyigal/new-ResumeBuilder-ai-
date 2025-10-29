/**
 * POST /api/ats/rescan
 *
 * Re-scan an existing optimization with ATS v2 scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { rescoreOptimization } from '@/lib/ats';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { optimization_id } = body;

    if (!optimization_id) {
      return NextResponse.json(
        { error: 'Missing required field: optimization_id' },
        { status: 400 }
      );
    }

    // Fetch optimization data
    const { data: optimization, error: fetchError } = await supabase
      .from('optimizations')
      .select('*, resumes(*), job_descriptions(*)')
      .eq('id', optimization_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    // Extract necessary data
    const resumeOriginal = optimization.resumes?.raw_text || '';
    const resumeOptimized = optimization.rewrite_data || {};
    const jobDescription = optimization.job_descriptions?.raw_text || '';
    const jobData = optimization.job_descriptions?.extracted_data || null;

    // Re-score using ATS v2
    const result = await rescoreOptimization({
      resume_original: resumeOriginal,
      resume_optimized: resumeOptimized,
      job_description: jobDescription,
      job_data: jobData,
    });

    // Update optimization with new scores
    const { error: updateError } = await supabase
      .from('optimizations')
      .update({
        ats_version: 2,
        ats_score_original: result.ats_score_original,
        ats_score_optimized: result.ats_score_optimized,
        ats_subscores: result.subscores,
        ats_subscores_original: result.subscores_original,
        ats_suggestions: result.suggestions,
        ats_confidence: result.confidence,
        match_score: result.ats_score_optimized, // Update match_score too
      })
      .eq('id', optimization_id)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      optimization_id,
      scores: {
        original: result.ats_score_original,
        optimized: result.ats_score_optimized,
        improvement: result.ats_score_optimized - result.ats_score_original,
      },
      suggestions_count: result.suggestions.length,
      confidence: result.confidence,
    });
  } catch (error: unknown) {
    console.error('ATS rescan error:', error);

    const err = error as Error;
    return NextResponse.json(
      {
        error: 'Failed to rescan optimization',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
