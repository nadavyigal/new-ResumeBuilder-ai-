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

type DirectCustomizationInput = {
  spacing?: unknown;
  accentColor?: unknown;
  accent_color?: unknown;
  fontStyle?: unknown;
  font_style?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return `#${trimmed.toUpperCase()}`;
}

function fontFamilyFor(style: unknown) {
  switch (typeof style === 'string' ? style.toLowerCase() : '') {
    case 'classic':
      return { heading: 'Georgia', body: 'Georgia' };
    case 'minimal':
      return { heading: 'System UI', body: 'System UI' };
    case 'modern':
    default:
      return { heading: 'Inter', body: 'Inter' };
  }
}

function spacingFor(value: unknown) {
  const spacing = typeof value === 'number' && Number.isFinite(value) ? value : 0.5;
  if (spacing < 0.34) return { section_gap: '10px', line_height: '1.35' };
  if (spacing > 0.67) return { section_gap: '22px', line_height: '1.65' };
  return { section_gap: '16px', line_height: '1.5' };
}

function buildDirectCustomization(input: unknown, currentConfig: any) {
  const source = asRecord((asRecord(input)?.customization ?? input) as unknown) as DirectCustomizationInput | null;
  if (!source) return null;

  const hasDirectFields =
    source.spacing !== undefined ||
    source.accentColor !== undefined ||
    source.accent_color !== undefined ||
    source.fontStyle !== undefined ||
    source.font_style !== undefined;

  if (!hasDirectFields) return null;

  const accent = normalizeHexColor(source.accentColor ?? source.accent_color);
  const currentColors = currentConfig?.color_scheme ?? {};
  const currentFonts = currentConfig?.font_family ?? {};
  const currentSpacing = currentConfig?.spacing ?? {};
  const fonts = source.fontStyle !== undefined || source.font_style !== undefined
    ? fontFamilyFor(source.fontStyle ?? source.font_style)
    : currentFonts;

  return {
    color_scheme: {
      primary: accent ?? currentColors.primary ?? '#111827',
      secondary: currentColors.secondary ?? '#4B5563',
      accent: accent ?? currentColors.accent ?? currentColors.primary ?? '#6366F1',
      background: currentColors.background ?? '#FFFFFF',
      text: currentColors.text ?? '#111827',
    },
    font_family: {
      heading: fonts.heading ?? 'Inter',
      body: fonts.body ?? 'Inter',
    },
    spacing: source.spacing !== undefined
      ? spacingFor(source.spacing)
      : {
          section_gap: currentSpacing.section_gap ?? '16px',
          line_height: currentSpacing.line_height ?? '1.5',
        },
    custom_css: currentConfig?.custom_css ?? '',
    is_ats_safe: currentConfig?.is_ats_safe !== false,
  };
}

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
    const hasNaturalLanguageRequest = typeof changeRequest === 'string' && changeRequest.trim().length > 0;
    const directCustomization = buildDirectCustomization(body, null);

    if (!hasNaturalLanguageRequest && !directCustomization) {
      return NextResponse.json(
        { error: 'changeRequest or direct customization is required' },
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
        supabase,
        assignment.customization_id,
      );
    }

    // Use template defaults if no customization exists
    const currentConfig = currentCustomization || {
      color_scheme: template.default_config.color_scheme,
      font_family: template.default_config.font_family,
      spacing_settings: template.default_config.spacing_settings,
      custom_css: ''
    };

    const structuredCustomization = buildDirectCustomization(body, currentConfig);
    if (structuredCustomization) {
      const newCustomization = await createDesignCustomization(supabase, user.id, {
        template_id: assignment.template_id,
        ...structuredCustomization
      });
      await updateDesignCustomization(
        supabase,
        assignment.id,
        newCustomization.id,
        assignment.customization_id
      );

      return NextResponse.json(
        {
          success: true,
          customization: newCustomization,
          reasoning: 'Applied selected iOS design controls.'
        },
        { status: 200 }
      );
    }

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
    const newCustomization = await createDesignCustomization(supabase, user.id, {
      template_id: assignment.template_id,
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
