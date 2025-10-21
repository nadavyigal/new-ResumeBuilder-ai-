/**
 * Integration Test: Design Rendering Flow
 * Tests template loading from external library and SSR rendering with user data
 *
 * Reference: specs/003-i-want-to/quickstart.md (Step 2)
 * Task: T014
 *
 * IMPORTANT: This test MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';

describe('Integration Test: Design Rendering Flow', () => {
  const EXTERNAL_TEMPLATES_DIR = path.resolve(
    __dirname,
    '../../src/lib/templates/external'
  );

  // Sample resume data for testing
  const sampleResumeData = {
    personalInfo: {
      fullName: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/janedoe'
    },
    summary: 'Experienced Software Engineer with 5+ years in full-stack development.',
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        startDate: '2020-01',
        endDate: 'Present',
        description: 'Led development of microservices architecture.'
      }
    ],
    education: [
      {
        institution: 'University of California',
        degree: 'BS Computer Science',
        graduationDate: '2018'
      }
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL']
  };

  beforeAll(() => {
    // Verify templates were synced
    const templatesExist = fs.existsSync(EXTERNAL_TEMPLATES_DIR);
    if (!templatesExist) {
      throw new Error(
        'External templates not found. Run `npm run sync-templates` first.'
      );
    }
  });

  // ============================================================================
  // Test 1: Load External Template
  // ============================================================================

  test('should load card-ssr template from external library', async () => {
    const { loadTemplate } = await import('../../src/lib/design-manager/template-loader');

    const template = await loadTemplate('card-ssr');

    expect(template).toBeDefined();
    expect(typeof template).toBe('function'); // Should be a React component
  });

  test('should load all 4 seed templates', async () => {
    const { loadTemplate } = await import('../../src/lib/design-manager/template-loader');

    const templates = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];

    for (const slug of templates) {
      const template = await loadTemplate(slug);
      expect(template).toBeDefined();
    }
  });

  test('should throw error for invalid template', async () => {
    const { loadTemplate } = await import('../../src/lib/design-manager/template-loader');

    await expect(loadTemplate('invalid-template')).rejects.toThrow();
  });

  // ============================================================================
  // Test 2: Render Template with Sample Data
  // ============================================================================

  test('should render card-ssr template to HTML', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    expect(html).toBeDefined();
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(100);
  });

  test('rendered HTML should contain user data', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    // Verify personal info is in rendered HTML
    expect(html).toContain('Jane Doe');
    expect(html).toContain('jane.doe@example.com');
    expect(html).toContain('San Francisco, CA');
  });

  test('rendered HTML should contain experience data', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    expect(html).toContain('Tech Corp');
    expect(html).toContain('Senior Software Engineer');
  });

  test('rendered HTML should contain education data', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    expect(html).toContain('University of California');
    expect(html).toContain('BS Computer Science');
  });

  test('rendered HTML should contain skills', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    expect(html).toContain('JavaScript');
    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
  });

  // ============================================================================
  // Test 3: Performance Requirements (FR-007)
  // ============================================================================

  test('should render template within 5 seconds', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const startTime = Date.now();

    const html = renderTemplatePreview('card-ssr', sampleResumeData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    expect(html).toBeDefined();
    expect(duration).toBeLessThan(5); // FR-007: Must render in < 5 seconds
  });

  test('should render all 4 templates within 5 seconds each', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const templates = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];

    for (const slug of templates) {
      const startTime = Date.now();
      const html = renderTemplatePreview(slug, sampleResumeData);
      const duration = (Date.now() - startTime) / 1000;

      expect(html).toBeDefined();
      expect(duration).toBeLessThan(5);
    }
  }, 25000); // 25 second timeout for all 4 templates

  // ============================================================================
  // Test 4: Template Registry
  // ============================================================================

  test('should list all available templates from registry', async () => {
    const { listAvailableTemplates } = await import(
      '../../src/lib/design-manager/template-loader'
    );

    const templates = listAvailableTemplates();

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(4);
    expect(templates).toContain('minimal-ssr');
    expect(templates).toContain('card-ssr');
    expect(templates).toContain('sidebar-ssr');
    expect(templates).toContain('timeline-ssr');
  });

  // ============================================================================
  // Test 5: Data Transformation
  // ============================================================================

  test('should transform internal resume format to JSON Resume schema', async () => {
    const { transformToJsonResume } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const optimizedResume = {
      // Internal format from optimization
      content: {
        personalInfo: sampleResumeData.personalInfo,
        summary: sampleResumeData.summary,
        experience: sampleResumeData.experience,
        education: sampleResumeData.education,
        skills: sampleResumeData.skills
      }
    };

    const jsonResume = transformToJsonResume(optimizedResume);

    expect(jsonResume).toBeDefined();
    expect(jsonResume).toHaveProperty('basics');
    expect(jsonResume).toHaveProperty('work');
    expect(jsonResume).toHaveProperty('education');
    expect(jsonResume).toHaveProperty('skills');
  });

  // ============================================================================
  // Test 6: Error Handling
  // ============================================================================

  test('should handle missing resume data gracefully', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const emptyData = {};

    // Should not throw, but render with empty/placeholder data
    const html = renderTemplatePreview('card-ssr', emptyData);

    expect(html).toBeDefined();
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('should handle malformed resume data', async () => {
    const { renderTemplatePreview } = await import(
      '../../src/lib/design-manager/template-renderer'
    );

    const malformedData = {
      personalInfo: 'this should be an object',
      experience: 'not an array'
    };

    // Should not throw, but handle gracefully
    expect(() => {
      renderTemplatePreview('card-ssr', malformedData);
    }).not.toThrow();
  });
});
