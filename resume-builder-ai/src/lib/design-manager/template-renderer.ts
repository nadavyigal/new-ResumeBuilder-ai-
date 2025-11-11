/**
 * Template Renderer Module
 * Server-side rendering of React templates
 *
 * NOTE: Using dynamic imports to work with Next.js 15 compatibility
 * Reference: research.md rendering decision
 * Task: T018
 */

import 'server-only';
import React from 'react';

export interface ResumeData {
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
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
 * Renders a template to static HTML using React SSR
 * Next.js 15 Compatible: Uses dynamic rendering instead of renderToStaticMarkup
 * @param templateId - Template slug (e.g., 'card-ssr')
 * @param resumeData - Resume data to render
 * @param customization - Optional design customization
 * @returns Complete HTML document string
 */
export async function renderTemplatePreview(
  templateId: string,
  resumeData: ResumeData,
  customization?: any
): Promise<string> {
  try {
    // HOTFIX: If templateId looks like a UUID, default to minimal-ssr
    // TODO: Fetch actual template slug from templates table using UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId);
    const templateSlug = isUUID ? 'minimal-ssr' : templateId;

    console.log(`📋 [renderTemplatePreview] Template ID: ${templateId}, Using slug: ${templateSlug}`);

    // Load template component dynamically
    const TemplateComponent = require(`../templates/external/${templateSlug}/Resume.jsx`).default;

    if (!TemplateComponent) {
      throw new Error(`Template component not found: ${templateSlug}`);
    }

    // Transform data to JSON Resume format
    const jsonResume = transformToJsonResume(resumeData);

    // Apply customizations if provided
    // NOTE: Templates expect 'data' prop, not 'resume'
    const props = {
      data: jsonResume,
      customization: customization || null
    };

    // Use ReactDOMServer from react-dom/server (compatible with Next.js 15)
    const ReactDOMServer = require('react-dom/server');
    const markup = ReactDOMServer.renderToString(React.createElement(TemplateComponent, props));

    // Wrap in full HTML document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume Preview - ${resumeData.personalInfo?.fullName || 'Resume'}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    ${customization?.custom_css || ''}
  </style>
</head>
<body>
  ${markup}
</body>
</html>`;

    return html;
  } catch (error) {
    console.error(`Error rendering template ${templateId}:`, error);

    // Return fallback HTML on error
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume Preview Error</title>
</head>
<body>
  <h1>Resume Preview</h1>
  <p>Error rendering template. Please try again.</p>
</body>
</html>`;
  }
}

/**
 * Transforms internal resume format to JSON Resume schema
 * JSON Resume spec: https://jsonresume.org/schema/
 *
 * @param resumeData - Internal resume data format or optimized resume object
 * @returns JSON Resume formatted object
 */
export function transformToJsonResume(resumeData: any): any {
  // Handle different input formats
  const data = resumeData.content || resumeData;

  return {
    basics: {
      name: data.personalInfo?.fullName || '',
      label: data.personalInfo?.title || '',
      email: data.personalInfo?.email || '',
      phone: data.personalInfo?.phone || '',
      website: data.personalInfo?.website || '',
      summary: data.summary || '',
      location: {
        address: '',
        postalCode: '',
        city: data.personalInfo?.location || '',
        countryCode: '',
        region: ''
      },
      profiles: data.personalInfo?.linkedin
        ? [
            {
              network: 'LinkedIn',
              username: '',
              url: data.personalInfo.linkedin
            }
          ]
        : []
    },
    work: (data.experience || []).map((exp: any) => ({
      name: exp.company || '',
      position: exp.position || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      summary: exp.description || '',
      highlights: exp.achievements || []
    })),
    education: (data.education || []).map((edu: any) => ({
      institution: edu.institution || '',
      area: edu.degree || '',
      studyType: edu.degree || '',
      startDate: '',
      endDate: edu.graduationDate || '',
      gpa: edu.gpa || '',
      courses: []
    })),
    skills: (data.skills || []).map((skill: string) => ({
      name: skill,
      level: '',
      keywords: [skill]
    })),
    certificates: (data.certifications || []).map((cert: any) => ({
      name: cert.name || '',
      date: cert.date || '',
      issuer: cert.issuer || '',
      url: ''
    })),
    projects: (data.projects || []).map((project: any) => ({
      name: project.name || '',
      description: project.description || '',
      keywords: project.technologies || [],
      startDate: '',
      endDate: '',
      url: ''
    }))
  };
}

/**
 * Renders a template with sample data for preview without user data
 * @param templateId - Template slug
 * @returns HTML preview with sample data
 */
export async function renderTemplateSample(templateId: string): Promise<string> {
  const sampleData: ResumeData = {
    personalInfo: {
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/johndoe'
    },
    summary:
      'Experienced professional with demonstrated history of working in the technology industry.',
    experience: [
      {
        company: 'Tech Company',
        position: 'Software Engineer',
        startDate: '2020-01',
        endDate: 'Present',
        description: 'Developed and maintained web applications.'
      }
    ],
    education: [
      {
        institution: 'University Name',
        degree: 'Bachelor of Science in Computer Science',
        graduationDate: '2019'
      }
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js']
  };

  return renderTemplatePreview(templateId, sampleData);
}
