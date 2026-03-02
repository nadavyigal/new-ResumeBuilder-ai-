/**
 * Contract Test: Resume Templates and Export
 * Epic 4: Resume Templates and Export
 *
 * Validates FR-015 to FR-019:
 * - FR-015: At least two templates (ATS-Safe and Modern)
 * - FR-016: Preview in different templates
 * - FR-017: Export in PDF and Word formats
 * - FR-018: Preserve formatting consistency
 * - FR-019: Ensure ATS compatibility
 */

import { describe, it, expect } from '@jest/globals';
import {
  TEMPLATES,
  getAllTemplates,
  getFreeTemplates,
  getTemplate,
  renderTemplate,
  validateATSCompatibility,
  type TemplateType,
} from '@/lib/template-engine';
import { generatePdf, generatePdfWithTemplate, generateDocx } from '@/lib/export';
import type { OptimizedResume } from '@/lib/ai-optimizer';

const SAMPLE_OPTIMIZED_RESUME: OptimizedResume = {
  contact: {
    name: 'Jane Smith',
    email: 'jane.smith@email.com',
    phone: '(555) 987-6543',
    location: 'Seattle, WA',
    linkedin: 'linkedin.com/in/janesmith',
  },
  summary: 'Experienced software engineer with 6+ years building scalable web applications using React, TypeScript, and Node.js. Strong focus on performance optimization and clean architecture.',
  skills: {
    technical: ['React', 'TypeScript', 'Node.js', 'AWS', 'Docker', 'PostgreSQL'],
    soft: ['Leadership', 'Communication', 'Problem Solving'],
  },
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      location: 'Seattle, WA',
      startDate: '2020-01',
      endDate: 'Present',
      achievements: [
        'Led migration to React 18 improving performance by 40%',
        'Architected microservices infrastructure serving 2M+ users',
        'Mentored team of 4 junior engineers',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'StartupXYZ',
      location: 'San Francisco, CA',
      startDate: '2018-06',
      endDate: '2019-12',
      achievements: [
        'Built real-time collaboration features using WebSockets',
        'Reduced API latency by 50% through query optimization',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. in Computer Science',
      institution: 'University of Washington',
      location: 'Seattle, WA',
      graduationDate: '2018',
      gpa: '3.9',
    },
  ],
  certifications: [
    'AWS Certified Solutions Architect',
    'Certified Kubernetes Administrator',
  ],
  projects: [
    {
      name: 'Open Source Contribution',
      description: 'Core contributor to React ecosystem libraries with 10K+ downloads',
      technologies: ['React', 'TypeScript', 'Jest'],
    },
  ],
  matchScore: 87,
  keyImprovements: [
    'Enhanced technical skills section with relevant keywords',
    'Quantified achievements with specific metrics',
    'Aligned experience descriptions with job requirements',
  ],
  missingKeywords: ['GraphQL', 'Redis'],
};

describe('Epic 4: Templates and Export - FR-015 to FR-019', () => {
  describe('FR-015: Template Availability', () => {
    it('should have at least two templates available', () => {
      const templates = getAllTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates.length).toBe(4); // ats-safe, modern, professional, minimal
    });

    it('should include ATS-Safe template', () => {
      const atsSafeTemplate = getTemplate('ats-safe');

      expect(atsSafeTemplate).toBeDefined();
      expect(atsSafeTemplate?.id).toBe('ats-safe');
      expect(atsSafeTemplate?.name).toContain('ATS');
      expect(atsSafeTemplate?.isATSCompatible).toBe(true);
    });

    it('should include Modern template', () => {
      const modernTemplate = getTemplate('modern');

      expect(modernTemplate).toBeDefined();
      expect(modernTemplate?.id).toBe('modern');
      expect(modernTemplate?.name).toContain('Modern');
      expect(modernTemplate?.isATSCompatible).toBe(true);
    });

    it('should provide free templates (at least 2)', () => {
      const freeTemplates = getFreeTemplates();

      expect(freeTemplates.length).toBeGreaterThanOrEqual(2);
      expect(freeTemplates.every(t => !t.isPremium)).toBe(true);
    });

    it('should have premium templates for monetization', () => {
      const premiumTemplates = TEMPLATES.filter(t => t.isPremium);

      expect(premiumTemplates.length).toBeGreaterThan(0);
      expect(premiumTemplates.some(t => t.id === 'professional')).toBe(true);
      expect(premiumTemplates.some(t => t.id === 'minimal')).toBe(true);
    });

    it('should provide template metadata', () => {
      const template = getTemplate('ats-safe');

      expect(template?.name).toBeDefined();
      expect(template?.description).toBeDefined();
      expect(template?.features).toBeDefined();
      expect(Array.isArray(template?.features)).toBe(true);
      expect(template?.features.length).toBeGreaterThan(0);
    });

    it('should mark all templates as ATS compatible', () => {
      const templates = getAllTemplates();

      expect(templates.every(t => t.isATSCompatible === true)).toBe(true);
    });
  });

  describe('FR-016: Template Preview and Rendering', () => {
    it('should render ATS-Safe template as HTML', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.name);
    });

    it('should render Modern template as HTML', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');

      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.name);
    });

    it('should include all resume sections in rendered HTML', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      // Contact information
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.email);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.phone);

      // Summary
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.summary);

      // Skills
      expect(html).toContain('React');
      expect(html).toContain('TypeScript');

      // Experience
      expect(html).toContain('TechCorp');
      expect(html).toContain('Senior Software Engineer');

      // Education
      expect(html).toContain('University of Washington');

      // Certifications
      expect(html).toContain('AWS Certified Solutions Architect');

      // Projects
      expect(html).toContain('Open Source Contribution');
    });

    it('should render different templates with different styling', () => {
      const atsSafeHtml = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');
      const modernHtml = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');

      // Templates should have different CSS
      expect(atsSafeHtml).not.toBe(modernHtml);

      // ATS-safe should be simpler
      expect(atsSafeHtml.includes('Arial, Helvetica')).toBe(true);

      // Modern should have more styling
      expect(modernHtml.includes('Segoe UI')).toBe(true);
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalResume: OptimizedResume = {
        ...SAMPLE_OPTIMIZED_RESUME,
        certifications: undefined,
        projects: undefined,
      };

      const html = renderTemplate(minimalResume, 'ats-safe');

      expect(html).toBeDefined();
      expect(html).toContain(minimalResume.contact.name);
      // Should still render without errors
    });

    it('should fallback to ATS-safe template for invalid template ID', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'invalid-template' as TemplateType);

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
      // Should contain resume data
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.name);
    });
  });

  describe('FR-017: PDF and DOCX Export', () => {
    it('should generate PDF from optimized resume', async () => {
      const pdfBuffer = await generatePdf(SAMPLE_OPTIMIZED_RESUME);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // PDF magic number
      const header = pdfBuffer.toString('utf8', 0, 4);
      expect(header).toBe('%PDF');
    }, 30000);

    it('should generate PDF with template selection', async () => {
      const pdfBuffer = await generatePdfWithTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should generate DOCX from optimized resume', async () => {
      const docxBuffer = await generateDocx(SAMPLE_OPTIMIZED_RESUME);

      expect(Buffer.isBuffer(docxBuffer)).toBe(true);
      expect(docxBuffer.length).toBeGreaterThan(0);

      // DOCX is a ZIP file (PK header)
      const header = docxBuffer.toString('utf8', 0, 2);
      expect(header).toBe('PK');
    }, 30000);

    it('should generate different PDFs for different templates', async () => {
      const atsSafePdf = await generatePdfWithTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');
      const modernPdf = await generatePdfWithTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');

      expect(atsSafePdf).not.toEqual(modernPdf);
      expect(atsSafePdf.length).toBeGreaterThan(0);
      expect(modernPdf.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle legacy string input for PDF generation', async () => {
      const htmlString = '<html><body><h1>Test Resume</h1></body></html>';
      const pdfBuffer = await generatePdf(htmlString);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should produce reasonably sized export files', async () => {
      const pdfBuffer = await generatePdf(SAMPLE_OPTIMIZED_RESUME);
      const docxBuffer = await generateDocx(SAMPLE_OPTIMIZED_RESUME);

      // PDF should be < 500KB for a single-page resume
      expect(pdfBuffer.length).toBeLessThan(500 * 1024);

      // DOCX should be < 100KB
      expect(docxBuffer.length).toBeLessThan(100 * 1024);
    }, 30000);
  });

  describe('FR-018: Formatting Consistency', () => {
    it('should maintain consistent section structure across templates', () => {
      const templates: TemplateType[] = ['ats-safe', 'modern'];

      templates.forEach(templateId => {
        const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, templateId);

        // All templates should have these sections
        expect(html.toLowerCase()).toContain('professional summary');
        expect(html.toLowerCase()).toContain('skills');
        expect(html.toLowerCase()).toContain('experience');
        expect(html.toLowerCase()).toContain('education');
      });
    });

    it('should preserve contact information formatting', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.name);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.email);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.phone);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.location);
    });

    it('should preserve bullet points in experience section', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      SAMPLE_OPTIMIZED_RESUME.experience.forEach(exp => {
        exp.achievements.forEach(achievement => {
          expect(html).toContain(achievement);
        });
      });

      // Check for bullet list structure
      expect(html).toMatch(/<ul>[\s\S]*<li>/);
    });

    it('should maintain proper date formatting', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      expect(html).toContain('2020-01');
      expect(html).toContain('Present');
      expect(html).toContain('2018-06');
      expect(html).toContain('2019-12');
    });

    it('should preserve special characters and encoding', () => {
      const resumeWithSpecialChars: OptimizedResume = {
        ...SAMPLE_OPTIMIZED_RESUME,
        contact: {
          ...SAMPLE_OPTIMIZED_RESUME.contact,
          name: 'José García-Smith',
        },
      };

      const html = renderTemplate(resumeWithSpecialChars, 'ats-safe');

      expect(html).toContain('José');
      expect(html).toContain('García');
      expect(html).toContain('charset="UTF-8"');
    });
  });

  describe('FR-019: ATS Compatibility', () => {
    it('should validate ATS-safe template as compatible', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');
      const validation = validateATSCompatibility(html);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect tables as ATS incompatible', () => {
      const htmlWithTable = '<html><body><table><tr><td>Data</td></tr></table></body></html>';
      const validation = validateATSCompatibility(htmlWithTable);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues.some(issue => issue.includes('table'))).toBe(true);
    });

    it('should detect absolute positioning as incompatible', () => {
      const htmlWithAbsolute = '<html><style>div { position: absolute; }</style></html>';
      const validation = validateATSCompatibility(htmlWithAbsolute);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues.some(issue => issue.includes('absolute'))).toBe(true);
    });

    it('should warn about images in resume', () => {
      const htmlWithImage = '<html><body><img src="photo.jpg" /></body></html>';
      const validation = validateATSCompatibility(htmlWithImage);

      expect(validation.warnings.some(warning => warning.includes('image'))).toBe(true);
    });

    it('should warn about non-standard fonts', () => {
      const htmlWithFancyFont = '<html><style>body { font-family: "Comic Sans MS"; }</style></html>';
      const validation = validateATSCompatibility(htmlWithFancyFont);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should ensure ATS-safe template has no compatibility issues', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');
      const validation = validateATSCompatibility(html);

      expect(validation.issues.length).toBe(0);
      expect(validation.isCompatible).toBe(true);
    });

    it('should ensure Modern template is also ATS compatible', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');
      const validation = validateATSCompatibility(html);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues.length).toBe(0);
      // May have warnings for styling, but no blocking issues
    });

    it('should use standard fonts in templates', () => {
      const atsSafeHtml = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');
      const modernHtml = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'modern');

      // Check for standard ATS-friendly fonts
      const standardFonts = ['Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana', 'Tahoma'];

      const atsSafeHasSafe = standardFonts.some(font => atsSafeHtml.includes(font));
      const modernHasSafe = standardFonts.some(font => modernHtml.includes(font));

      expect(atsSafeHasSafe).toBe(true);
      expect(modernHasSafe).toBe(true);
    });
  });

  describe('Template Engine Integration', () => {
    it('should provide consistent API for all templates', () => {
      const templateIds: TemplateType[] = ['ats-safe', 'modern', 'professional', 'minimal'];

      templateIds.forEach(templateId => {
        const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, templateId);

        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('<!DOCTYPE html>');
      });
    });

    it('should handle all required resume fields', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      // Required fields
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.contact.name);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.summary);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.skills.technical[0]);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.experience[0].company);
      expect(html).toContain(SAMPLE_OPTIMIZED_RESUME.education[0].institution);
    });

    it('should generate valid HTML5', () => {
      const html = renderTemplate(SAMPLE_OPTIMIZED_RESUME, 'ats-safe');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('</html>');
    });
  });
});
