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
 * Detects if text contains Hebrew characters
 */
function detectHebrew(text: string): boolean {
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

/**
 * Detects if resume content is RTL (Hebrew/Arabic)
 */
function detectRTL(resumeData: any): boolean {
  const textToCheck = [
    resumeData.personalInfo?.fullName,
    resumeData.summary,
    ...(resumeData.experience || []).map((exp: any) => exp.position),
  ].filter(Boolean).join(' ');

  return detectHebrew(textToCheck);
}

/**
 * Generates CSS for customization
 */
function generateCustomizationCSS(customization: any): string {
  if (!customization) return '';

  let css = '';

  // Color scheme
  if (customization.color_scheme) {
    const colors = customization.color_scheme;
    css += `
      :root {
        --resume-primary: ${colors.primary || '#2563eb'};
        --resume-secondary: ${colors.secondary || '#64748b'};
        --resume-accent: ${colors.accent || '#0ea5e9'};
        --resume-background: ${colors.background || '#ffffff'};
        --resume-text: ${colors.text || '#1f2937'};
      }
    `;
  }

  // Font families
  if (customization.font_family) {
    const fonts = customization.font_family;
    if (fonts.heading) {
      css += `
        h1, h2, h3, h4, h5, h6 {
          font-family: ${fonts.heading}, sans-serif !important;
        }
      `;
    }
    if (fonts.body) {
      css += `
        body, p, li, span {
          font-family: ${fonts.body}, sans-serif !important;
        }
      `;
    }
  }

  // Spacing
  if (customization.spacing) {
    if (customization.spacing.line_height) {
      css += `
        body {
          line-height: ${customization.spacing.line_height} !important;
        }
      `;
    }
    if (customization.spacing.section_gap) {
      css += `
        .resume-section, section {
          margin-bottom: ${customization.spacing.section_gap} !important;
        }
      `;
    }
  }

  // Custom CSS
  if (customization.custom_css) {
    css += customization.custom_css;
  }

  return css;
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
    // Load template component dynamically
    const templateModule = await import(`../templates/external/${templateId}/Resume.jsx`);
    const TemplateComponent = templateModule.default ?? templateModule;

    if (!TemplateComponent) {
      throw new Error(`Template component not found: ${templateId}`);
    }

    // Transform data to JSON Resume format
    const jsonResume = transformToJsonResume(resumeData);

    // Detect RTL language
    const isRTL = detectRTL(resumeData);
    const lang = isRTL ? 'he' : 'en';

    // Apply customizations if provided
    // NOTE: Templates expect 'data' prop, not 'resume'
    const props = {
      data: jsonResume,
      customization: customization || null,
      isRTL,
      language: lang
    };

    // Use ReactDOMServer from react-dom/server (compatible with Next.js 15)
    const ReactDOMServer = await import('react-dom/server');
    const markup = ReactDOMServer.renderToString(React.createElement(TemplateComponent, props));

    // Generate customization CSS
    const customCSS = generateCustomizationCSS(customization);

    // Wrap in full HTML document
    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume Preview - ${resumeData.personalInfo?.fullName || 'Resume'}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    ${customCSS}
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
