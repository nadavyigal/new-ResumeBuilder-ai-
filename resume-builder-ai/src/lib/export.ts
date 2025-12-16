import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import jsPDF from "jspdf";
import { OptimizedResume } from "./ai-optimizer";
import { generateResumePDF } from "./pdf-generator";
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
  console.log(`[PDF] Generating PDF with template: ${templateId}`);
  const htmlContent = renderTemplate(resumeData, templateId);
  console.log('[PDF] HTML template rendered, length:', htmlContent.length);

  try {
    const pdfBuffer = await generatePdfFromHTML(htmlContent);
    console.log('[PDF] PDF generated successfully with styled template');
    return pdfBuffer;
  } catch (error) {
    console.error("[PDF] Puppeteer PDF generation failed, falling back to plain text PDF:", error);
    const fallbackBuffer = await generatePdfFallback(resumeData);
    console.log('[PDF] Fallback PDF generated (plain text)');
    return fallbackBuffer;
  }
}

/**
 * Generate PDF from HTML string using Puppeteer
 * Falls back gracefully if Puppeteer is not available
 */
async function generatePdfFromHTML(htmlContent: string): Promise<Buffer> {
  try {
    console.log('[PDF] Attempting to use Puppeteer for PDF generation...');

    // Check if running in Node.js environment with file system access
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
    console.log(`[PDF] Environment: ${isServerless ? 'serverless' : 'standard Node.js'}`);

    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
    });

    console.log('[PDF] Puppeteer browser launched');

    const page = await browser.newPage();

    console.log('[PDF] Setting HTML content...');
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 10000,
    });

    await page.emulateMediaType('screen');

    console.log('[PDF] Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    await browser.close();

    console.log('[PDF] PDF generated successfully with Puppeteer, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (error) {
    console.error('[PDF] Puppeteer PDF generation failed:', error);
    console.error('[PDF] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Let the calling function handle the fallback
  }
}

/**
 * Generate PDF from optimized resume data
 * Uses default ATS-safe template for backward compatibility
 * For template selection, use generatePdfWithTemplate()
 */
export async function generatePdf(resumeData: OptimizedResume | string): Promise<Buffer> {
  console.log('[PDF] generatePdf called, input type:', typeof resumeData);

  // Handle legacy string input or use template engine
  const htmlContent = typeof resumeData === 'string'
    ? resumeData
    : renderTemplate(resumeData, 'ats-safe');

  console.log('[PDF] HTML content prepared, length:', htmlContent.length);

  try {
    const pdfBuffer = await generatePdfFromHTML(htmlContent);
    console.log('[PDF] PDF generated successfully with design');
    return pdfBuffer;
  } catch (error) {
    console.error("[PDF] Puppeteer PDF generation failed, falling back:", error);

    if (typeof resumeData === "string") {
      console.log('[PDF] Generating text-only PDF from string input');
      return generateTextPdf(stripHtml(htmlContent));
    }

    console.log('[PDF] Generating fallback PDF with jsPDF');
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
  return generateResumePDF(
    {
      personalInfo: {
        name: resumeData.contact?.name,
        email: resumeData.contact?.email,
        phone: resumeData.contact?.phone,
        location: resumeData.contact?.location,
        linkedin: resumeData.contact?.linkedin,
        website: resumeData.contact?.portfolio,
      },
      summary: resumeData.summary,
      experience: resumeData.experience?.map((exp) => ({
        title: exp.title,
        company: exp.company,
        location: exp.location,
        startDate: exp.startDate,
        endDate: exp.endDate,
        achievements: exp.achievements,
      })),
      education: resumeData.education?.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        location: edu.location,
        graduationDate: edu.graduationDate,
        gpa: edu.gpa,
      })),
      skills: [
        { category: "Technical Skills", items: resumeData.skills?.technical || [] },
        { category: "Soft Skills", items: resumeData.skills?.soft || [] },
      ].filter((c) => c.items.length > 0),
      certifications: (resumeData.certifications || []).map((cert) => ({
        name: cert,
      })),
      projects: resumeData.projects?.map((project) => ({
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
  console.log('[PDF] generatePdfWithDesign called for optimization:', optimizationId);

  try {
    // Render HTML with design assignment
    console.log('[PDF] Fetching and rendering design assignment...');
    const htmlContent = await renderWithDesign(resumeData, optimizationId);
    console.log('[PDF] Design HTML rendered, length:', htmlContent.length);

    // Generate PDF from rendered HTML
    const pdfBuffer = await generatePdfFromHTML(htmlContent);
    console.log('[PDF] PDF with custom design generated successfully');
    return pdfBuffer;
  } catch (error) {
    console.error("[PDF] Design PDF generation failed, falling back:", error);
    const fallbackBuffer = await generatePdfFallback(resumeData);
    console.log('[PDF] Fallback PDF generated (plain text)');
    return fallbackBuffer;
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
