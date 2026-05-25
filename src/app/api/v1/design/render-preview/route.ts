/**
 * API Route: Render Template Preview
 *
 * POST /api/v1/design/render-preview
 * Body: { templateId: string, resumeData?: any, optimizationId?: string, customization?: any, languagePreference?: string }
 *
 * Accepts either `resumeData` (full resume JSON) or `optimizationId` (fetches rewrite_data
 * from the database). The iOS app sends `optimizationId`; the web client sends `resumeData`.
 * Returns: HTML string
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  renderDesignPreviewHtml,
  type DesignCustomizationLike,
} from '@/lib/design-manager/render-preview-html';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { getDesignTemplateById, getDesignTemplateBySlug } from '@/lib/supabase/design-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function normalizePreviewCustomization(
  customization: unknown,
  defaultConfig?: any
): DesignCustomizationLike | undefined {
  const defaults = defaultConfig || {};
  const source =
    customization && typeof customization === 'object' && !Array.isArray(customization)
      ? (customization as Record<string, unknown>)
      : {};

  const defaultColors = defaults.color_scheme || {};
  const defaultFonts = defaults.font_family || {};
  const defaultSpacing = defaults.spacing || defaults.spacing_settings || {};

  const hasIosDirectFields =
    source.spacing !== undefined ||
    source.accentColor !== undefined ||
    source.accent_color !== undefined ||
    source.fontStyle !== undefined ||
    source.font_style !== undefined;

  if (hasIosDirectFields) {
    const accent = normalizeHexColor(source.accentColor ?? source.accent_color);
    const fonts =
      source.fontStyle !== undefined || source.font_style !== undefined
        ? fontFamilyFor(source.fontStyle ?? source.font_style)
        : defaultFonts;
    return {
      color_scheme: {
        primary: accent ?? defaultColors.primary ?? '#111827',
        secondary: defaultColors.secondary ?? '#4B5563',
        accent: accent ?? defaultColors.accent ?? defaultColors.primary ?? '#6366F1',
        background: defaultColors.background ?? '#FFFFFF',
        text: defaultColors.text ?? '#111827',
      },
      font_family: {
        heading: fonts.heading ?? 'Inter',
        body: fonts.body ?? 'Inter',
      },
      spacing:
        source.spacing !== undefined
          ? spacingFor(source.spacing)
          : {
              section_gap: defaultSpacing.section_gap ?? '16px',
              line_height: String(defaultSpacing.line_height ?? defaultSpacing.lineHeight ?? '1.5'),
            },
      custom_css: typeof source.custom_css === 'string' ? source.custom_css : defaults.custom_css || '',
    };
  }

  if (Object.keys(source).length > 0) {
    return {
      color_scheme: (source.color_scheme as DesignCustomizationLike['color_scheme']) ?? defaultColors,
      font_family: (source.font_family as DesignCustomizationLike['font_family']) ?? defaultFonts,
      spacing:
        (source.spacing as DesignCustomizationLike['spacing']) ?? {
          section_gap: defaultSpacing.section_gap ?? '16px',
          line_height: String(defaultSpacing.line_height ?? defaultSpacing.lineHeight ?? '1.5'),
        },
      custom_css: typeof source.custom_css === 'string' ? source.custom_css : defaults.custom_css || '',
    };
  }

  if (defaultConfig) {
    return {
      color_scheme: defaultColors,
      font_family: defaultFonts,
      spacing: {
        section_gap: defaultSpacing.section_gap ?? '16px',
        line_height: String(defaultSpacing.line_height ?? defaultSpacing.lineHeight ?? '1.5'),
      },
      custom_css: defaults.custom_css || '',
    };
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const templateId: string | undefined = body?.templateId ?? body?.template_id;
    const { customization, languagePreference } = body || {};
    // Accept both camelCase (web) and snake_case (iOS) for optimizationId
    let { resumeData } = body || {};
    const optimizationId: string | undefined = body?.optimizationId ?? body?.optimization_id;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const supabase = await createRouteHandlerClient();
    let resolvedTemplateId = templateId;
    let templateDefaultConfig: unknown;
    const templateById = await getDesignTemplateById(supabase, templateId).catch(() => null);
    const template = templateById || (await getDesignTemplateBySlug(supabase, templateId).catch(() => null));
    if (template) {
      resolvedTemplateId = `${template.category}-${template.slug || template.id}`;
      templateDefaultConfig = template.default_config;
    }

    // Resolve resumeData from optimizationId when the client sends an ID instead of raw data
    if (!resumeData && optimizationId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { data: row } = await supabase
        .from('optimizations')
        .select('rewrite_data')
        .eq('id', optimizationId)
        .eq('user_id', user.id)
        .maybeSingle();
      resumeData = row?.rewrite_data as OptimizedResume | undefined;
    }

    if (!resumeData) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    const normalizedCustomization = normalizePreviewCustomization(customization, templateDefaultConfig);
    const html = renderDesignPreviewHtml({
      templateId: resolvedTemplateId,
      resumeData,
      customization: normalizedCustomization,
      languagePreference,
      mode: 'preview',
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error rendering template preview:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview Error</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 40px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { color: #dc2626; }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Template Preview Error</h1>
  <p>Failed to render template preview.</p>
  <p><strong>Error:</strong> <code>${errorMessage}</code></p>
  <p>Please try again or select a different template.</p>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}
