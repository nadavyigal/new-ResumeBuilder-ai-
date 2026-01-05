/**
 * API Route: Render Template Preview
 *
 * POST /api/v1/design/render-preview
 * Body: { templateId: string, resumeData: any, customization?: any, languagePreference?: string }
 * Returns: HTML string
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderDesignPreviewHtml } from '@/lib/design-manager/render-preview-html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, resumeData, customization, languagePreference } = body || {};

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    if (!resumeData) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    const html = renderDesignPreviewHtml({
      templateId,
      resumeData,
      customization,
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

