/**
 * Template Engine Library
 * Epic 4: Resume Templates and Export
 * Feature 003: Design Selection Integration
 *
 * Provides multiple resume templates and rendering capabilities
 * FR-015: At least two templates (ATS-Safe and Modern)
 * FR-016: Preview in different templates
 * FR-018: Formatting consistency
 * FR-019: ATS compatibility with design customizations
 */

import { OptimizedResume } from '../ai-optimizer';
import { renderTemplatePreview, transformToJsonResume } from '../design-manager/template-renderer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type TemplateType = 'ats-safe' | 'modern' | 'professional' | 'minimal';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  isPremium: boolean;
  isATSCompatible: boolean;
  features: string[];
}

/**
 * Available resume templates
 * FR-015: At least two templates
 */
export const TEMPLATES: Template[] = [
  {
    id: 'ats-safe',
    name: 'ATS-Safe Classic',
    description: 'Optimized for Applicant Tracking Systems with clean, simple formatting',
    isPremium: false,
    isATSCompatible: true,
    features: [
      'Simple, clean layout',
      'No graphics or tables',
      'Standard fonts',
      'Clear section headers',
      'Single column design',
    ],
  },
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Contemporary design with subtle colors and visual hierarchy',
    isPremium: false,
    isATSCompatible: true,
    features: [
      'Two-column layout',
      'Accent colors',
      'Skill bars',
      'Modern typography',
      'ATS-compatible structure',
    ],
  },
  {
    id: 'professional',
    name: 'Executive Professional',
    description: 'Sophisticated layout for senior positions',
    isPremium: true,
    isATSCompatible: true,
    features: [
      'Premium typography',
      'Elegant spacing',
      'Professional color scheme',
      'Summary highlights',
      'Achievement focus',
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Ultra-clean minimalist design',
    isPremium: true,
    isATSCompatible: true,
    features: [
      'Minimalist aesthetic',
      'Maximum white space',
      'Clean typography',
      'Subtle accents',
      'Focus on content',
    ],
  },
];

/**
 * Get template by ID
 */
export function getTemplate(templateId: TemplateType): Template | undefined {
  return TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get all available templates
 * FR-015: Provide template options
 */
export function getAllTemplates(): Template[] {
  return TEMPLATES;
}

/**
 * Get free templates only
 */
export function getFreeTemplates(): Template[] {
  return TEMPLATES.filter(t => !t.isPremium);
}

/**
 * Generate ATS-Safe resume HTML
 * FR-019: ATS compatibility ensured
 */
export function generateATSSafeHTML(resume: OptimizedResume): string {
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contact.name} - Resume</title>
  <style>
    /* ATS-Safe styling: Simple, no fancy layouts */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000000;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 8pt;
      text-align: center;
    }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 16pt;
      margin-bottom: 8pt;
      border-bottom: 1pt solid #000000;
      padding-bottom: 4pt;
      text-transform: uppercase;
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 10pt;
      margin-bottom: 4pt;
    }
    .contact {
      text-align: center;
      margin-bottom: 16pt;
      font-size: 10pt;
    }
    .contact-line {
      margin: 2pt 0;
    }
    .section {
      margin-bottom: 16pt;
    }
    .job-header {
      margin-bottom: 6pt;
    }
    .company {
      font-weight: bold;
    }
    .dates {
      font-style: italic;
    }
    ul {
      margin-left: 20pt;
      margin-top: 4pt;
    }
    li {
      margin-bottom: 4pt;
    }
    .skills-list {
      margin-top: 6pt;
    }
  </style>
</head>
<body>
  <h1>${contact.name}</h1>
  <div class="contact">
    <div class="contact-line">${contact.email} | ${contact.phone}</div>
    <div class="contact-line">${contact.location}</div>
    ${contact.linkedin ? `<div class="contact-line">${contact.linkedin}</div>` : ''}
  </div>

  <div class="section">
    <h2>Professional Summary</h2>
    <p>${summary}</p>
  </div>

  <div class="section">
    <h2>Skills</h2>
    <div class="skills-list">
      <strong>Technical Skills:</strong> ${skills.technical.join(', ')}
    </div>
    ${skills.soft && skills.soft.length > 0 ? `
    <div class="skills-list">
      <strong>Soft Skills:</strong> ${skills.soft.join(', ')}
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2>Professional Experience</h2>
    ${experience.map(exp => `
      <div class="job-header">
        <h3>${exp.title}</h3>
        <div><span class="company">${exp.company}</span> | ${exp.location}</div>
        <div class="dates">${exp.startDate} - ${exp.endDate}</div>
      </div>
      <ul>
        ${exp.achievements.map(achievement => `<li>${achievement}</li>`).join('\n        ')}
      </ul>
    `).join('\n    ')}
  </div>

  <div class="section">
    <h2>Education</h2>
    ${education.map(edu => `
      <div>
        <h3>${edu.degree}</h3>
        <div>${edu.institution} | ${edu.location}</div>
        <div class="dates">${edu.graduationDate}</div>
        ${edu.gpa ? `<div>GPA: ${edu.gpa}</div>` : ''}
      </div>
    `).join('\n    ')}
  </div>

  ${certifications && certifications.length > 0 ? `
  <div class="section">
    <h2>Certifications</h2>
    <ul>
      ${certifications.map(cert => `<li>${cert}</li>`).join('\n      ')}
    </ul>
  </div>
  ` : ''}

  ${projects && projects.length > 0 ? `
  <div class="section">
    <h2>Projects</h2>
    ${projects.map(project => `
      <div>
        <h3>${project.name}</h3>
        <p>${project.description}</p>
        <div><strong>Technologies:</strong> ${project.technologies.join(', ')}</div>
      </div>
    `).join('\n    ')}
  </div>
  ` : ''}
</body>
</html>
  `.trim();
}

/**
 * Generate Modern template HTML
 * FR-015: Second template option
 */
export function generateModernHTML(resume: OptimizedResume): string {
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contact.name} - Resume</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #2c3e50;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
      background: #ffffff;
    }
    h1 {
      font-size: 24pt;
      font-weight: 600;
      color: #1a5490;
      margin-bottom: 6pt;
    }
    h2 {
      font-size: 13pt;
      font-weight: 600;
      color: #1a5490;
      margin-top: 18pt;
      margin-bottom: 10pt;
      border-bottom: 2pt solid #3498db;
      padding-bottom: 4pt;
    }
    h3 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #34495e;
      margin-bottom: 4pt;
    }
    .header {
      border-bottom: 3pt solid #3498db;
      padding-bottom: 12pt;
      margin-bottom: 18pt;
    }
    .contact {
      margin-top: 8pt;
      font-size: 10pt;
      color: #7f8c8d;
    }
    .contact span {
      margin-right: 12pt;
    }
    .summary-box {
      background: #f8f9fa;
      padding: 12pt;
      border-left: 4pt solid #3498db;
      margin-bottom: 16pt;
    }
    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8pt;
      margin-top: 8pt;
    }
    .skill-tag {
      background: #e8f4f8;
      color: #1a5490;
      padding: 4pt 10pt;
      border-radius: 4pt;
      font-size: 9.5pt;
      font-weight: 500;
    }
    .experience-item {
      margin-bottom: 16pt;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4pt;
    }
    .company-info {
      color: #7f8c8d;
      font-size: 10pt;
      margin-bottom: 6pt;
    }
    .dates {
      color: #95a5a6;
      font-size: 9.5pt;
      font-style: italic;
    }
    ul {
      margin-left: 18pt;
      margin-top: 6pt;
    }
    li {
      margin-bottom: 5pt;
      line-height: 1.5;
    }
    li::marker {
      color: #3498db;
    }
    .education-item {
      margin-bottom: 12pt;
    }
    .cert-list {
      list-style: none;
      margin-left: 0;
    }
    .cert-list li::before {
      content: "✓ ";
      color: #27ae60;
      font-weight: bold;
      margin-right: 6pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${contact.name}</h1>
    <div class="contact">
      <span>${contact.email}</span>
      <span>${contact.phone}</span>
      <span>${contact.location}</span>
      ${contact.linkedin ? `<span>${contact.linkedin}</span>` : ''}
    </div>
  </div>

  <div class="summary-box">
    <h2 style="margin-top: 0; border: none;">Professional Summary</h2>
    <p>${summary}</p>
  </div>

  <section>
    <h2>Core Competencies</h2>
    <div class="skills-grid">
      ${skills.technical.map(skill => `<span class="skill-tag">${skill}</span>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>Professional Experience</h2>
    ${experience.map(exp => `
      <div class="experience-item">
        <div class="job-header">
          <h3>${exp.title}</h3>
          <span class="dates">${exp.startDate} - ${exp.endDate}</span>
        </div>
        <div class="company-info">${exp.company} | ${exp.location}</div>
        <ul>
          ${exp.achievements.map(achievement => `<li>${achievement}</li>`).join('\n          ')}
        </ul>
      </div>
    `).join('\n    ')}
  </section>

  <section>
    <h2>Education</h2>
    ${education.map(edu => `
      <div class="education-item">
        <h3>${edu.degree}</h3>
        <div class="company-info">${edu.institution}, ${edu.location}</div>
        <div class="dates">${edu.graduationDate}</div>
        ${edu.gpa ? `<div style="margin-top: 4pt;">GPA: ${edu.gpa}</div>` : ''}
      </div>
    `).join('\n    ')}
  </section>

  ${certifications && certifications.length > 0 ? `
  <section>
    <h2>Certifications</h2>
    <ul class="cert-list">
      ${certifications.map(cert => `<li>${cert}</li>`).join('\n      ')}
    </ul>
  </section>
  ` : ''}

  ${projects && projects.length > 0 ? `
  <section>
    <h2>Notable Projects</h2>
    ${projects.map(project => `
      <div class="experience-item">
        <h3>${project.name}</h3>
        <p>${project.description}</p>
        <div style="margin-top: 6pt;">
          <strong style="color: #1a5490;">Technologies:</strong> ${project.technologies.join(', ')}
        </div>
      </div>
    `).join('\n    ')}
  </section>
  ` : ''}
</body>
</html>
  `.trim();
}

/**
 * Render resume with specified template
 * FR-016: Preview in different templates
 */
export function renderTemplate(resume: OptimizedResume, templateId: TemplateType): string {
  switch (templateId) {
    case 'ats-safe':
      return generateATSSafeHTML(resume);
    case 'modern':
      return generateModernHTML(resume);
    case 'professional':
      // Premium template - similar to modern but more refined
      return generateModernHTML(resume); // Placeholder
    case 'minimal':
      // Premium minimal template
      return generateATSSafeHTML(resume); // Placeholder
    default:
      return generateATSSafeHTML(resume);
  }
}

/**
 * Validate template for ATS compatibility
 * FR-019: Ensure ATS compatibility
 */
export function validateATSCompatibility(html: string): {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for ATS-unfriendly elements
  if (html.includes('<table')) {
    issues.push('Contains tables which may not parse correctly in ATS');
  }

  if (html.includes('position: absolute') || html.includes('position: fixed')) {
    issues.push('Contains absolute/fixed positioning which ATS cannot parse');
  }

  if (html.match(/<img/gi)) {
    warnings.push('Contains images which ATS will ignore');
  }

  if (html.match(/font-family:.*['"](?!Arial|Helvetica|Times|Georgia|Verdana|Tahoma)/gi)) {
    warnings.push('Uses non-standard fonts which may not render in ATS');
  }

  return {
    isCompatible: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Get design assignment for an optimization
 * Feature 003: Design Selection Integration
 * Task: T040
 */
export async function getDesignAssignment(optimizationId: string): Promise<any | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('resume_design_assignments')
      .select(`
        *,
        template:design_templates(*),
        customization:design_customizations(*)
      `)
      .eq('optimization_id', optimizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No design assigned
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch design assignment:', error);
    return null;
  }
}

/**
 * Render resume with design template and customizations
 * Feature 003: Integrates design selection into export
 * Task: T040
 *
 * @param resume - Optimized resume data
 * @param optimizationId - Optimization UUID to fetch design assignment
 * @returns HTML string with applied design and customizations
 */
export async function renderWithDesign(
  resume: OptimizedResume,
  optimizationId: string
): Promise<string> {
  try {
    // Fetch design assignment
    const assignment = await getDesignAssignment(optimizationId);

    if (!assignment || !assignment.template) {
      // No design assigned - use default ATS-safe template
      return generateATSSafeHTML(resume);
    }

    // Get template slug from design assignment
    const templateSlug = assignment.template.slug;

    // Get customization if exists
    const customization = assignment.customization || null;

    // Transform resume data to format expected by design templates
    const resumeData = {
      personalInfo: {
        fullName: resume.contact.name,
        email: resume.contact.email,
        phone: resume.contact.phone,
        location: resume.contact.location,
        linkedin: resume.contact.linkedin,
        website: resume.contact.portfolio
      },
      summary: resume.summary,
      experience: resume.experience.map(exp => ({
        company: exp.company,
        position: exp.title,
        startDate: exp.startDate,
        endDate: exp.endDate,
        description: '',
        achievements: exp.achievements
      })),
      education: resume.education.map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        graduationDate: edu.graduationDate,
        gpa: edu.gpa
      })),
      skills: resume.skills.technical.concat(resume.skills.soft || []),
      certifications: (resume.certifications || []).map(cert => ({
        name: cert,
        issuer: '',
        date: ''
      })),
      projects: (resume.projects || []).map(proj => ({
        name: proj.name,
        description: proj.description,
        technologies: proj.technologies
      }))
    };

    // Render with design template and customizations
    const html = renderTemplatePreview(templateSlug, resumeData, customization);

    return html;
  } catch (error) {
    console.error('Error rendering with design:', error);
    // Fallback to default template on error
    return generateATSSafeHTML(resume);
  }
}

/**
 * Check if an optimization has a design assignment
 * Task: T040
 */
export async function hasDesignAssignment(optimizationId: string): Promise<boolean> {
  const assignment = await getDesignAssignment(optimizationId);
  return assignment !== null;
}
