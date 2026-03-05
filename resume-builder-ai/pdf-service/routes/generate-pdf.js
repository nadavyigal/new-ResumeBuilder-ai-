/**
 * Generate PDF Route
 * POST /api/generate-pdf endpoint
 *
 * Accepts resume data, renders template, and returns base64 PDF
 * Phase 2: PDF Generation Logic
 */

const express = require('express');
const router = express.Router();
const { validateGeneratePdfRequest } = require('../lib/validators');
const { renderTemplate } = require('../lib/template-renderer');
const { generatePdfFromHtml } = require('../lib/pdf-generator');
const { sanitizeCustomization } = require('../lib/customization-css');
const logger = require('../utils/logger');
const authenticateApiKey = require('../utils/auth');

/**
 * POST /api/generate-pdf
 * Generate PDF from resume data and template
 *
 * Request body:
 * {
 *   resumeData: {
 *     personalInfo: { fullName, email, phone, location, linkedin, website },
 *     summary: string,
 *     experience: [...],
 *     education: [...],
 *     skills: [...],
 *     certifications: [...],
 *     projects: [...]
 *   },
 *   templateSlug: 'minimal-ssr' | 'card-ssr' | 'sidebar-ssr' | 'timeline-ssr',
 *   customization?: {
 *     color_scheme: { primary, secondary, accent, background, text },
 *     font_family: { heading, body },
 *     spacing: { line_height, section_gap },
 *     custom_css: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   pdfBase64: "base64-encoded-pdf-data",
 *   metadata: {
 *     templateSlug: string,
 *     generatedAt: ISO timestamp,
 *     size: number (bytes),
 *     duration: number (ms)
 *   }
 * }
 */
router.post('/generate-pdf', authenticateApiKey, async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);

  try {
    logger.info('[Generate-PDF] Request received', {
      requestId,
      templateSlug: req.body.templateSlug,
    });

    // Validate request
    const validation = validateGeneratePdfRequest(req.body);
    if (!validation.success) {
      logger.warn('[Generate-PDF] Validation failed', {
        requestId,
        errors: validation.errors,
      });

      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        errors: validation.errors,
      });
    }

    const { resumeData, templateSlug, customization } = validation.data;

    // Sanitize customization to prevent CSS injection
    const sanitizedCustomization = customization ? sanitizeCustomization(customization) : null;

    // Render template to HTML
    let html;
    try {
      html = await renderTemplate(templateSlug, resumeData, sanitizedCustomization);
    } catch (error) {
      logger.error('[Generate-PDF] Template rendering failed', {
        requestId,
        templateSlug,
        error: error.message,
      });

      const errorCode = error.message.includes('TEMPLATE_ERROR')
        ? 'TEMPLATE_ERROR'
        : 'RENDER_ERROR';

      return res.status(400).json({
        success: false,
        error: errorCode,
        message: error.message,
      });
    }

    // Generate PDF from HTML
    let pdfBuffer;
    try {
      pdfBuffer = await generatePdfFromHtml(html);
    } catch (error) {
      logger.error('[Generate-PDF] PDF generation failed', {
        requestId,
        templateSlug,
        error: error.message,
      });

      const errorCode = error.message.includes('TIMEOUT_ERROR')
        ? 'TIMEOUT_ERROR'
        : 'RENDER_ERROR';

      return res.status(500).json({
        success: false,
        error: errorCode,
        message: error.message,
      });
    }

    // Convert to base64
    const pdfBase64 = pdfBuffer.toString('base64');
    const duration = Date.now() - startTime;

    logger.info('[Generate-PDF] PDF generated successfully', {
      requestId,
      templateSlug,
      size: pdfBuffer.length,
      duration: `${duration}ms`,
    });

    // Send response
    res.json({
      success: true,
      pdfBase64,
      metadata: {
        templateSlug,
        generatedAt: new Date().toISOString(),
        size: pdfBuffer.length,
        duration,
      },
    });
  } catch (error) {
    logger.error('[Generate-PDF] Unexpected error', {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    next(error); // Pass to error handler middleware
  }
});

/**
 * GET /api/templates
 * List available templates
 */
router.get('/templates', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    templates: [
      {
        slug: 'minimal-ssr',
        name: 'Minimal',
        description: 'Clean and simple design with centered layout',
      },
      {
        slug: 'card-ssr',
        name: 'Card',
        description: 'Modern card-based layout with visual hierarchy',
      },
      {
        slug: 'sidebar-ssr',
        name: 'Sidebar',
        description: 'Two-column layout with sidebar for contact info',
      },
      {
        slug: 'timeline-ssr',
        name: 'Timeline',
        description: 'Chronological timeline layout for experience',
      },
    ],
  });
});

module.exports = router;
