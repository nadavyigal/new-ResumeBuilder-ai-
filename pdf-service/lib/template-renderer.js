/**
 * Template Renderer Module
 * Server-side rendering of React templates with RTL support
 *
 * Extracted from:
 * - resume-builder-ai/src/lib/design-manager/template-renderer.ts (lines 52-69, 225-291)
 * - resume-builder-ai/src/lib/export.ts (lines 121-162)
 * Phase 2: PDF Generation Logic
 */

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const path = require('path');
const logger = require('../utils/logger');
const { generateCustomizationCSS } = require('./customization-css');

/**
 * Detects if text contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function detectHebrew(text) {
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

/**
 * Detects if resume content is RTL (Hebrew/Arabic)
 * @param {Object} resumeData - Resume data object
 * @returns {boolean}
 */
function detectRTL(resumeData) {
  const textToCheck = [
    resumeData.personalInfo?.fullName,
    resumeData.summary,
    ...(resumeData.experience || []).map((exp) => exp.position),
  ]
    .filter(Boolean)
    .join(' ');

  return detectHebrew(textToCheck);
}

/**
 * Transforms internal resume format to JSON Resume schema
 * JSON Resume spec: https://jsonresume.org/schema/
 *
 * @param {Object} resumeData - Internal resume data format
 * @returns {Object} JSON Resume formatted object
 */
function transformToJsonResume(resumeData) {
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
        region: '',
      },
      profiles: data.personalInfo?.linkedin
        ? [
            {
              network: 'LinkedIn',
              username: '',
              url: data.personalInfo.linkedin,
            },
          ]
        : [],
    },
    work: (data.experience || []).map((exp) => ({
      name: exp.company || '',
      position: exp.position || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      summary: exp.description || '',
      highlights: exp.achievements || [],
    })),
    education: (data.education || []).map((edu) => ({
      institution: edu.institution || '',
      area: edu.degree || '',
      studyType: edu.degree || '',
      startDate: '',
      endDate: edu.graduationDate || '',
      gpa: edu.gpa || '',
      courses: [],
    })),
    skills: (data.skills || []).map((skill) =>
      typeof skill === 'string'
        ? {
            name: skill,
            level: '',
            keywords: [skill],
          }
        : skill
    ),
    certificates: (data.certifications || []).map((cert) =>
      typeof cert === 'string'
        ? {
            name: cert,
            date: '',
            issuer: '',
            url: '',
          }
        : {
            name: cert.name || '',
            date: cert.date || '',
            issuer: cert.issuer || '',
            url: '',
          }
    ),
    projects: (data.projects || []).map((project) => ({
      name: project.name || '',
      description: project.description || '',
      keywords: project.technologies || [],
      startDate: '',
      endDate: '',
      url: '',
    })),
  };
}

/**
 * Renders a React template to static HTML
 *
 * @param {string} templateSlug - Template identifier (e.g., 'minimal-ssr', 'card-ssr')
 * @param {Object} resumeData - Resume data in internal format
 * @param {Object} customization - Optional design customization
 * @returns {Promise<string>} Complete HTML document
 */
async function renderTemplate(templateSlug, resumeData, customization = null) {
  const startTime = Date.now();

  try {
    logger.info('[Template-Renderer] Rendering template', { templateSlug });

    // Load template component
    const templatePath = path.join(__dirname, '..', 'templates', templateSlug, 'Resume.jsx');

    // Clear require cache to get fresh template on each render (useful for dev)
    delete require.cache[require.resolve(templatePath)];

    const TemplateComponent = require(templatePath).default || require(templatePath);

    if (!TemplateComponent) {
      throw new Error(`TEMPLATE_ERROR: Component not found in ${templateSlug}`);
    }

    // Transform to JSON Resume format (what templates expect)
    const jsonResume = transformToJsonResume(resumeData);

    // Detect RTL language
    const isRTL = detectRTL(resumeData);
    const lang = isRTL ? 'he' : 'en';

    // Prepare props for template
    const props = {
      data: jsonResume,
      customization: customization || null,
      isRTL,
      language: lang,
    };

    // Render React component to static HTML string
    const markup = ReactDOMServer.renderToString(React.createElement(TemplateComponent, props));

    // Generate customization CSS
    const customCSS = generateCustomizationCSS(customization);

    // Wrap in full HTML document
    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${resumeData.personalInfo?.fullName || 'Resume'}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    ${customCSS}
  </style>
</head>
<body>
  ${markup}
</body>
</html>`;

    const duration = Date.now() - startTime;
    logger.info('[Template-Renderer] Template rendered successfully', {
      templateSlug,
      duration: `${duration}ms`,
      htmlSize: html.length,
    });

    return html;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Template-Renderer] Template rendering failed', {
      templateSlug,
      error: error.message,
      duration: `${duration}ms`,
    });

    if (error.message.includes('Cannot find module')) {
      throw new Error(`TEMPLATE_ERROR: Template not found - ${templateSlug}`);
    }

    throw new Error(`RENDER_ERROR: ${error.message}`);
  }
}

/**
 * Get list of available templates
 * @returns {Array<string>} Array of template slugs
 */
function getAvailableTemplates() {
  return ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];
}

/**
 * Validate template slug
 * @param {string} templateSlug - Template identifier
 * @returns {boolean}
 */
function isValidTemplate(templateSlug) {
  return getAvailableTemplates().includes(templateSlug);
}

module.exports = {
  renderTemplate,
  transformToJsonResume,
  detectRTL,
  detectHebrew,
  getAvailableTemplates,
  isValidTemplate,
};
