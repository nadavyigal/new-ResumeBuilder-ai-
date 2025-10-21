/**
 * Contract Tests: Design Templates API
 * Tests GET /api/v1/design/templates and GET /api/v1/design/templates/{id}/preview
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Tasks: T008, T009
 *
 * IMPORTANT: These tests MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Contract Tests: Design Templates API', () => {
  let authToken: string;

  beforeAll(async () => {
    // TODO: Setup test user and get auth token
    // authToken = await getTestAuthToken();
    authToken = 'test-token'; // Placeholder
  });

  // ============================================================================
  // T008: GET /api/v1/design/templates
  // ============================================================================

  describe('GET /api/v1/design/templates', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/design/templates`);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('unauthorized');
    });

    test('should return array of templates for authenticated user', async () => {
      const response = await fetch(`${API_BASE}/design/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('templates');
      expect(Array.isArray(data.templates)).toBe(true);
    });

    test('should return templates with correct schema', async () => {
      const response = await fetch(`${API_BASE}/design/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      const template = data.templates[0];

      // Validate DesignTemplate schema from OpenAPI spec
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('slug');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('file_path');
      expect(template).toHaveProperty('is_premium');
      expect(template).toHaveProperty('ats_compatibility_score');
      expect(template).toHaveProperty('supported_customizations');
      expect(template).toHaveProperty('default_config');
      expect(template).toHaveProperty('created_at');
      expect(template).toHaveProperty('updated_at');

      // Validate types
      expect(typeof template.id).toBe('string');
      expect(typeof template.name).toBe('string');
      expect(typeof template.slug).toBe('string');
      expect(['modern', 'traditional', 'creative', 'corporate']).toContain(template.category);
      expect(typeof template.is_premium).toBe('boolean');
      expect(typeof template.ats_compatibility_score).toBe('number');
      expect(template.ats_compatibility_score).toBeGreaterThanOrEqual(0);
      expect(template.ats_compatibility_score).toBeLessThanOrEqual(100);
    });

    test('should filter templates by category', async () => {
      const response = await fetch(`${API_BASE}/design/templates?category=modern`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      const allModern = data.templates.every((t: any) => t.category === 'modern');
      expect(allModern).toBe(true);
    });

    test('should return at least 4 templates (seed data)', async () => {
      const response = await fetch(`${API_BASE}/design/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      expect(data.templates.length).toBeGreaterThanOrEqual(4);

      // Verify seed templates exist
      const slugs = data.templates.map((t: any) => t.slug);
      expect(slugs).toContain('minimal-ssr');
      expect(slugs).toContain('card-ssr');
      expect(slugs).toContain('sidebar-ssr');
      expect(slugs).toContain('timeline-ssr');
    });
  });

  // ============================================================================
  // T009: GET /api/v1/design/templates/{id}/preview
  // ============================================================================

  describe('GET /api/v1/design/templates/{templateId}/preview', () => {
    const testTemplateId = 'minimal-ssr'; // Use slug as ID for testing

    test('should return HTML for template preview', async () => {
      const response = await fetch(
        `${API_BASE}/design/templates/${testTemplateId}/preview`
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html.length).toBeGreaterThan(100); // Should have meaningful content
    });

    test('should render with sample data when no optimizationId provided', async () => {
      const response = await fetch(
        `${API_BASE}/design/templates/${testTemplateId}/preview`
      );

      const html = await response.text();
      // Should contain placeholder or sample data
      expect(html).toContain('<'); // Basic HTML structure
    });

    test('should render with user data when optimizationId provided', async () => {
      const testOptimizationId = 'test-optimization-uuid';

      const response = await fetch(
        `${API_BASE}/design/templates/${testTemplateId}/preview?optimizationId=${testOptimizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // May return 404 if optimization doesn't exist, which is fine for contract test
      expect([200, 404]).toContain(response.status);
    });

    test('should include Cache-Control header', async () => {
      const response = await fetch(
        `${API_BASE}/design/templates/${testTemplateId}/preview`
      );

      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toContain('max-age');
    });

    test('should return 404 for invalid template ID', async () => {
      const response = await fetch(
        `${API_BASE}/design/templates/invalid-template-id/preview`
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('not_found');
    });

    test('should render within 5 seconds (FR-007 performance requirement)', async () => {
      const startTime = Date.now();

      const response = await fetch(
        `${API_BASE}/design/templates/${testTemplateId}/preview`
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5); // Must render in < 5 seconds
    }, 10000); // 10 second test timeout
  });
});
