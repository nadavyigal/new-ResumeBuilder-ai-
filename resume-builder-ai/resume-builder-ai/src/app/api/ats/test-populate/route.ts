/**
 * ATS v2 Test Populate Endpoint
 *
 * Adds sample ATS v2 data to an existing optimization for testing
 * DELETE THIS FILE after testing!
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { optimization_id } = await request.json();

    if (!optimization_id) {
      return NextResponse.json(
        { error: 'optimization_id required' },
        { status: 400 }
      );
    }

    // Initialize Supabase with service role key for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not set' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Sample ATS v2 data
    const sampleData = {
      ats_version: 2,
      ats_score_original: 45,
      ats_score_optimized: 78,
      ats_confidence: 0.85,
      ats_subscores: {
        keyword_exact: 72,
        keyword_phrase: 68,
        semantic_relevance: 85,
        title_alignment: 80,
        metrics_presence: 65,
        section_completeness: 90,
        format_parseability: 95,
        recency_fit: 75,
      },
      ats_subscores_original: {
        keyword_exact: 35,
        keyword_phrase: 30,
        semantic_relevance: 45,
        title_alignment: 40,
        metrics_presence: 25,
        section_completeness: 60,
        format_parseability: 70,
        recency_fit: 55,
      },
      ats_suggestions: [
        {
          id: 'kw_001',
          text: 'Add exact term "TypeScript" to Skills and latest role achievements',
          estimated_gain: 8,
          quick_win: true,
          category: 'keywords',
          targets: ['skills', 'experience'],
        },
        {
          id: 'kw_002',
          text: 'Include 3 missing must-have keywords: React, Node.js, GraphQL',
          estimated_gain: 12,
          quick_win: false,
          category: 'keywords',
          targets: ['skills', 'experience'],
        },
        {
          id: 'fmt_001',
          text: 'Switch to ATS-safe template (single column, no graphics)',
          estimated_gain: 15,
          quick_win: true,
          category: 'formatting',
          targets: ['template'],
        },
        {
          id: 'met_001',
          text: 'Add quantifiable metrics to latest 2 roles (e.g., "Improved performance by 40%")',
          estimated_gain: 10,
          quick_win: false,
          category: 'metrics',
          targets: ['experience'],
        },
        {
          id: 'kp_001',
          text: 'Include phrase "full-stack development" in your summary and experience',
          estimated_gain: 7,
          quick_win: true,
          category: 'keywords',
          targets: ['summary', 'experience'],
        },
      ],
    };

    // Update the optimization
    const { data, error } = await supabase
      .from('optimizations')
      .update(sampleData)
      .eq('id', optimization_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update optimization', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ATS v2 test data populated successfully',
      optimization_id,
      data: sampleData,
    });

  } catch (error: any) {
    console.error('Error in test-populate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
