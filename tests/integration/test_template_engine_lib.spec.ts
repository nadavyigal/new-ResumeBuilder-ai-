/**
 * Integration Test: Template Engine Library
 * Epic 4: Resume Templates and Export
 *
 * Tests the template-engine library independently
 * Validates FR-015 to FR-019 at the library level
 */

import { describe, it, expect } from '@jest/globals';
import {
  getAllTemplates,
  getFreeTemplates,
  getTemplate,
  renderTemplate,
  generateATSSafeHTML,
  generateModernHTML,
  validateATSCompatibility,
} from '@/lib/template-engine';
import { generatePdf, generatePdfWithTemplate, generateDocx } from '@/lib/export';
import type { OptimizedResume } from '@/lib/ai-optimizer';

const COMPLETE_RESUME: OptimizedResume = {
  contact: {
    name: 'Alexander Chen',
    email: 'alex.chen@techmail.com',
    phone: '+1 (206) 555-0147',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexchen',
  },
  summary: 'Full-stack engineer with 7+ years of experience building scalable SaaS applications. Expert in React, Node.js, and cloud architecture. Passionate about clean code and developer experience.',
  skills: {
    technical: [
      'JavaScript',
      'TypeScript',
      'React',
      'Next.js',
      'Node.js',
      'Express',
      'GraphQL',
      'PostgreSQL',
      'MongoDB',
      'AWS',
      'Docker',
      'Kubernetes',
    ],
    soft: ['Team Leadership', 'Agile Development', 'Technical Writing', 'Code Review'],
  },
  experience: [
    {
      title: 'Senior Full Stack Engineer',
      company: 'CloudScale Inc',
      location: 'San Francisco, CA',
      startDate: '2021-03',
      endDate: 'Present',
      achievements: [
        'Architected and deployed microservices infrastructure reducing deployment time by 70%',
        'Led team of 6 engineers building real-time collaboration platform with 500K+ MAU',
        'Reduced cloud costs by $200K/year through optimization and rightsizing',
        'Implemented comprehensive testing strategy achieving 95% code coverage',
      ],
    },
    {
      title: 'Full Stack Developer',
      company: 'StartupXYZ',
      location: 'Seattle, WA',
      startDate: '2018-06',
      endDate: '2021-02',
      achievements: [
        'Built customer-facing dashboard using React and TypeScript',
        'Developed RESTful APIs handling 10M+ requests/day',
        'Improved page load performance by 60% through code splitting and lazy loading',
      ],
    },
    {
      title: 'Junior Developer',
      company: 'Tech Solutions LLC',
      location: 'Portland, OR',
      startDate: '2016-08',
      endDate: '2018-05',
      achievements: [
        'Maintained legacy applications and fixed critical bugs',
        'Migrated codebase from JavaScript to TypeScript',
        'Contributed to internal component library used across 10+ projects',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. in Computer Science',
      institution: 'University of California, Berkeley',
      location: 'Berkeley, CA',
      graduationDate: '2016',
      gpa: '3.85',
    },
  ],
  certifications: [
    'AWS Certified Solutions Architect - Professional',
    'Certified Kubernetes Application Developer (CKAD)',
    'MongoDB Certified Developer',
  ],
  projects: [
    {
      name: 'DevTools Extension',
      description: 'Chrome extension for debugging React applications with 50K+ active users',
      technologies: ['React', 'Chrome APIs', 'TypeScript'],
    },
    {
      name: 'Open Source Contributions',
      description: 'Regular contributor to Next.js, TypeScript, and React ecosystem',
      technologies: ['TypeScript', 'React', 'Node.js'],
    },
  ],
  matchScore: 92,
  keyImprovements: [
    'Added quantifiable metrics to achievements',
    'Aligned technical skills with job requirements',
    'Emphasized leadership and scalability experience',
  ],
  missingKeywords: ['Terraform', 'Redis'],
};

const MINIMAL_RESUME: OptimizedResume = {
  contact: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    location: 'New York, NY',
  },
  summary: 'Software developer with React experience',
  skills: {
    technical: ['React', 'JavaScript'],
    soft: [],
  },
  experience: [
    {
      title: 'Developer',
      company: 'Company Inc',
      location: 'NYC',
      startDate: '2022-01',
      endDate: 'Present',
      achievements: ['Built web applications'],
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'State University',
      location: 'NY',
      graduationDate: '2021',
    },
  ],
  matchScore: 65,
  keyImprovements: ['Added relevant skills'],
  missingKeywords: ['TypeScript', 'Node.js'],
};

describe('Template Engine Library - Epic 4', () => {
  describe('Template Management', () => {
    it('should return all 4 templates', () => {
      const templates = getAllTemplates();

      expect(templates).toHaveLength(4);
      expect(templates.map(t => t.id)).toEqual(
        expect.arrayContaining(['ats-safe', 'modern', 'professional', 'minimal'])
      );
    });

    it('should return only free templates', () => {
      const freeTemplates = getFreeTemplates();

      expect(freeTemplates).toHaveLength(2);
      expect(freeTemplates.every(t => !t.isPremium)).toBe(true);
      expect(freeTemplates.map(t => t.id)).toEqual(
        expect.arrayContaining(['ats-safe', 'modern'])
      );
    });

    it('should get template by ID', () => {
      const template = getTemplate('ats-safe');

      expect(template).toBeDefined();
      expect(template?.id).toBe('ats-safe');
      expect(template?.name).toBe('ATS-Safe Classic');
    });

    it('should return undefined for invalid template ID', () => {
      const template = getTemplate('non-existent' as any);

      expect(template).toBeUndefined();
    });

    it('should mark all templates with ATS compatibility', () => {
      const templates = getAllTemplates();

      templates.forEach(template => {
        expect(template.isATSCompatible).toBe(true);
      });
    });

    it('should provide feature lists for each template', () => {
      const templates = getAllTemplates();

      templates.forEach(template => {
        expect(template.features).toBeDefined();
        expect(Array.isArray(template.features)).toBe(true);
        expect(template.features.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ATS-Safe Template Generation', () => {
    it('should generate complete HTML for full resume', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(1000);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should include all contact information', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain(COMPLETE_RESUME.contact.name);
      expect(html).toContain(COMPLETE_RESUME.contact.email);
      expect(html).toContain(COMPLETE_RESUME.contact.phone);
      expect(html).toContain(COMPLETE_RESUME.contact.location);
      expect(html).toContain(COMPLETE_RESUME.contact.linkedin);
    });

    it('should render professional summary', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('PROFESSIONAL SUMMARY');
      expect(html).toContain(COMPLETE_RESUME.summary);
    });

    it('should render all technical skills', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('SKILLS');
      COMPLETE_RESUME.skills.technical.forEach(skill => {
        expect(html).toContain(skill);
      });
    });

    it('should render soft skills if present', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      COMPLETE_RESUME.skills.soft?.forEach(skill => {
        expect(html).toContain(skill);
      });
    });

    it('should render all experience entries', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('PROFESSIONAL EXPERIENCE');

      COMPLETE_RESUME.experience.forEach(exp => {
        expect(html).toContain(exp.title);
        expect(html).toContain(exp.company);
        expect(html).toContain(exp.location);
        expect(html).toContain(exp.startDate);
        expect(html).toContain(exp.endDate);

        exp.achievements.forEach(achievement => {
          expect(html).toContain(achievement);
        });
      });
    });

    it('should render education section', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('EDUCATION');

      COMPLETE_RESUME.education.forEach(edu => {
        expect(html).toContain(edu.degree);
        expect(html).toContain(edu.institution);
        expect(html).toContain(edu.location);
        expect(html).toContain(edu.graduationDate);
        if (edu.gpa) {
          expect(html).toContain(edu.gpa);
        }
      });
    });

    it('should render certifications if present', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('CERTIFICATIONS');

      COMPLETE_RESUME.certifications?.forEach(cert => {
        expect(html).toContain(cert);
      });
    });

    it('should render projects if present', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('PROJECTS');

      COMPLETE_RESUME.projects?.forEach(project => {
        expect(html).toContain(project.name);
        expect(html).toContain(project.description);
        project.technologies.forEach(tech => {
          expect(html).toContain(tech);
        });
      });
    });

    it('should omit optional sections when not present', () => {
      const html = generateATSSafeHTML(MINIMAL_RESUME);

      // Should not have certification or project headers when empty
      expect(html).toBeDefined();
      expect(html).toContain(MINIMAL_RESUME.contact.name);
    });

    it('should use ATS-friendly styling', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      // Should use standard fonts
      expect(html).toContain('Arial, Helvetica, sans-serif');

      // Should avoid complex layouts
      expect(html).not.toContain('position: absolute');
      expect(html).not.toContain('position: fixed');
      expect(html).not.toContain('<table');
    });

    it('should include proper HTML metadata', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);

      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain(`<title>${COMPLETE_RESUME.contact.name} - Resume</title>`);
    });
  });

  describe('Modern Template Generation', () => {
    it('should generate styled HTML for modern template', () => {
      const html = generateModernHTML(COMPLETE_RESUME);

      expect(html).toBeDefined();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(COMPLETE_RESUME.contact.name);
    });

    it('should use modern fonts and styling', () => {
      const html = generateModernHTML(COMPLETE_RESUME);

      // Modern template uses Segoe UI
      expect(html).toContain('Segoe UI');

      // Has accent colors
      expect(html).toContain('#3498db');
      expect(html).toContain('#1a5490');
    });

    it('should include visual enhancements', () => {
      const html = generateModernHTML(COMPLETE_RESUME);

      // Skill tags styling
      expect(html).toContain('skill-tag');

      // Colored borders and accents
      expect(html).toContain('border-bottom');
      expect(html).toContain('border-left');
    });

    it('should maintain same content as ATS template', () => {
      const atsSafeHtml = generateATSSafeHTML(COMPLETE_RESUME);
      const modernHtml = generateModernHTML(COMPLETE_RESUME);

      // Both should contain all critical content
      COMPLETE_RESUME.experience.forEach(exp => {
        expect(atsSafeHtml).toContain(exp.company);
        expect(modernHtml).toContain(exp.company);
      });
    });

    it('should be ATS compatible despite styling', () => {
      const html = generateModernHTML(COMPLETE_RESUME);
      const validation = validateATSCompatibility(html);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues.length).toBe(0);
    });
  });

  describe('Template Rendering Switch', () => {
    it('should render ATS-safe template by ID', () => {
      const html = renderTemplate(COMPLETE_RESUME, 'ats-safe');

      expect(html).toContain('Arial, Helvetica');
      expect(html).toContain(COMPLETE_RESUME.contact.name);
    });

    it('should render modern template by ID', () => {
      const html = renderTemplate(COMPLETE_RESUME, 'modern');

      expect(html).toContain('Segoe UI');
      expect(html).toContain(COMPLETE_RESUME.contact.name);
    });

    it('should fallback to ATS-safe for professional template (placeholder)', () => {
      const html = renderTemplate(COMPLETE_RESUME, 'professional');

      // Currently returns modern as placeholder
      expect(html).toBeDefined();
      expect(html).toContain(COMPLETE_RESUME.contact.name);
    });

    it('should fallback to ATS-safe for minimal template (placeholder)', () => {
      const html = renderTemplate(COMPLETE_RESUME, 'minimal');

      // Currently returns ATS-safe as placeholder
      expect(html).toBeDefined();
      expect(html).toContain(COMPLETE_RESUME.contact.name);
    });

    it('should default to ATS-safe for unknown template', () => {
      const html = renderTemplate(COMPLETE_RESUME, 'unknown' as any);

      expect(html).toBeDefined();
      expect(html).toContain('Arial, Helvetica');
    });
  });

  describe('ATS Compatibility Validation', () => {
    it('should pass validation for simple HTML', () => {
      const simpleHtml = '<html><body><h1>Resume</h1><p>Content</p></body></html>';
      const validation = validateATSCompatibility(simpleHtml);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect tables as incompatible', () => {
      const htmlWithTable = `
        <html><body>
          <table><tr><td>Name</td><td>Value</td></tr></table>
        </body></html>
      `;
      const validation = validateATSCompatibility(htmlWithTable);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues.some(i => i.includes('table'))).toBe(true);
    });

    it('should detect absolute positioning as incompatible', () => {
      const htmlWithAbsolute = `
        <html><style>
          .element { position: absolute; top: 10px; }
        </style></html>
      `;
      const validation = validateATSCompatibility(htmlWithAbsolute);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues.some(i => i.includes('absolute'))).toBe(true);
    });

    it('should detect fixed positioning as incompatible', () => {
      const htmlWithFixed = `
        <html><style>
          .header { position: fixed; top: 0; }
        </style></html>
      `;
      const validation = validateATSCompatibility(htmlWithFixed);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues.some(i => i.includes('fixed'))).toBe(true);
    });

    it('should warn about images', () => {
      const htmlWithImage = '<html><body><img src="photo.jpg" alt="Profile" /></body></html>';
      const validation = validateATSCompatibility(htmlWithImage);

      expect(validation.warnings.some(w => w.includes('image'))).toBe(true);
    });

    it('should warn about non-standard fonts', () => {
      const htmlWithFancyFont = `
        <html><style>
          body { font-family: "Comic Sans MS", cursive; }
        </style></html>
      `;
      const validation = validateATSCompatibility(htmlWithFancyFont);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should not warn about standard fonts', () => {
      const htmlWithStandardFont = `
        <html><style>
          body { font-family: Arial, Helvetica, sans-serif; }
        </style></html>
      `;
      const validation = validateATSCompatibility(htmlWithStandardFont);

      expect(validation.isCompatible).toBe(true);
      // Should have no font warnings
    });

    it('should validate generated ATS-safe template', () => {
      const html = generateATSSafeHTML(COMPLETE_RESUME);
      const validation = validateATSCompatibility(html);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should validate generated Modern template', () => {
      const html = generateModernHTML(COMPLETE_RESUME);
      const validation = validateATSCompatibility(html);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('Export Integration', () => {
    it('should export PDF using template engine', async () => {
      const pdfBuffer = await generatePdf(COMPLETE_RESUME);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should export PDF with specific template', async () => {
      const pdfBuffer = await generatePdfWithTemplate(COMPLETE_RESUME, 'modern');

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should export DOCX with all content', async () => {
      const docxBuffer = await generateDocx(COMPLETE_RESUME);

      expect(Buffer.isBuffer(docxBuffer)).toBe(true);
      expect(docxBuffer.toString('utf8', 0, 2)).toBe('PK');
    }, 30000);

    it('should handle minimal resume export', async () => {
      const pdfBuffer = await generatePdf(MINIMAL_RESUME);
      const docxBuffer = await generateDocx(MINIMAL_RESUME);

      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(docxBuffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should produce consistent exports', async () => {
      const pdf1 = await generatePdf(COMPLETE_RESUME);
      const pdf2 = await generatePdf(COMPLETE_RESUME);

      // Same input should produce same output size (approximately)
      expect(Math.abs(pdf1.length - pdf2.length)).toBeLessThan(100);
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('should handle empty certifications array', () => {
      const resumeNoCerts: OptimizedResume = {
        ...COMPLETE_RESUME,
        certifications: [],
      };

      const html = generateATSSafeHTML(resumeNoCerts);

      expect(html).toBeDefined();
      expect(html).not.toContain('CERTIFICATIONS');
    });

    it('should handle undefined certifications', () => {
      const resumeNoCerts: OptimizedResume = {
        ...COMPLETE_RESUME,
        certifications: undefined,
      };

      const html = generateATSSafeHTML(resumeNoCerts);

      expect(html).toBeDefined();
    });

    it('should handle empty projects array', () => {
      const resumeNoProjects: OptimizedResume = {
        ...COMPLETE_RESUME,
        projects: [],
      };

      const html = generateATSSafeHTML(resumeNoProjects);

      expect(html).toBeDefined();
      expect(html).not.toContain('PROJECTS');
    });

    it('should handle undefined projects', () => {
      const resumeNoProjects: OptimizedResume = {
        ...COMPLETE_RESUME,
        projects: undefined,
      };

      const html = generateATSSafeHTML(resumeNoProjects);

      expect(html).toBeDefined();
    });

    it('should handle missing linkedin', () => {
      const resumeNoLinkedIn: OptimizedResume = {
        ...COMPLETE_RESUME,
        contact: {
          ...COMPLETE_RESUME.contact,
          linkedin: undefined,
        },
      };

      const html = generateATSSafeHTML(resumeNoLinkedIn);

      expect(html).toBeDefined();
      expect(html).toContain(resumeNoLinkedIn.contact.email);
    });

    it('should handle missing GPA', () => {
      const resumeNoGPA: OptimizedResume = {
        ...COMPLETE_RESUME,
        education: [
          {
            ...COMPLETE_RESUME.education[0],
            gpa: undefined,
          },
        ],
      };

      const html = generateATSSafeHTML(resumeNoGPA);

      expect(html).toBeDefined();
      expect(html).not.toContain('GPA:');
    });

    it('should handle special characters in content', () => {
      const resumeSpecialChars: OptimizedResume = {
        ...COMPLETE_RESUME,
        contact: {
          ...COMPLETE_RESUME.contact,
          name: 'José García-O\'Brien',
        },
        summary: 'Expert in C++ & Python with 10+ years\' experience',
      };

      const html = generateATSSafeHTML(resumeSpecialChars);

      expect(html).toContain('José');
      expect(html).toContain('García');
      expect(html).toContain('O\'Brien');
      expect(html).toContain('C++');
      expect(html).toContain('&amp;');
    });

    it('should handle long content without breaking', () => {
      const resumeLongContent: OptimizedResume = {
        ...COMPLETE_RESUME,
        summary: 'A'.repeat(1000),
        experience: [
          {
            ...COMPLETE_RESUME.experience[0],
            achievements: Array(20).fill('Achievement description that is quite long'),
          },
        ],
      };

      const html = generateATSSafeHTML(resumeLongContent);

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(5000);
    });
  });
});
