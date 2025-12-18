import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import jsPDF from "jspdf";
import { OptimizedResume } from "./ai-optimizer";
import { generateResumePDF } from "./pdf-generator";
import { renderTemplate, TemplateType } from "./template-engine";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePDF } from "./pdf-renderer";
import React from "react";
import { createRouteHandlerClient } from "./supabase-server";
import { getDesignAssignment } from "./supabase/resume-designs";
import { getDesignTemplateById } from "./supabase/design-templates";
import { renderDesignPreviewHtml, type DesignCustomizationLike } from "./design-manager/render-preview-html";

async function generatePdfFromHtml(html: string): Promise<Buffer> {
  // Dynamic import so Next server bundling stays lean and still works with externals.
  const puppeteerModule = await import("puppeteer");
  const puppeteer = puppeteerModule.default ?? puppeteerModule;

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: ["domcontentloaded", "networkidle0"] });

    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0in",
        right: "0in",
        bottom: "0in",
        left: "0in",
      },
    });

    return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export type PdfRenderer = "html" | "react-pdf" | "jspdf";
export interface PdfWithDesignResult {
  buffer: Buffer;
  renderer: PdfRenderer;
  templateSlug: string | null;
  usedDesignAssignment: boolean;
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
  console.log(`[PDF] Generating PDF with template: ${templateId}`);

  try {
    const cleanedData = cleanResumeData(resumeData);
    const html = renderTemplate(cleanedData, templateId);
    const pdfBuffer = await generatePdfFromHtml(html);
    console.log('[PDF] PDF generated successfully from HTML template');
    return pdfBuffer;
  } catch (error) {
    console.error("[PDF] HTML-to-PDF generation failed, falling back:", error);

    try {
      const pdfBuffer = await generatePdfFromReact(resumeData);
      console.log('[PDF] PDF generated successfully with React PDF fallback');
      return pdfBuffer;
    } catch (reactError) {
      console.error("[PDF] React PDF generation failed, falling back to jsPDF:", reactError);
    }

    const fallbackBuffer = await generatePdfFallback(resumeData);
    console.log('[PDF] Fallback PDF generated with jsPDF');
    return fallbackBuffer;
  }
}

/**
 * Clean resume data by removing internal annotations and metadata
 * Removes patterns like "[Tip applied: ...]" from achievements
 */
function cleanResumeData(resumeData: OptimizedResume): OptimizedResume {
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

/**
 * Generate PDF using React PDF renderer (serverless-compatible)
 * This works in Vercel without requiring Chrome/Puppeteer
 */
async function generatePdfFromReact(resumeData: OptimizedResume): Promise<Buffer> {
  try {
    console.log('[PDF] Using @react-pdf/renderer for serverless PDF generation...');

    // Clean resume data before rendering
    const cleanedData = cleanResumeData(resumeData);

    // Create React PDF document
    const pdfDocument = React.createElement(ResumePDF, { resume: cleanedData });

    // Render to buffer
    const pdfBuffer = await renderToBuffer(pdfDocument);

    console.log('[PDF] React PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (error) {
    console.error('[PDF] React PDF generation failed:', error);
    console.error('[PDF] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Let the calling function handle the fallback
  }
}

/**
 * Generate PDF from optimized resume data
 * Uses React PDF renderer for serverless compatibility
 * For template selection, use generatePdfWithTemplate()
 */
export async function generatePdf(resumeData: OptimizedResume | string): Promise<Buffer> {
  console.log('[PDF] generatePdf called, input type:', typeof resumeData);

  // Handle legacy string input
  if (typeof resumeData === 'string') {
    console.log('[PDF] Legacy string input detected, using text-only PDF');
    return generateTextPdf(stripHtml(resumeData));
  }

  try {
    const cleanedData = cleanResumeData(resumeData);
    const html = renderTemplate(cleanedData, 'ats-safe');
    const pdfBuffer = await generatePdfFromHtml(html);
    console.log('[PDF] PDF generated successfully from HTML template');
    return pdfBuffer;
  } catch (error) {
    console.error("[PDF] HTML-to-PDF generation failed, falling back:", error);

    try {
      const pdfBuffer = await generatePdfFromReact(resumeData);
      console.log('[PDF] PDF generated successfully with React PDF fallback');
      return pdfBuffer;
    } catch (reactError) {
      console.error("[PDF] React PDF generation failed, falling back to jsPDF:", reactError);
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
 * @param optimizationId - Optimization UUID to fetch design assignment (currently unused)
 * @returns PDF buffer with applied design and customizations
 */
export async function generatePdfWithDesign(
  resumeData: OptimizedResume,
  optimizationId: string
): Promise<PdfWithDesignResult> {
  console.log('[PDF] generatePdfWithDesign called, using v1 design assignment if available');

  try {
    const cleanedData = cleanResumeData(resumeData);

    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const assignment = await getDesignAssignment(supabase, optimizationId, user.id);
    if (!assignment) {
      // No design assignment; return the stable serverless renderer.
      const buffer = await generatePdfFromReact(cleanedData);
      return {
        buffer,
        renderer: "react-pdf",
        templateSlug: null,
        usedDesignAssignment: false,
      };
    }

    const template = await getDesignTemplateById(supabase, assignment.template_id);
    const templateSlug = template?.slug || null;

    if (!templateSlug || templateSlug === "ats-safe" || templateSlug === "default") {
      const buffer = await generatePdfFromReact(cleanedData);
      return {
        buffer,
        renderer: "react-pdf",
        templateSlug,
        usedDesignAssignment: true,
      };
    }

    let customization: DesignCustomizationLike | null = null;
    if (assignment.customization_id) {
      const { data: customizationData } = await supabase
        .from("design_customizations")
        .select("*")
        .eq("id", assignment.customization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      customization = customizationData;
    }

    const html = renderDesignPreviewHtml({
      templateId: templateSlug,
      resumeData: cleanedData,
      customization,
      mode: "pdf",
      languagePreference: "auto",
    });

    const buffer = await generatePdfFromHtml(html);
    console.log('[PDF] PDF with design generated successfully from HTML');
    return {
      buffer,
      renderer: "html",
      templateSlug,
      usedDesignAssignment: true,
    };
  } catch (error) {
    console.error("[PDF] HTML-to-PDF generation failed, falling back:", error);

    try {
      const buffer = await generatePdfFromReact(resumeData);
      console.log('[PDF] PDF generated successfully with React PDF fallback');
      return {
        buffer,
        renderer: "react-pdf",
        templateSlug: null,
        usedDesignAssignment: false,
      };
    } catch (reactError) {
      console.error("[PDF] React PDF generation failed, falling back to jsPDF:", reactError);
    }

    const buffer = await generatePdfFallback(resumeData);
    console.log('[PDF] Fallback PDF generated with jsPDF');
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
