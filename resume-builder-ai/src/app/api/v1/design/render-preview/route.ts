/**
 * API Route: Render Template Preview
 * Server-side rendering endpoint for external templates
 *
 * POST /api/v1/design/render-preview
 * Body: { templateId: string, resumeData: ResumeData, customization?: any }
 * Returns: HTML string
 */

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResumeData {
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    title?: string;
  };
  summary?: string;
  experience?: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    graduationDate: string;
    gpa?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
  }>;
}

/**
 * Transforms internal resume format to JSON Resume schema
 */
function transformToJsonResume(resumeData: any): any {
  const data = resumeData.content || resumeData;

  // Support both OptimizedResume format (contact.name) and legacy format (personalInfo.fullName)
  const name = data.contact?.name || data.personalInfo?.fullName || '';
  const email = data.contact?.email || data.personalInfo?.email || '';
  const phone = data.contact?.phone || data.personalInfo?.phone || '';
  const location = data.contact?.location || data.personalInfo?.location || '';
  const linkedin = data.contact?.linkedin || data.personalInfo?.linkedin || '';
  const portfolio = data.contact?.portfolio || data.personalInfo?.website || '';

  return {
    basics: {
      name: name,
      label: data.personalInfo?.title || '',
      email: email,
      phone: phone,
      website: portfolio,
      summary: data.summary || '',
      location: {
        address: '',
        postalCode: '',
        city: location,
        countryCode: '',
        region: ''
      },
      profiles: linkedin
        ? [
            {
              network: 'LinkedIn',
              username: '',
              url: linkedin
            }
          ]
        : []
    },
    summary: data.summary || '',
    work: (data.experience || []).map((exp: any) => ({
      name: exp.company || '',
      position: exp.title || exp.position || '',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      summary: exp.description || '',
      highlights: exp.achievements || []
    })),
    education: (data.education || []).map((edu: any) => ({
      institution: edu.institution || '',
      area: edu.degree || edu.field || '',
      studyType: edu.degree || edu.field || '',
      location: edu.location || '',
      startDate: '',
      endDate: edu.graduationDate || edu.endDate || '',
      gpa: edu.gpa || '',
      courses: []
    })),
    skills: [
      ...(data.skills?.technical || []).map((skill: string) => ({
        name: skill,
        level: 'Technical',
        keywords: []
      })),
      ...(data.skills?.soft || []).map((skill: string) => ({
        name: skill,
        level: 'Soft',
        keywords: []
      }))
    ],
    projects: (data.projects || []).map((project: any) => ({
      name: project.name || '',
      description: project.description || '',
      keywords: project.technologies || [],
      startDate: '',
      endDate: '',
      url: ''
    })),
    certificates: (data.certifications || []).map((cert: any) =>
      typeof cert === 'string'
        ? { name: cert, date: '', issuer: '', url: '' }
        : { name: cert.name || '', date: cert.date || '', issuer: cert.issuer || '', url: '' }
    )
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, resumeData, customization } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data is required' },
        { status: 400 }
      );
    }

    // Load template component dynamically
    const TemplateComponent = require(`@/lib/templates/external/${templateId}/Resume.jsx`).default;

    if (!TemplateComponent) {
      return NextResponse.json(
        { error: `Template component not found: ${templateId}` },
        { status: 404 }
      );
    }

    // Transform data to JSON Resume format
    const jsonResume = transformToJsonResume(resumeData);

    // Create props for template
    const props = {
      data: jsonResume,
      customization: customization || {}
    };

    // Server-side render the template
    const ReactDOMServer = require('react-dom/server');
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(TemplateComponent, props)
    );

    // Return HTML directly (templates already include <html>, <head>, <body>)
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error rendering template preview:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return error HTML
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
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}
