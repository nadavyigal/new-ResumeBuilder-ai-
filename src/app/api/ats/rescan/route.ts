/**
 * POST /api/ats/rescan
 *
 * Re-scan an existing optimization with ATS v2 scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { rescoreOptimization, SCORE_VERSION } from '@/lib/ats';
import { logger } from '@/lib/agent/utils/logger';

export async function POST(request: NextRequest) {
  let optimizationId: string | null = null;
  try {
    const supabase = await createRouteHandlerClient(request);

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { optimization_id } = body;
    optimizationId = optimization_id;

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
      .maybeSingle();

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
    const jobData = optimization.job_descriptions?.parsed_data || null;

    // Re-score using ATS v2
    const result = await rescoreOptimization({
      resume_original: resumeOriginal,
      resume_optimized: resumeOptimized,
      job_description: jobDescription,
      job_data: jobData,
    });

    // The baseline is NOT updated here, and this is the whole point of the
    // route's behaviour changing.
    //
    // This endpoint used to write `ats_score_original` on every rescan, which
    // made it a fourth writer of the one number that must never move. The
    // sequence in production on 2026-07-27: accept correctly stored the
    // baseline the fit check had shown (51), the app rescanned moments later,
    // and this update overwrote it with a fresh reading of the same untouched
    // original (43). WP-45 D8 fixed the other three writers and this one kept
    // moving the number underneath them, which is why the stored baseline still
    // disagreed with the fit check after that deploy.
    //
    // A rescan re-measures what the CURRENT resume is worth. It has no claim on
    // where the user started: nothing they did changed the original document,
    // so nothing may change its score. The fresh original reading is returned
    // for diagnostics but never persisted.
    const existingBaseline = optimization.ats_score_original;
    const baselineMoved =
      typeof existingBaseline === 'number' &&
      Math.round(existingBaseline) !== Math.round(result.ats_score_original);

    if (baselineMoved) {
      logger.warn('Rescan disagrees with the stored baseline; keeping the stored one', {
        optimizationId: optimization_id,
        stored: existingBaseline,
        rescanned: result.ats_score_original,
      });
    }

    const { error: updateError } = await supabase
      .from('optimizations')
      .update({
        ats_version: 2,
        score_version: result.metadata?.score_version ?? SCORE_VERSION,
        ats_score_optimized: result.ats_score_optimized,
        ats_subscores: result.subscores,
        ats_suggestions: result.suggestions,
        ats_confidence: result.confidence,
        match_score: result.ats_score_optimized,
      })
      .eq('id', optimization_id)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Report the stored baseline, not the one just measured, so the client and
    // the database cannot disagree about where the journey began.
    const baseline =
      typeof existingBaseline === 'number' ? existingBaseline : result.ats_score_original;

    return NextResponse.json({
      success: true,
      optimization_id,
      scores: {
        original: baseline,
        optimized: result.ats_score_optimized,
        improvement: result.ats_score_optimized - baseline,
      },
      suggestions_count: result.suggestions.length,
      confidence: result.confidence,
    });
  } catch (error: unknown) {
    logger.error('ATS rescan error', { optimizationId: optimizationId ?? undefined }, error);

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
