/**
 * API Route: GET /api/v1/design/templates/[id]/preview
 * Generates HTML preview of a template with sample data
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T027
 * Test: tests/contract/design-templates.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

import { getDesignTemplateById } from '@/lib/supabase/design-templates';
// import { renderTemplateSample } from '@/lib/design-manager/template-renderer';

// Force dynamic rendering to prevent build-time static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/design/templates/[id]/preview
 * Returns HTML preview of template with sample resume data
 *
 * Path Parameters:
 * - id: Template UUID
 *
 * Response: 200 OK
 * Content-Type: text/html
 * (Full HTML document with rendered template)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    const templateId = params.id;

    // Fetch template from database
    const template = await getDesignTemplateById(supabase, templateId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if user has access to premium templates
    // TODO: Implement subscription check when premium feature is ready
    if (template.is_premium) {
      // For now, allow all users to preview premium templates
      // In production, check user subscription tier
    }

    // Render template with sample data
    // TODO: Implement renderTemplateSample function
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${template.name} Preview</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .preview-message { text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="preview-message">
    <h1>${template.name}</h1>
    <p>Template preview coming soon...</p>
    <p><small>Template ID: ${template.id}</small></p>
  </div>
</body>
</html>`;

    // Return HTML preview
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error generating template preview:', error);

    // Return error as HTML for better debugging
    const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Preview Error</title>
</head>
<body>
  <h1>Template Preview Error</h1>
  <p>Failed to generate preview. Please try again.</p>
  <p style="color: red;">${error instanceof Error ? error.message : 'Unknown error'}</p>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}
