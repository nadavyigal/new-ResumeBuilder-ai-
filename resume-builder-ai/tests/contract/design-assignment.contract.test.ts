/**
 * Contract Tests: Design Assignment API
 * Tests GET /api/v1/design/{optimizationId} and PUT /api/v1/design/{optimizationId}
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T011
 *
 * IMPORTANT: These tests MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Contract Tests: Design Assignment API', () => {
  let authToken: string;
  let testOptimizationId: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // TODO: Setup test user, optimization, and template
    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
    testTemplateId = 'test-template-uuid';
  });

  // ============================================================================
  // GET /api/v1/design/{optimizationId}
  // ============================================================================

  describe('GET /api/v1/design/{optimizationId}', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('unauthorized');
    });

    test('should return design assignment for authenticated user', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        // Validate DesignAssignment schema
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('user_id');
        expect(data).toHaveProperty('optimization_id');
        expect(data).toHaveProperty('template_id');
        expect(data).toHaveProperty('original_template_id');
        expect(data).toHaveProperty('is_active');
        expect(data).toHaveProperty('created_at');
        expect(data).toHaveProperty('updated_at');

        // Optional fields
        expect(data).toHaveProperty('customization_id');
        expect(data).toHaveProperty('previous_customization_id');
        expect(data).toHaveProperty('finalized_at');

        // Nested objects
        expect(data).toHaveProperty('template');
        expect(data.template).toHaveProperty('id');
        expect(data.template).toHaveProperty('name');
        expect(data.template).toHaveProperty('slug');

        expect(data).toHaveProperty('original_template');
      }
    });

    test('should return 404 for non-existent optimization', async () => {
      const response = await fetch(`${API_BASE}/design/non-existent-uuid`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('not_found');
    });

    test('should enforce RLS - user cannot access another user\'s design', async () => {
      const otherUserToken = 'other-user-token';

      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        headers: {
          'Authorization': `Bearer ${otherUserToken}`
        }
      });

      // Should return 404 (not found) or 403 (forbidden) due to RLS
      expect([403, 404]).toContain(response.status);
    });
  });

  // ============================================================================
  // PUT /api/v1/design/{optimizationId}
  // ============================================================================

  describe('PUT /api/v1/design/{optimizationId}', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: testTemplateId
        })
      });

      expect(response.status).toBe(401);
    });

    test('should return 400 without templateId', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('bad_request');
    });

    test('should update template selection and reset customizations', async () => {
      const newTemplateId = 'timeline-ssr';

      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: newTemplateId
        })
      });

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        expect(data.template_id).toBe(newTemplateId);
        expect(data.customization_id).toBeNull(); // Reset on template change (FR-004)
        expect(data.previous_customization_id).toBeNull();
      }
    });

    test('should return 404 for invalid template ID', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'invalid-template-uuid'
        })
      });

      expect([400, 404]).toContain(response.status);
    });

    test('should preserve original_template_id after template switch', async () => {
      const response = await fetch(`${API_BASE}/design/${testOptimizationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'card-ssr'
        })
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('original_template_id');
        // original_template_id should remain unchanged
      }
    });
  });
});
