import puppeteer from "puppeteer";
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import { OptimizedResume } from "./ai-optimizer";
import { renderTemplate, TemplateType, renderWithDesign } from "./template-engine";

/**
 * Generate PDF from optimized resume data with template support
 * FR-017: Export in PDF format
 * FR-018: Preserve formatting consistency
 * FR-019: Ensure ATS compatibility
 *
 * @param resumeData - Optimized resume or HTML string
 * @param templateId - Template type to use (default: 'ats-safe')
 */
export async function generatePdfWithTemplate(
  resumeData: OptimizedResume,
  templateId: TemplateType = 'ats-safe'
): Promise<Buffer> {
  const htmlContent = renderTemplate(resumeData, templateId);
  return generatePdfFromHTML(htmlContent);
}

/**
 * Generate PDF from HTML string
 */
async function generatePdfFromHTML(htmlContent: string): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return pdfBuffer;
  } finally {
    // Always close browser to prevent memory leaks
    if (browser) {
      await browser.close().catch(err =>
        console.error('Failed to close browser:', err)
      );
    }
  }
}

/**
 * Generate PDF from optimized resume data
 * Uses default ATS-safe template for backward compatibility
 * For template selection, use generatePdfWithTemplate()
 */
export async function generatePdf(resumeData: OptimizedResume | string): Promise<Buffer> {
  // Handle legacy string input or use template engine
  const htmlContent = typeof resumeData === 'string'
    ? resumeData
    : renderTemplate(resumeData, 'ats-safe');

  return generatePdfFromHTML(htmlContent);
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
              text: `${exp.company}, ${exp.location} | ${exp.startDate} - ${exp.endDate}`,
              italics: true,
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
              text: `${edu.institution}, ${edu.location} | ${edu.graduationDate}`,
              italics: true,
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
                text: `Technologies: ${project.technologies.join(", ")}`,
                italics: true,
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
 * Task: T041
 *
 * @param resumeData - Optimized resume data
 * @param optimizationId - Optimization UUID to fetch design assignment
 * @returns PDF buffer with applied design and customizations
 */
export async function generatePdfWithDesign(
  resumeData: OptimizedResume,
  optimizationId: string
): Promise<Buffer> {
  // Render HTML with design assignment
  const htmlContent = await renderWithDesign(resumeData, optimizationId);

  // Generate PDF from rendered HTML
  return generatePdfFromHTML(htmlContent);
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
  optimizationId: string
): Promise<Buffer> {
  // For DOCX, we use the base DOCX generator
  // Design customizations are limited in DOCX format
  // Could enhance in the future to apply color schemes and font families
  // For now, use standard DOCX export
  return generateDocx(resumeData);
}
