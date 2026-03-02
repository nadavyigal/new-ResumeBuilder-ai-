import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, TextRun } from "docx";
import jsPDF from "jspdf";
import { OptimizedResume } from "./ai-optimizer";
import { generateResumePDF } from "./pdf-generator";
import { renderTemplate, TemplateType } from "./template-engine";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePDF } from "./pdf-renderer";
import React from "react";
import { createRouteHandlerClient } from "./supabase-server";
import { getDesignTemplateBySlug } from "./supabase/design-templates";
import { renderTemplatePreview, type ResumeData } from "./design-manager/template-renderer";
import { type DesignCustomizationLike } from "./design-manager/render-preview-html";
import { callPDFService } from "./pdf-service-client";
import { resolvePdfDesignContext, type PdfDesignContext } from "./pdf-design-context";
import { logger } from "@/lib/agent/utils/logger";
import { getPdfTemplate, selectPalette, applyCustomization, detectRTL } from "./pdf-templates";

/**
 * Generate PDF from HTML using the Docker PDF service.
 * Puppeteer was removed to avoid 300MB+ of Chrome binaries that don't work on serverless.
 * Falls back to React PDF if Docker service is unavailable.
 */
async function generatePdfFromHtml(html: string): Promise<Buffer> {
  // Try Docker PDF service (which has its own headless browser)
  try {
    const response = await callPDFService(
      {} as any, // Not used when passing raw HTML
      'raw-html',
      null,
    );
    if (response.success && response.pdfBase64) {
      return Buffer.from(response.pdfBase64, 'base64');
    }
  } catch {
    logger.warn('Docker PDF service unavailable for HTML-to-PDF, will fall through to React PDF');
  }

  // If Docker service fails, throw to let callers fall back to React PDF
  throw new Error('HTML-to-PDF generation unavailable (puppeteer removed, Docker service unavailable)');
}

export type PdfRenderer = "docker" | "html" | "react-pdf" | "jspdf";
export interface PdfWithDesignResult {
  buffer: Buffer;
  renderer: PdfRenderer;
  templateSlug: string | null;
  usedDesignAssignment: boolean;
}

export interface PdfWithDesignOptions {
  skipDocker?: boolean;
  designContext?: PdfDesignContext;
}

/**
 * Generate PDF from optimized resume data with template support
 * FR-017: Export in PDF format
 * FR-018: Preserve formatting consistency
 * FR-019: Ensure ATS compatibility
 *
 * @param resumeData - Optimized resume data
 * @param templateId - Template type to use (default: 'ats-safe') - currently unused as we use React PDF
 */
export async function generatePdfWithTemplate(
  resumeData: OptimizedResume,
  templateId: TemplateType = 'ats-safe'
): Promise<Buffer> {
  logger.info('Generating PDF with template', { templateId });

  try {
    const cleanedData = cleanResumeData(resumeData);
    const html = renderTemplate(cleanedData, templateId);
    const pdfBuffer = await generatePdfFromHtml(html);
    logger.info('PDF generated successfully from HTML template', { templateId });
    return pdfBuffer;
  } catch (error) {
    logger.error('HTML-to-PDF generation failed, falling back', { templateId }, error);

    try {
      const pdfBuffer = await generatePdfFromReact(resumeData, templateId);
      logger.info('PDF generated successfully with React PDF fallback', { templateId });
      return pdfBuffer;
    } catch (reactError) {
      logger.error('React PDF generation failed, falling back to jsPDF', { templateId }, reactError);
    }

    const fallbackBuffer = await generatePdfFallback(resumeData);
    logger.info('Fallback PDF generated with jsPDF', { templateId });
    return fallbackBuffer;
  }
}

/**
 * Clean resume data by removing internal annotations and metadata
 * Removes patterns like "[Tip applied: ...]" from achievements
 */
export function cleanResumeData(resumeData: OptimizedResume): OptimizedResume {
  const cleaned = { ...resumeData };

  // Clean achievements in experience
  if (cleaned.experience) {
    cleaned.experience = cleaned.experience.map(exp => ({
      ...exp,
      achievements: exp.achievements?.map(achievement =>
        achievement.replace(/\[Tip applied:.*?\]/gi, '').trim()
      ) || []
    }));
  }

  return cleaned;
}

function mapOptimizedResumeToTemplateData(resumeData: OptimizedResume): ResumeData {
  const technical = resumeData.skills?.technical || [];
  const soft = resumeData.skills?.soft || [];
  const combinedSkills = [...technical, ...soft].filter(Boolean);

  return {
    personalInfo: {
      fullName: resumeData.contact?.name || '',
      email: resumeData.contact?.email || '',
      phone: resumeData.contact?.phone || '',
      location: resumeData.contact?.location || '',
      linkedin: resumeData.contact?.linkedin || '',
      website: resumeData.contact?.portfolio || ''
    },
    summary: resumeData.summary || '',
    experience: (resumeData.experience || []).map((exp) => ({
      company: exp.company || '',
      position: exp.title || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      description: '',
      achievements: exp.achievements || []
    })),
    education: (resumeData.education || []).map((edu) => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      graduationDate: edu.graduationDate || '',
      gpa: edu.gpa || ''
    })),
    skills: combinedSkills,
    certifications: (resumeData.certifications || []).map((cert) => ({
      name: cert,
      issuer: '',
      date: ''
    })),
    projects: (resumeData.projects || []).map((project) => ({
      name: project.name || '',
      description: project.description || '',
      technologies: project.technologies || []
    }))
  };
}

async function generatePdfFromExternalTemplate(
  templateSlug: string,
  resumeData: OptimizedResume,
  customization?: DesignCustomizationLike | null
): Promise<Buffer> {
  const templateData = mapOptimizedResumeToTemplateData(resumeData);
  const html = await renderTemplatePreview(templateSlug, templateData, customization || undefined);

  if (html.includes('Resume Preview Error')) {
    throw new Error(`Template render failed for ${templateSlug}`);
  }

  return generatePdfFromHtml(html);
}

/**
 * Generate PDF using React PDF renderer (serverless-compatible)
 * This works in Vercel without requiring Chrome/Puppeteer.
 *
 * When a templateSlug is provided and a styled template exists for it,
 * the PDF will match the browser design. Otherwise falls back to the
 * plain ResumePDF component.
 */
async function generatePdfFromReact(
  resumeData: OptimizedResume,
  templateSlug?: string | null,
  customization?: DesignCustomizationLike | null,
): Promise<Buffer> {
  try {
    // Clean resume data before rendering
    const cleanedData = cleanResumeData(resumeData);

    // Try to use a styled template matching the browser design
    const StyledTemplate = templateSlug ? getPdfTemplate(templateSlug) : null;

    let pdfDocument: React.ReactElement;

    if (StyledTemplate) {
      const basePalette = selectPalette(templateSlug!);
      const palette = applyCustomization(basePalette, customization);
      const isRTL = detectRTL(cleanedData);

      logger.info('Using styled React PDF template', { templateSlug, isRTL });
      pdfDocument = React.createElement(StyledTemplate, {
        resume: cleanedData,
        palette,
        isRTL,
      }) as React.ReactElement;
    } else {
      logger.info('Using plain React PDF (no styled template for slug)', { templateSlug });
      pdfDocument = React.createElement(ResumePDF, { resume: cleanedData }) as React.ReactElement;
    }

    // Render to buffer
    const pdfBuffer = await renderToBuffer(pdfDocument);

    logger.info('React PDF generated successfully', { size: pdfBuffer.length, styled: !!StyledTemplate });
    return pdfBuffer;
  } catch (error) {
    const errorDetails: Record<string, unknown> = { context: 'generatePdfFromReact', templateSlug };
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      errorDetails.stack = error.stack;
    }
    logger.error('React PDF generation failed', errorDetails, error);
    throw error; // Let the calling function handle the fallback
  }
}

/**
 * Generate PDF from optimized resume data
 * Uses React PDF renderer for serverless compatibility
 * For template selection, use generatePdfWithTemplate()
 */
export async function generatePdf(resumeData: OptimizedResume | string): Promise<Buffer> {
  logger.debug('generatePdf called', { inputType: typeof resumeData });

  // Handle legacy string input
  if (typeof resumeData === 'string') {
    logger.info('Legacy string input detected, using text-only PDF');
    return generateTextPdf(stripHtml(resumeData));
  }

  try {
    const cleanedData = cleanResumeData(resumeData);
    const html = renderTemplate(cleanedData, 'ats-safe');
    const pdfBuffer = await generatePdfFromHtml(html);
    logger.info('PDF generated successfully from HTML template', { inputType: typeof resumeData });
    return pdfBuffer;
  } catch (error) {
    logger.error('HTML-to-PDF generation failed in generatePdf', { inputType: typeof resumeData }, error);

    try {
      const pdfBuffer = await generatePdfFromReact(resumeData, null, null);
      logger.info('PDF generated successfully with React PDF fallback', { inputType: typeof resumeData });
      return pdfBuffer;
    } catch (reactError) {
      logger.error('React PDF fallback failed, using jsPDF', { inputType: typeof resumeData }, reactError);
    }

    return generatePdfFallback(resumeData);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateTextPdf(text: string): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 0.75;
  const maxWidth = pageWidth - 2 * margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = (10 / 72) * 1.2;

  let yPos = margin;
  for (const line of lines) {
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
    doc.text(line, margin, yPos);
    yPos += lineHeight;
  }

  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}

async function generatePdfFallback(resumeData: OptimizedResume): Promise<Buffer> {
  // Clean data before fallback generation
  const cleanedData = cleanResumeData(resumeData);

  return generateResumePDF(
    {
      personalInfo: {
        name: cleanedData.contact?.name,
        email: cleanedData.contact?.email,
        phone: cleanedData.contact?.phone,
        location: cleanedData.contact?.location,
        linkedin: cleanedData.contact?.linkedin,
        website: cleanedData.contact?.portfolio,
      },
      summary: cleanedData.summary,
      experience: cleanedData.experience?.map((exp) => ({
        title: exp.title,
        company: exp.company,
        location: exp.location,
        startDate: exp.startDate,
        endDate: exp.endDate,
        achievements: exp.achievements,
      })),
      education: cleanedData.education?.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        location: edu.location,
        graduationDate: edu.graduationDate,
        gpa: edu.gpa,
      })),
      skills: [
        { category: "Technical Skills", items: cleanedData.skills?.technical || [] },
        { category: "Soft Skills", items: cleanedData.skills?.soft || [] },
      ].filter((c) => c.items.length > 0),
      certifications: (cleanedData.certifications || []).map((cert) => ({
        name: cert,
      })),
      projects: cleanedData.projects?.map((project) => ({
        name: project.name,
        description: project.description,
        technologies: project.technologies,
      })),
    },
    "default"
  );
}

/**
 * Generate DOCX from optimized resume data
 */
export async function generateDocx(resumeData: OptimizedResume): Promise<Buffer> {
  const { contact, summary, skills, experience, education, certifications, projects } = resumeData;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Name
          new Paragraph({
            text: contact.name,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { after: 100 },
          }),

          // Contact Info
          new Paragraph({
            text: `${contact.email} | ${contact.phone} | ${contact.location}`,
            spacing: { after: 200 },
          }),

          // Summary
          new Paragraph({
            text: "PROFESSIONAL SUMMARY",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: summary,
            spacing: { after: 200 },
          }),

          // Skills
          new Paragraph({
            text: "SKILLS",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: skills.technical.join(" • "),
            spacing: { after: 200 },
          }),

          // Experience
          new Paragraph({
            text: "PROFESSIONAL EXPERIENCE",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          ...experience.flatMap(exp => [
            new Paragraph({
              text: exp.title,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${exp.company}, ${exp.location} | ${exp.startDate} - ${exp.endDate}`,
                  italics: true,
                }),
              ],
              spacing: { after: 100 },
            }),
            ...exp.achievements.map(achievement =>
              new Paragraph({
                text: achievement,
                bullet: { level: 0 },
                spacing: { after: 50 },
              })
            ),
          ]),

          // Education
          new Paragraph({
            text: "EDUCATION",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          ...education.flatMap(edu => [
            new Paragraph({
              text: edu.degree,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${edu.institution}, ${edu.location} | ${edu.graduationDate}`,
                  italics: true,
                }),
              ],
              spacing: { after: 100 },
            }),
          ]),

          // Certifications
          ...(certifications && certifications.length > 0 ? [
            new Paragraph({
              text: "CERTIFICATIONS",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...certifications.map(cert =>
              new Paragraph({
                text: cert,
                bullet: { level: 0 },
                spacing: { after: 50 },
              })
            ),
          ] : []),

          // Projects
          ...(projects && projects.length > 0 ? [
            new Paragraph({
              text: "PROJECTS",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...projects.flatMap(project => [
              new Paragraph({
                text: project.name,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 150 },
              }),
              new Paragraph({
                text: project.description,
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Technologies: ${project.technologies.join(", ")}`,
                    italics: true,
                  }),
                ],
                spacing: { after: 100 },
              }),
            ]),
          ] : []),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate PDF with design template and customizations
 * Feature 003: Design Selection Integration
 * Phase 3: Docker PDF Service Integration
 * Task: T041
 *
 * Fallback chain:
 * 1. Docker PDF Service (if configured and available)
 * 2. HTML template with Puppeteer
 * 3. React PDF renderer
 * 4. jsPDF fallback
 *
 * @param resumeData - Optimized resume data
 * @param optimizationId - Optimization UUID to fetch design assignment
 * @returns PDF buffer with applied design and customizations
 */
export async function generatePdfWithDesign(
  resumeData: OptimizedResume,
  optimizationId: string,
  options: PdfWithDesignOptions = {}
): Promise<PdfWithDesignResult> {
  logger.info('generatePdfWithDesign called', {
    optimizationId,
    skipDocker: options.skipDocker,
    hasDesignContext: !!options.designContext,
  });

  try {
    const cleanedData = cleanResumeData(resumeData);
    const defaultTemplateSlug = 'minimal-ssr';
    const { skipDocker, designContext } = options;

    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const resolvedContext = designContext ?? await resolvePdfDesignContext(
      supabase,
      optimizationId,
      user.id,
      defaultTemplateSlug
    );
    const { templateSlug, customization, usedDesignAssignment } = resolvedContext;

    // For ats-safe or default templates, skip external rendering
    if (templateSlug === "ats-safe" || templateSlug === "default") {
      logger.info('Using React PDF for default template', { templateSlug });
      const buffer = await generatePdfFromReact(cleanedData, templateSlug, customization);
      return {
        buffer,
        renderer: "react-pdf",
        templateSlug,
        usedDesignAssignment,
      };
    }

    if (!skipDocker) {
      // PHASE 3: Try Docker PDF Service first
      try {
        logger.info('Attempting Docker PDF service', { templateSlug });
        const dockerResult = await callPDFService(cleanedData, templateSlug, customization);
  
        if (dockerResult.success && dockerResult.pdfBase64) {
          const buffer = Buffer.from(dockerResult.pdfBase64, 'base64');
          logger.info('Docker service generated PDF successfully', { templateSlug, size: buffer.length });
          logger.info('Docker service metadata', {
            templateSlug: dockerResult.metadata?.templateSlug,
            size: buffer.length,
          });
  
          return {
            buffer,
            renderer: "docker",
            templateSlug,
            usedDesignAssignment,
          };
        }
  
        logger.warn('Docker service failed, falling back to local rendering', {
          templateSlug,
          error: dockerResult.error,
        });
      } catch (dockerError) {
        logger.warn('Docker service error, falling back to local rendering', { templateSlug }, dockerError);
      }
    } else {
      logger.info('Skipping Docker PDF service (already attempted)', { templateSlug });
    }

    // Fallback 2: HTML template with local Puppeteer
    if (!usedDesignAssignment) {
      try {
        const defaultTemplate = await getDesignTemplateBySlug(supabase, defaultTemplateSlug);
        const slug = defaultTemplate?.slug || defaultTemplateSlug;
        const buffer = await generatePdfFromExternalTemplate(
          slug,
          cleanedData,
          null
        );
        logger.info('HTML template generated successfully (no assignment)', { templateSlug: slug });
        return {
          buffer,
          renderer: "html",
          templateSlug: slug,
          usedDesignAssignment: false,
        };
      } catch (error) {
        logger.warn('Default template render failed, falling back to styled React PDF', {
          templateSlug: defaultTemplateSlug,
        }, error);
        const buffer = await generatePdfFromReact(cleanedData, defaultTemplateSlug, null);
        return {
          buffer,
          renderer: "react-pdf",
          templateSlug: defaultTemplateSlug,
          usedDesignAssignment: false,
        };
      }
    }

    // Fallback 3: HTML template with Puppeteer (with assignment)
    try {
      const buffer = await generatePdfFromExternalTemplate(
        templateSlug,
        cleanedData,
        customization
      );
      logger.info('HTML template generated successfully with assignment', { templateSlug });
      return {
        buffer,
        renderer: "html",
        templateSlug,
        usedDesignAssignment,
      };
    } catch (error) {
      logger.error('HTML template render failed, falling back to styled React PDF', { templateSlug }, error);
    }

    // Fallback 4: Styled React PDF
    const buffer = await generatePdfFromReact(cleanedData, templateSlug, customization);
    logger.info('Styled React PDF fallback used', { templateSlug });
    return {
      buffer,
      renderer: "react-pdf",
      templateSlug,
      usedDesignAssignment,
    };

  } catch (error) {
    logger.error('All primary PDF methods failed, using ultimate fallback', { optimizationId }, error);

    try {
      const buffer = await generatePdfFromReact(resumeData, null, null);
      logger.info('React PDF generated successfully with plain fallback', { optimizationId });
      return {
        buffer,
        renderer: "react-pdf",
        templateSlug: null,
        usedDesignAssignment: false,
      };
    } catch (reactError) {
      logger.error('React PDF generation failed in ultimate fallback, falling back to jsPDF', { optimizationId }, reactError);
    }

    const buffer = await generatePdfFallback(resumeData);
    logger.info('Fallback jsPDF generated PDF', { optimizationId });
    return {
      buffer,
      renderer: "jspdf",
      templateSlug: null,
      usedDesignAssignment: false,
    };
  }
}

/**
 * Generate DOCX with design customizations applied
 * Feature 003: Design Selection Integration
 * Task: T042
 *
 * Note: DOCX format has limited styling capabilities compared to HTML/PDF.
 * This function applies basic customizations like colors and fonts where possible.
 *
 * @param resumeData - Optimized resume data
 * @param optimizationId - Optimization UUID to fetch design assignment
 * @returns DOCX buffer with applied customizations
 */
export async function generateDocxWithDesign(
  resumeData: OptimizedResume,
  _optimizationId: string
): Promise<Buffer> {
  void _optimizationId;
  // For DOCX, we use the base DOCX generator
  // Design customizations are limited in DOCX format
  // Could enhance in the future to apply color schemes and font families
  // For now, use standard DOCX export
  return generateDocx(resumeData);
}
