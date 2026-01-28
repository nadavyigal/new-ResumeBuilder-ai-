/**
 * PDF Generation Module
 * Generates PDF resumes from optimization_data JSON
 */

import jsPDF from 'jspdf';

interface ResumeData {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{
    degree?: string;
    institution?: string;
    location?: string;
    graduationDate?: string;
    gpa?: string;
  }>;
  skills?: string[] | { category?: string; items?: string[] }[];
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
  }>;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Generate a PDF from resume optimization data
 * @param optimizationData - The JSON resume data from database
 * @param _template - Template key (default, modern, etc.) - currently unused
 * @returns Buffer containing the PDF
 */
export async function generateResumePDF(
  optimizationData: unknown,
  _template: string = 'default'
): Promise<Buffer> {
  void _template;
  // Create new PDF document (Letter size: 8.5" x 11")
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  // Parse the data (handle different possible structures)
  const resumeData = (typeof optimizationData === 'string'
    ? JSON.parse(optimizationData)
    : optimizationData) as ResumeData;
  const resumeDataRecord = resumeData as Record<string, any>;

  // Set up fonts and styles
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 0.75; // inches
  const contentWidth = pageWidth - (2 * margin);
  let yPos = margin;

  // Helper function to add text with word wrap
  const addText = (
    text: string,
    x: number,
    y: number,
    options: {
      fontSize?: number;
      fontStyle?: 'normal' | 'bold' | 'italic';
      maxWidth?: number;
      align?: 'left' | 'center' | 'right';
    } = {}
  ): number => {
    const {
      fontSize = 10,
      fontStyle = 'normal',
      maxWidth = contentWidth,
      align = 'left'
    } = options;

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);

    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize / 72 * 1.2; // Convert to inches with 1.2 line spacing

    lines.forEach((line: string, index: number) => {
      let xPos = x;
      if (align === 'center') {
        const textWidth = doc.getTextWidth(line);
        xPos = (pageWidth - textWidth) / 2;
      } else if (align === 'right') {
        const textWidth = doc.getTextWidth(line);
        xPos = pageWidth - margin - textWidth;
      }

      doc.text(line, xPos, y + (index * lineHeight));
    });

    return y + (lines.length * lineHeight);
  };

  // Add horizontal line
  const addLine = (y: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.01);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // Check if we need a new page
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  try {
    // === HEADER: Personal Information ===
    const personalInfo = (resumeData.personalInfo || resumeDataRecord.personal_info || {}) as Record<string, any>;
    const name = personalInfo.name || personalInfo.full_name || 'Resume';

    // Name (Large, centered)
    yPos = addText(name, margin, yPos, {
      fontSize: 18,
      fontStyle: 'bold',
      align: 'center'
    });
    yPos += 0.1;

    // Contact information (smaller, centered)
    const contactParts: string[] = [];
    if (personalInfo.email) contactParts.push(personalInfo.email);
    if (personalInfo.phone) contactParts.push(personalInfo.phone);
    if (personalInfo.location) contactParts.push(personalInfo.location);

    if (contactParts.length > 0) {
      yPos = addText(contactParts.join(' | '), margin, yPos, {
        fontSize: 9,
        align: 'center'
      });
      yPos += 0.05;
    }

    // Links (if present)
    const linkParts: string[] = [];
    if (personalInfo.linkedin) linkParts.push(personalInfo.linkedin);
    if (personalInfo.website) linkParts.push(personalInfo.website);

    if (linkParts.length > 0) {
      yPos = addText(linkParts.join(' | '), margin, yPos, {
        fontSize: 9,
        align: 'center'
      });
    }

    yPos += 0.2;
    addLine(yPos);
    yPos += 0.15;

    // === SUMMARY ===
    const summary = resumeData.summary || resumeDataRecord.professional_summary;
    if (summary) {
      checkPageBreak(0.5);
      yPos = addText('PROFESSIONAL SUMMARY', margin, yPos, {
        fontSize: 12,
        fontStyle: 'bold'
      });
      yPos += 0.1;
      yPos = addText(summary, margin, yPos, { fontSize: 10 });
      yPos += 0.2;
    }

    // === EXPERIENCE ===
    const experience = (resumeData.experience || resumeDataRecord.work_experience || []) as Array<Record<string, any>>;
    if (experience && experience.length > 0) {
      checkPageBreak(0.5);
      yPos = addText('PROFESSIONAL EXPERIENCE', margin, yPos, {
        fontSize: 12,
        fontStyle: 'bold'
      });
      yPos += 0.15;

      experience.forEach((job: Record<string, any>) => {
        checkPageBreak(0.8);

        // Job title and company
        const title = job.title || job.position || '';
        const company = job.company || job.organization || '';
        yPos = addText(`${title} | ${company}`, margin, yPos, {
          fontSize: 11,
          fontStyle: 'bold'
        });
        yPos += 0.05;

        // Location and dates
        const location = job.location || '';
        const dates = job.startDate && job.endDate
          ? `${job.startDate} - ${job.endDate}`
          : job.start_date && job.end_date
          ? `${job.start_date} - ${job.end_date}`
          : '';

        if (location || dates) {
          yPos = addText(`${location}${location && dates ? ' | ' : ''}${dates}`, margin, yPos, {
            fontSize: 9,
            fontStyle: 'italic'
          });
          yPos += 0.1;
        }

        // Description
        if (job.description) {
          yPos = addText(job.description, margin, yPos, { fontSize: 10 });
          yPos += 0.05;
        }

        // Achievements/bullets
        const achievements = job.achievements || job.bullets || [];
        achievements.forEach((achievement: string) => {
          checkPageBreak(0.3);
          yPos = addText(`• ${achievement}`, margin + 0.2, yPos, {
            fontSize: 10,
            maxWidth: contentWidth - 0.2
          });
          yPos += 0.05;
        });

        yPos += 0.15;
      });
    }

    // === EDUCATION ===
    const education = (resumeData.education || []) as Array<Record<string, any>>;
    if (education && education.length > 0) {
      checkPageBreak(0.5);
      yPos = addText('EDUCATION', margin, yPos, {
        fontSize: 12,
        fontStyle: 'bold'
      });
      yPos += 0.15;

      education.forEach((edu: Record<string, any>) => {
        checkPageBreak(0.4);

        const degree = edu.degree || '';
        const institution = edu.institution || edu.school || '';
        yPos = addText(`${degree} | ${institution}`, margin, yPos, {
          fontSize: 11,
          fontStyle: 'bold'
        });
        yPos += 0.05;

        const location = edu.location || '';
        const date = edu.graduationDate || edu.graduation_date || '';
        if (location || date) {
          yPos = addText(`${location}${location && date ? ' | ' : ''}${date}`, margin, yPos, {
            fontSize: 9,
            fontStyle: 'italic'
          });
        }

        if (edu.gpa) {
          yPos += 0.05;
          yPos = addText(`GPA: ${edu.gpa}`, margin, yPos, { fontSize: 10 });
        }

        yPos += 0.15;
      });
    }

    // === SKILLS ===
    const skills = (resumeData.skills || resumeDataRecord.skill_set || []) as Array<string | Record<string, any>>;
    if (skills && skills.length > 0) {
      checkPageBreak(0.5);
      yPos = addText('SKILLS', margin, yPos, {
        fontSize: 12,
        fontStyle: 'bold'
      });
      yPos += 0.1;

      // Handle different skill formats
      if (Array.isArray(skills) && typeof skills[0] === 'string') {
        // Simple array of strings
        yPos = addText(skills.join(', '), margin, yPos, { fontSize: 10 });
      } else if (Array.isArray(skills) && typeof skills[0] === 'object') {
        // Categorized skills
        const categorizedSkills = skills as Array<Record<string, any>>;
        categorizedSkills.forEach((category) => {
          checkPageBreak(0.3);
          const catName = category.category || category.name || '';
          const items = category.items || category.skills || [];

          if (catName) {
            yPos = addText(`${catName}:`, margin, yPos, {
              fontSize: 10,
              fontStyle: 'bold'
            });
            yPos += 0.05;
          }

          if (items.length > 0) {
            yPos = addText(items.join(', '), margin + 0.2, yPos, {
              fontSize: 10,
              maxWidth: contentWidth - 0.2
            });
            yPos += 0.1;
          }
        });
      }

      yPos += 0.1;
    }

    // === CERTIFICATIONS ===
    const certifications = (resumeData.certifications || resumeDataRecord.certificates || []) as Array<Record<string, any>>;
    if (certifications && certifications.length > 0) {
      checkPageBreak(0.5);
      yPos = addText('CERTIFICATIONS', margin, yPos, {
        fontSize: 12,
        fontStyle: 'bold'
      });
      yPos += 0.15;

      certifications.forEach((cert: Record<string, any>) => {
        checkPageBreak(0.3);
        const name = cert.name || cert.title || '';
        const issuer = cert.issuer || cert.organization || '';
        const date = cert.date || '';

        yPos = addText(
          `${name}${issuer ? ` - ${issuer}` : ''}${date ? ` (${date})` : ''}`,
          margin,
          yPos,
          { fontSize: 10 }
        );
        yPos += 0.1;
      });
    }

    // Convert PDF to buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);

  } catch (error) {
    console.error('Error generating PDF:', error);

    // Create a simple error PDF
    doc.setFontSize(14);
    doc.text('Error Generating Resume PDF', margin, margin);
    doc.setFontSize(10);
    doc.text('The resume data could not be formatted properly.', margin, margin + 0.3);
    doc.text('Please contact support for assistance.', margin, margin + 0.5);

    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }
}
