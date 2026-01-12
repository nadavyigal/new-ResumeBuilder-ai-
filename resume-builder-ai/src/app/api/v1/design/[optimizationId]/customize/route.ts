/**
 * API Route: POST /api/v1/design/[optimizationId]/customize
 * AI-powered design customization through natural language
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T031
 * Test: tests/contract/design-customization.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

import { validateAndApply } from '@/lib/design-manager/customization-engine';
import type { CustomizationResult } from '@/lib/design-manager/customization-engine';
import { getDesignAssignment, updateDesignCustomization } from '@/lib/supabase/resume-designs';
import { getDesignTemplateById } from '@/lib/supabase/design-templates';
import {
  createDesignCustomization,
  getDesignCustomizationById
} from '@/lib/supabase/design-customizations';

/**
 * POST /api/v1/design/[optimizationId]/customize
 * Applies design customization based on natural language request
 *
 * Request Body:
 * {
 *   "changeRequest": "make the headers dark blue"
 * }
 *
 * Response: 200 OK (success)
 * {
 *   "customization": {...},
 *   "reasoning": "Applied dark blue color to headers",
 *   "preview": "<!DOCTYPE html>..."
 * }
 *
 * Response: 400 Bad Request (ATS violation, unclear request, fabrication)
 * {
 *   "error": "ats_violation" | "unclear_request" | "fabrication",
 *   "message": "...",
 *   "validationErrors": [...],
 *   "clarificationNeeded": "..."
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ optimizationId: string }> }
) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const optimizationId = params.optimizationId;

    // Parse request body
    const body = await request.json();
    const { changeRequest } = body;

    if (!changeRequest || typeof changeRequest !== 'string') {
      return NextResponse.json(
        { error: 'changeRequest is required and must be a string' },
        { status: 400 }
      );
    }

    // Verify optimization belongs to user and fetch resume data
    const { data: optimization, error: optimizationError } = await supabase
      .from('optimizations')
      .select(
        `
        *,
        resumes (parsed_data)
      `
      )
      .eq('id', optimizationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (optimizationError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    const resumeData = (optimization as any).resumes?.parsed_data || {};

    // Get design assignment
    const assignment = await getDesignAssignment(supabase, optimizationId, user.id);

    if (!assignment) {
      return NextResponse.json(
        { error: 'No design assigned. Please assign a template first.' },
        { status: 404 }
      );
    }

    // Get template details
    const template = await getDesignTemplateById(supabase, assignment.template_id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 500 }
      );
    }

    // Get current customization if exists
    let currentCustomization = null;
    if (assignment.customization_id) {
      currentCustomization = await getDesignCustomizationById(
        assignment.customization_id,
        user.id
      );
    }

    // Use template defaults if no customization exists
    const currentConfig = currentCustomization || {
      color_scheme: template.default_config.color_scheme,
      font_family: template.default_config.font_family,
      spacing_settings: template.default_config.spacing_settings,
      custom_css: ''
    };

    // Apply customization using AI
    const result = await validateAndApply(
      changeRequest,
      template.slug,
      currentConfig,
      resumeData
    );

    // Check if interpretation failed
    if ('understood' in result && !result.understood) {
      return NextResponse.json(
        {
          error: 'unclear_request',
          message: result.clarificationNeeded || 'Unable to process request',
          clarificationNeeded: result.clarificationNeeded,
        },
        { status: 400 }
      );
    }

    const customizationResult = result as CustomizationResult;

    // Create new customization record
    const newCustomization = await createDesignCustomization(user.id, {
      color_scheme: customizationResult.customization.color_scheme,
      font_family: customizationResult.customization.font_family,
      spacing: customizationResult.customization.spacing,
      custom_css: customizationResult.customization.custom_css,
      is_ats_safe: customizationResult.customization.is_ats_safe
    });

    // Update assignment with new customization (save previous for undo)
    await updateDesignCustomization(
      supabase,
      assignment.id,
      newCustomization.id,
      assignment.customization_id // Save current as previous for undo
    );

    return NextResponse.json(
      {
        customization: newCustomization,
        reasoning: customizationResult.reasoning,
        preview: customizationResult.preview
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error applying design customization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
