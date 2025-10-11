/**
 * API Route: POST /api/v1/design/recommend
 * AI-powered template recommendation based on resume and job description
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T028
 * Test: tests/contract/design-recommend.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

import { recommendTemplate } from '@/lib/design-manager/design-recommender';
import { getDesignTemplateBySlug } from '@/lib/supabase/design-templates';

/**
 * POST /api/v1/design/recommend
 * Returns AI-recommended template based on resume content and job description
 *
 * Request Body:
 * {
 *   "optimizationId": "uuid"
 * }
 *
 * Response: 200 OK
 * {
 *   "recommendedTemplate": {
 *     "id": "uuid",
 *     "slug": "card-ssr",
 *     "name": "Card Layout",
 *     "reasoning": "Based on your creative background...",
 *     "confidence": 0.92
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { optimizationId } = body;

    if (!optimizationId) {
      return NextResponse.json(
        { error: 'optimizationId is required' },
        { status: 400 }
      );
    }

    // Fetch optimization with resume and job description data
    const { data: optimization, error: optimizationError } = await supabase
      .from('optimizations')
      .select(
        `
        *,
        resumes (parsed_data),
        job_descriptions (extracted_data)
      `
      )
      .eq('id', optimizationId)
      .eq('user_id', session.user.id)
      .single();

    if (optimizationError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    // Extract resume and job description data
    const resumeData = (optimization as any).resumes?.parsed_data || {};
    const jobDescriptionData = (optimization as any).job_descriptions?.extracted_data || {};
    const jobDescriptionText = jobDescriptionData.raw_text || jobDescriptionData.description || '';

    if (!resumeData || !jobDescriptionText) {
      return NextResponse.json(
        { error: 'Insufficient data for recommendation. Resume and job description required.' },
        { status: 400 }
      );
    }

    // Call AI recommendation engine
    const recommendation = await recommendTemplate(resumeData, jobDescriptionText);

    // Fetch full template details
    const template = await getDesignTemplateBySlug(supabase, recommendation.templateId);

    if (!template) {
      return NextResponse.json(
        { error: 'Recommended template not found in database' },
        { status: 500 }
      );
    }

    // Return recommendation with full template details
    return NextResponse.json(
      {
        recommendedTemplate: {
          id: template.id,
          slug: template.slug,
          name: template.name,
          description: template.description,
          category: template.category,
          is_premium: template.is_premium,
          preview_thumbnail_url: template.preview_thumbnail_url,
          ats_compatibility_score: template.ats_compatibility_score,
          reasoning: recommendation.reasoning,
          confidence: recommendation.confidence
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating template recommendation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
