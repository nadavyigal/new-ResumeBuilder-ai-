/**
 * Template Engine
 * Generates HTML templates for resume export with full design preservation
 * Epic 4: Resume Templates and Export (FR-015 to FR-019)
 */

import { OptimizedResume } from './ai-optimizer';
import { createRouteHandlerClient } from './supabase-server';

export type TemplateType = 'ats-safe' | 'modern' | 'professional' | 'minimal';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  isPremium: boolean;
  isATSCompatible: boolean;
  features: string[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'ats-safe',
    name: 'ATS-Safe Classic',
    description: 'Clean, professional format optimized for Applicant Tracking Systems',
    isPremium: false,
    isATSCompatible: true,
    features: [
      'ATS-optimized layout',
      'Standard fonts',
      'Clear section headers',
      'Single column design',
      'Print-friendly',
    ],
  },
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Contemporary design with subtle styling while maintaining ATS compatibility',
    isPremium: false,
    isATSCompatible: true,
    features: [
      'Modern typography',
      'Accent colors',
      'Visual hierarchy',
      'ATS-compatible structure',
      'Professional appearance',
    ],
  },
  {
    id: 'professional',
    name: 'Executive Professional',
    description: 'Sophisticated design for senior positions',
    isPremium: true,
    isATSCompatible: true,
    features: [
      'Executive styling',
      'Enhanced spacing',
      'Premium typography',
      'Elegant borders',
      'Distinguished appearance',
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Minimalist design with maximum impact',
    isPremium: true,
    isATSCompatible: true,
    features: [
      'Minimal design',
      'Maximum readability',
      'Clean typography',
      'Spacious layout',
      'Contemporary style',
    ],
  },
];

/**
 * Get all available templates
 */
export function getAllTemplates(): Template[] {
  return TEMPLATES;
}

/**
 * Get only free templates
 */
export function getFreeTemplates(): Template[] {
  return TEMPLATES.filter((t) => !t.isPremium);
}

/**
 * Get template by ID
 */
export function getTemplate(id: TemplateType): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * HTML escape utility
 */
function escapeHtml(text: string): string {
  const div = { innerHTML: '' } as any;
  div.textContent = text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate ATS-Safe HTML template
 */
export function generateATSSafeHTML(resume: OptimizedResume): string {
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(contact.name)} - Resume</title>
  <style>
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
      background: #ffffff;
      padding: 0.75in;
      max-width: 8.5in;
      margin: 0 auto;
    }

    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 8pt;
      color: #000000;
    }

    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 16pt;
      margin-bottom: 8pt;
      text-transform: uppercase;
      color: #000000;
      border-bottom: 1px solid #cccccc;
      padding-bottom: 4pt;
    }

    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 10pt;
      margin-bottom: 4pt;
      color: #000000;
    }

    .contact-info {
      font-size: 10pt;
      margin-bottom: 16pt;
      color: #333333;
    }

    .contact-line {
      margin-bottom: 2pt;
    }

    .section {
      margin-bottom: 16pt;
    }

    .job-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4pt;
    }

    .job-title {
      font-weight: bold;
      font-size: 11pt;
    }

    .company-name {
      font-weight: bold;
      font-size: 11pt;
    }

    .job-meta {
      font-size: 10pt;
      color: #555555;
      font-style: italic;
      margin-bottom: 8pt;
    }

    .achievements {
      margin-left: 20pt;
      margin-top: 4pt;
    }

    .achievements li {
      margin-bottom: 4pt;
      line-height: 1.4;
    }

    .skills-list {
      margin-left: 0;
      padding-left: 0;
      list-style: none;
    }

    .skills-list li {
      display: inline;
    }

    .skills-list li:after {
      content: " • ";
    }

    .skills-list li:last-child:after {
      content: "";
    }

    .skill-category {
      font-weight: bold;
      margin-top: 8pt;
      margin-bottom: 4pt;
    }

    .education-item {
      margin-bottom: 12pt;
    }

    .degree {
      font-weight: bold;
      font-size: 11pt;
    }

    .institution {
      font-size: 10pt;
      color: #555555;
      font-style: italic;
    }

    .certifications-list {
      margin-left: 20pt;
    }

    .certifications-list li {
      margin-bottom: 4pt;
    }

    .project-item {
      margin-bottom: 12pt;
    }

    .project-name {
      font-weight: bold;
      font-size: 11pt;
    }

    .project-description {
      margin-top: 4pt;
      margin-bottom: 4pt;
    }

    .project-tech {
      font-size: 10pt;
      color: #555555;
      font-style: italic;
    }

    @media print {
      body {
        padding: 0.5in;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <h1>${escapeHtml(contact.name)}</h1>
    <div class="contact-info">
      <div class="contact-line">
        ${escapeHtml(contact.email)}${contact.phone ? ' | ' + escapeHtml(contact.phone) : ''}${contact.location ? ' | ' + escapeHtml(contact.location) : ''}
      </div>
      ${contact.linkedin || contact.portfolio ? `<div class="contact-line">
        ${contact.linkedin ? escapeHtml(contact.linkedin) : ''}${contact.linkedin && contact.portfolio ? ' | ' : ''}${contact.portfolio ? escapeHtml(contact.portfolio) : ''}
      </div>` : ''}
    </div>
  </header>

  <!-- Professional Summary -->
  <section class="section">
    <h2>Professional Summary</h2>
    <p>${escapeHtml(summary)}</p>
  </section>

  <!-- Skills -->
  <section class="section">
    <h2>Skills</h2>
    ${skills.technical?.length ? `
    <div class="skill-category">Technical Skills:</div>
    <ul class="skills-list">
      ${skills.technical.map(skill => `<li>${escapeHtml(skill)}</li>`).join('')}
    </ul>
    ` : ''}
    ${skills.soft?.length ? `
    <div class="skill-category">Professional Skills:</div>
    <ul class="skills-list">
      ${skills.soft.map(skill => `<li>${escapeHtml(skill)}</li>`).join('')}
    </ul>
    ` : ''}
  </section>

  <!-- Professional Experience -->
  <section class="section">
    <h2>Professional Experience</h2>
    ${experience.map(exp => `
    <div class="job-item">
      <h3>
        <span class="job-title">${escapeHtml(exp.title)}</span> | <span class="company-name">${escapeHtml(exp.company)}</span>
      </h3>
      <div class="job-meta">
        ${escapeHtml(exp.location)} | ${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}
      </div>
      ${exp.achievements?.length ? `
      <ul class="achievements">
        ${exp.achievements.map(achievement => `<li>${escapeHtml(achievement)}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
    `).join('')}
  </section>

  <!-- Education -->
  <section class="section">
    <h2>Education</h2>
    ${education.map(edu => `
    <div class="education-item">
      <div class="degree">${escapeHtml(edu.degree)}</div>
      <div class="institution">
        ${escapeHtml(edu.institution)} | ${escapeHtml(edu.location)} | ${escapeHtml(edu.graduationDate)}
      </div>
      ${edu.gpa ? `<div class="institution">GPA: ${escapeHtml(edu.gpa)}</div>` : ''}
    </div>
    `).join('')}
  </section>

  <!-- Certifications -->
  ${certifications && certifications.length > 0 ? `
  <section class="section">
    <h2>Certifications</h2>
    <ul class="certifications-list">
      ${certifications.map(cert => `<li>${escapeHtml(cert)}</li>`).join('')}
    </ul>
  </section>
  ` : ''}

  <!-- Projects -->
  ${projects && projects.length > 0 ? `
  <section class="section">
    <h2>Projects</h2>
    ${projects.map(project => `
    <div class="project-item">
      <div class="project-name">${escapeHtml(project.name)}</div>
      <div class="project-description">${escapeHtml(project.description)}</div>
      <div class="project-tech">Technologies: ${project.technologies.map(t => escapeHtml(t)).join(', ')}</div>
    </div>
    `).join('')}
  </section>
  ` : ''}
</body>
</html>`;
}

/**
 * Generate Modern HTML template with enhanced styling
 */
export function generateModernHTML(resume: OptimizedResume): string {
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(contact.name)} - Resume</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #2c3e50;
      background: #ffffff;
      padding: 0.75in;
      max-width: 8.5in;
      margin: 0 auto;
    }

    h1 {
      font-size: 28pt;
      font-weight: 600;
      margin-bottom: 8pt;
      color: #1a5490;
      letter-spacing: -0.5px;
    }

    h2 {
      font-size: 14pt;
      font-weight: 600;
      margin-top: 18pt;
      margin-bottom: 10pt;
      text-transform: uppercase;
      color: #1a5490;
      border-bottom: 2px solid #3498db;
      padding-bottom: 4pt;
      letter-spacing: 0.5px;
    }

    h3 {
      font-size: 12pt;
      font-weight: 600;
      margin-top: 12pt;
      margin-bottom: 4pt;
      color: #2c3e50;
    }

    .contact-info {
      font-size: 10pt;
      margin-bottom: 18pt;
      color: #555555;
      line-height: 1.5;
    }

    .contact-line {
      margin-bottom: 3pt;
    }

    .section {
      margin-bottom: 18pt;
    }

    .job-item {
      margin-bottom: 16pt;
      border-left: 3px solid #3498db;
      padding-left: 12pt;
    }

    .job-title {
      font-weight: 600;
      font-size: 11.5pt;
      color: #2c3e50;
    }

    .company-name {
      font-weight: 600;
      font-size: 11.5pt;
      color: #1a5490;
    }

    .job-meta {
      font-size: 10pt;
      color: #7f8c8d;
      font-style: italic;
      margin-bottom: 8pt;
      margin-top: 2pt;
    }

    .achievements {
      margin-left: 20pt;
      margin-top: 6pt;
    }

    .achievements li {
      margin-bottom: 5pt;
      line-height: 1.5;
      color: #34495e;
    }

    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8pt;
      margin-top: 8pt;
    }

    .skill-tag {
      display: inline-block;
      background: #ecf0f1;
      color: #2c3e50;
      padding: 4pt 10pt;
      border-radius: 3pt;
      font-size: 10pt;
      border: 1px solid #bdc3c7;
    }

    .skill-category {
      font-weight: 600;
      margin-top: 10pt;
      margin-bottom: 6pt;
      color: #34495e;
    }

    .education-item {
      margin-bottom: 14pt;
      padding-left: 12pt;
      border-left: 3px solid #3498db;
    }

    .degree {
      font-weight: 600;
      font-size: 11.5pt;
      color: #2c3e50;
    }

    .institution {
      font-size: 10pt;
      color: #7f8c8d;
      font-style: italic;
      margin-top: 2pt;
    }

    .certifications-list {
      margin-left: 20pt;
    }

    .certifications-list li {
      margin-bottom: 5pt;
      color: #34495e;
    }

    .project-item {
      margin-bottom: 14pt;
      padding-left: 12pt;
      border-left: 3px solid #3498db;
    }

    .project-name {
      font-weight: 600;
      font-size: 11.5pt;
      color: #2c3e50;
    }

    .project-description {
      margin-top: 4pt;
      margin-bottom: 4pt;
      color: #34495e;
    }

    .project-tech {
      font-size: 10pt;
      color: #7f8c8d;
      font-style: italic;
    }

    @media print {
      body {
        padding: 0.5in;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <h1>${escapeHtml(contact.name)}</h1>
    <div class="contact-info">
      <div class="contact-line">
        ${escapeHtml(contact.email)}${contact.phone ? ' | ' + escapeHtml(contact.phone) : ''}${contact.location ? ' | ' + escapeHtml(contact.location) : ''}
      </div>
      ${contact.linkedin || contact.portfolio ? `<div class="contact-line">
        ${contact.linkedin ? escapeHtml(contact.linkedin) : ''}${contact.linkedin && contact.portfolio ? ' | ' : ''}${contact.portfolio ? escapeHtml(contact.portfolio) : ''}
      </div>` : ''}
    </div>
  </header>

  <!-- Professional Summary -->
  <section class="section">
    <h2>Professional Summary</h2>
    <p>${escapeHtml(summary)}</p>
  </section>

  <!-- Skills -->
  <section class="section">
    <h2>Skills</h2>
    ${skills.technical?.length ? `
    <div class="skill-category">Technical Skills:</div>
    <div class="skills-container">
      ${skills.technical.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
    </div>
    ` : ''}
    ${skills.soft?.length ? `
    <div class="skill-category">Professional Skills:</div>
    <div class="skills-container">
      ${skills.soft.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
    </div>
    ` : ''}
  </section>

  <!-- Professional Experience -->
  <section class="section">
    <h2>Professional Experience</h2>
    ${experience.map(exp => `
    <div class="job-item">
      <h3>
        <span class="job-title">${escapeHtml(exp.title)}</span> | <span class="company-name">${escapeHtml(exp.company)}</span>
      </h3>
      <div class="job-meta">
        ${escapeHtml(exp.location)} | ${escapeHtml(exp.startDate)} – ${escapeHtml(exp.endDate)}
      </div>
      ${exp.achievements?.length ? `
      <ul class="achievements">
        ${exp.achievements.map(achievement => `<li>${escapeHtml(achievement)}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
    `).join('')}
  </section>

  <!-- Education -->
  <section class="section">
    <h2>Education</h2>
    ${education.map(edu => `
    <div class="education-item">
      <div class="degree">${escapeHtml(edu.degree)}</div>
      <div class="institution">
        ${escapeHtml(edu.institution)} | ${escapeHtml(edu.location)} | ${escapeHtml(edu.graduationDate)}
      </div>
      ${edu.gpa ? `<div class="institution">GPA: ${escapeHtml(edu.gpa)}</div>` : ''}
    </div>
    `).join('')}
  </section>

  <!-- Certifications -->
  ${certifications && certifications.length > 0 ? `
  <section class="section">
    <h2>Certifications</h2>
    <ul class="certifications-list">
      ${certifications.map(cert => `<li>${escapeHtml(cert)}</li>`).join('')}
    </ul>
  </section>
  ` : ''}

  <!-- Projects -->
  ${projects && projects.length > 0 ? `
  <section class="section">
    <h2>Projects</h2>
    ${projects.map(project => `
    <div class="project-item">
      <div class="project-name">${escapeHtml(project.name)}</div>
      <div class="project-description">${escapeHtml(project.description)}</div>
      <div class="project-tech">Technologies: ${project.technologies.map(t => escapeHtml(t)).join(', ')}</div>
    </div>
    `).join('')}
  </section>
  ` : ''}
</body>
</html>`;
}

/**
 * Render resume with specified template
 */
export function renderTemplate(resume: OptimizedResume, templateId: TemplateType): string {
  switch (templateId) {
    case 'ats-safe':
      return generateATSSafeHTML(resume);
    case 'modern':
      return generateModernHTML(resume);
    case 'professional':
      // Currently uses modern as placeholder
      return generateModernHTML(resume);
    case 'minimal':
      // Currently uses ATS-safe as placeholder
      return generateATSSafeHTML(resume);
    default:
      return generateATSSafeHTML(resume);
  }
}

/**
 * Validate ATS compatibility of HTML
 */
export function validateATSCompatibility(html: string): {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for tables
  if (html.includes('<table')) {
    issues.push('Contains tables which may not parse correctly in ATS systems');
  }

  // Check for absolute/fixed positioning
  if (html.includes('position: absolute') || html.includes('position:absolute')) {
    issues.push('Contains absolute positioning which may break in ATS systems');
  }

  if (html.includes('position: fixed') || html.includes('position:fixed')) {
    issues.push('Contains fixed positioning which may break in ATS systems');
  }

  // Check for images
  if (html.includes('<img')) {
    warnings.push('Contains images which may not be processed by all ATS systems');
  }

  // Check for non-standard fonts
  const hasStandardFonts =
    html.includes('Arial') ||
    html.includes('Helvetica') ||
    html.includes('Times') ||
    html.includes('Calibri') ||
    html.includes('Segoe UI');

  const hasNonStandardFonts =
    html.includes('Comic Sans') ||
    html.includes('Papyrus') ||
    html.includes('Brush Script');

  if (hasNonStandardFonts || (!hasStandardFonts && html.includes('font-family'))) {
    warnings.push('May contain non-standard fonts that could affect ATS parsing');
  }

  return {
    isCompatible: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Check if optimization has a design assignment
 */
export async function hasDesignAssignment(optimizationId: string): Promise<boolean> {
  try {
    const supabase = await createRouteHandlerClient();

    const { data, error } = await supabase
      .from('design_assignments')
      .select('id')
      .eq('optimization_id', optimizationId)
      .maybeSingle();

    if (error) {
      console.error('Error checking design assignment:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasDesignAssignment:', error);
    return false;
  }
}

/**
 * Render HTML with custom design assignment
 * Fetches design customizations from database and applies them
 */
export async function renderWithDesign(
  resume: OptimizedResume,
  optimizationId: string
): Promise<string> {
  try {
    const supabase = await createRouteHandlerClient();

    // Fetch design assignment with template and customization
    const { data: assignment, error } = await supabase
      .from('design_assignments')
      .select(`
        *,
        template:templates(slug, name),
        customization:design_customizations(colors, fonts, spacing, layout)
      `)
      .eq('optimization_id', optimizationId)
      .maybeSingle();

    if (error || !assignment) {
      // No design assignment, use default ATS-safe template
      return generateATSSafeHTML(resume);
    }

    // Get base template HTML
    const templateSlug = (assignment.template as any)?.slug || 'ats-safe';
    let html = renderTemplate(resume, templateSlug as TemplateType);

    // Apply customizations if present
    const customization = assignment.customization as any;
    if (customization) {
      html = applyCustomizations(html, customization);
    }

    return html;
  } catch (error) {
    console.error('Error rendering with design:', error);
    // Fallback to default template
    return generateATSSafeHTML(resume);
  }
}

/**
 * Apply design customizations to HTML
 */
function applyCustomizations(
  html: string,
  customization: {
    colors?: { primary?: string; secondary?: string; text?: string };
    fonts?: { heading?: string; body?: string };
    spacing?: { tight?: boolean; normal?: boolean; wide?: boolean };
    layout?: any;
  }
): string {
  let modifiedHtml = html;

  // Apply color customizations
  if (customization.colors) {
    const { primary, secondary, text } = customization.colors;

    if (primary) {
      // Replace heading colors
      modifiedHtml = modifiedHtml.replace(/color: #1a5490/g, `color: ${primary}`);
      modifiedHtml = modifiedHtml.replace(/color: #3498db/g, `color: ${primary}`);
      modifiedHtml = modifiedHtml.replace(/border-bottom: 2px solid #3498db/g, `border-bottom: 2px solid ${primary}`);
      modifiedHtml = modifiedHtml.replace(/border-left: 3px solid #3498db/g, `border-left: 3px solid ${primary}`);
    }

    if (secondary) {
      // Replace secondary colors
      modifiedHtml = modifiedHtml.replace(/color: #7f8c8d/g, `color: ${secondary}`);
    }

    if (text) {
      // Replace text colors
      modifiedHtml = modifiedHtml.replace(/color: #2c3e50/g, `color: ${text}`);
      modifiedHtml = modifiedHtml.replace(/color: #34495e/g, `color: ${text}`);
    }
  }

  // Apply font customizations
  if (customization.fonts) {
    const { heading, body } = customization.fonts;

    if (heading) {
      // Add heading font override
      const styleEndIndex = modifiedHtml.indexOf('</style>');
      if (styleEndIndex !== -1) {
        const fontOverride = `\n    h1, h2, h3 { font-family: ${heading}, sans-serif !important; }\n  `;
        modifiedHtml =
          modifiedHtml.slice(0, styleEndIndex) + fontOverride + modifiedHtml.slice(styleEndIndex);
      }
    }

    if (body) {
      // Add body font override
      const styleEndIndex = modifiedHtml.indexOf('</style>');
      if (styleEndIndex !== -1) {
        const fontOverride = `\n    body, p, li, div { font-family: ${body}, sans-serif !important; }\n  `;
        modifiedHtml =
          modifiedHtml.slice(0, styleEndIndex) + fontOverride + modifiedHtml.slice(styleEndIndex);
      }
    }
  }

  // Apply spacing customizations
  if (customization.spacing) {
    const { tight, wide } = customization.spacing;

    if (tight) {
      // Reduce spacing
      modifiedHtml = modifiedHtml.replace(/line-height: 1\.6/g, 'line-height: 1.3');
      modifiedHtml = modifiedHtml.replace(/margin-bottom: 18pt/g, 'margin-bottom: 12pt');
      modifiedHtml = modifiedHtml.replace(/margin-bottom: 16pt/g, 'margin-bottom: 10pt');
    } else if (wide) {
      // Increase spacing
      modifiedHtml = modifiedHtml.replace(/line-height: 1\.5/g, 'line-height: 1.8');
      modifiedHtml = modifiedHtml.replace(/line-height: 1\.6/g, 'line-height: 1.9');
      modifiedHtml = modifiedHtml.replace(/margin-bottom: 16pt/g, 'margin-bottom: 22pt');
      modifiedHtml = modifiedHtml.replace(/margin-bottom: 18pt/g, 'margin-bottom: 24pt');
    }
  }

  return modifiedHtml;
}
