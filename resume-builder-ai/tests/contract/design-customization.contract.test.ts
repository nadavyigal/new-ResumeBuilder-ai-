/**
 * Contract Tests: Design Customization API
 * Tests POST /api/v1/design/{optimizationId}/customize
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T012
 *
 * IMPORTANT: This test MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Contract Tests: Design Customization API', () => {
  let authToken: string;
  let testOptimizationId: string;

  beforeAll(async () => {
    // TODO: Setup test user and optimization with design assignment
    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
  });

  describe('POST /api/v1/design/{optimizationId}/customize', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'make headers blue'
          })
        }
      );

      expect(response.status).toBe(401);
    });

    test('should return 400 without changeRequest', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('bad_request');
    });

    test('should apply valid design customization request', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'make headers dark blue'
          })
        }
      );

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        // Validate response schema
        expect(data).toHaveProperty('customization');
        expect(data).toHaveProperty('preview');
        expect(data).toHaveProperty('changes');
        expect(data).toHaveProperty('reasoning');

        // Validate customization object
        const customization = data.customization;
        expect(customization).toHaveProperty('id');
        expect(customization).toHaveProperty('template_id');
        expect(customization).toHaveProperty('color_scheme');
        expect(customization).toHaveProperty('font_family');
        expect(customization).toHaveProperty('spacing_settings');
        expect(customization).toHaveProperty('is_ats_safe');

        // Validate preview is HTML
        expect(typeof data.preview).toBe('string');
        expect(data.preview).toContain('<');

        // Validate reasoning
        expect(typeof data.reasoning).toBe('string');
        expect(data.reasoning.length).toBeGreaterThan(10);
      }
    });

    test('should reject ATS-unsafe customization (FR-012)', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'add my photo in the top-right corner'
          })
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('ats_violation');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('validationErrors');

      // Validate ATSValidationError schema
      if (data.validationErrors && data.validationErrors.length > 0) {
        const error = data.validationErrors[0];
        expect(error).toHaveProperty('property');
        expect(error).toHaveProperty('value');
        expect(error).toHaveProperty('reason');
      }
    });

    test('should handle unclear customization request', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'make it look cooler'
          })
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('unclear_request');
      expect(data).toHaveProperty('clarificationNeeded');
      expect(typeof data.clarificationNeeded).toBe('string');
    });

    test('should apply color scheme changes', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'change primary color to dark blue'
          })
        }
      );

      if (response.status === 200) {
        const data = await response.json();

        expect(data.changes).toHaveProperty('color_scheme');
        expect(data.changes.color_scheme).toHaveProperty('primary');

        // Validate hex color format
        const primaryColor = data.customization.color_scheme.primary;
        expect(primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test('should apply font family changes', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'use Times New Roman for body text'
          })
        }
      );

      if (response.status === 200) {
        const data = await response.json();

        expect(data.changes).toHaveProperty('font_family');
        expect(data.changes.font_family).toHaveProperty('body');
        expect(data.customization.font_family.body).toBe('Times New Roman');
      }
    });

    test('should apply spacing changes', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'make the layout more compact'
          })
        }
      );

      if (response.status === 200) {
        const data = await response.json();

        if (data.changes.spacing_settings) {
          expect(data.customization.spacing_settings).toHaveProperty('compact');
          expect(data.customization.spacing_settings.compact).toBe(true);
        }
      }
    });

    test('should respond within 7 seconds (existing chat target)', async () => {
      const startTime = Date.now();

      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: 'make headers blue'
          })
        }
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      expect([200, 400, 404]).toContain(response.status);
      expect(duration).toBeLessThan(7);
    }, 10000);
  });
});
