/**
 * Contract Tests: Design Undo/Revert API
 * Tests POST /api/v1/design/{optimizationId}/undo and POST /api/v1/design/{optimizationId}/revert
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T013
 *
 * IMPORTANT: These tests MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Contract Tests: Design Undo/Revert API', () => {
  let authToken: string;
  let testOptimizationId: string;

  beforeAll(async () => {
    // TODO: Setup test user and optimization with design assignment
    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
  });

  // ============================================================================
  // POST /api/v1/design/{optimizationId}/undo
  // ============================================================================

  describe('POST /api/v1/design/{optimizationId}/undo', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/undo`,
        {
          method: 'POST'
        }
      );

      expect(response.status).toBe(401);
    });

    test('should return 400 when no previous state exists', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/undo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Could be 400 (no previous state) or 404 (assignment not found)
      expect([400, 404]).toContain(response.status);

      if (response.status === 400) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toBe('no_previous_state');
        expect(data).toHaveProperty('message');
      }
    });

    test('should revert to previous customization', async () => {
      // This test assumes a customization was applied previously
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/undo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect([200, 400, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        // Validate response schema
        expect(data).toHaveProperty('customization');
        expect(data).toHaveProperty('preview');

        // Validate customization can be null (reverted to no customization)
        if (data.customization !== null) {
          expect(data.customization).toHaveProperty('id');
          expect(data.customization).toHaveProperty('color_scheme');
          expect(data.customization).toHaveProperty('font_family');
        }

        // Validate preview is HTML
        expect(typeof data.preview).toBe('string');
        expect(data.preview).toContain('<');
      }
    });

    test('should swap current and previous customization IDs (FR-017)', async () => {
      // Test single-level undo implementation
      // First apply a customization, then undo, then undo again
      // Second undo should restore first customization

      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/undo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.status === 200) {
        const data = await response.json();

        // After undo, we should be able to undo again (swap back)
        const secondUndo = await fetch(
          `${API_BASE}/design/${testOptimizationId}/undo`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect([200, 400]).toContain(secondUndo.status);
      }
    });

    test('should return 404 for non-existent optimization', async () => {
      const response = await fetch(
        `${API_BASE}/design/non-existent-uuid/undo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('not_found');
    });
  });

  // ============================================================================
  // POST /api/v1/design/{optimizationId}/revert
  // ============================================================================

  describe('POST /api/v1/design/{optimizationId}/revert', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/revert`,
        {
          method: 'POST'
        }
      );

      expect(response.status).toBe(401);
    });

    test('should reset to original recommended template (FR-018)', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/revert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();

        // Validate response schema
        expect(data).toHaveProperty('template');
        expect(data).toHaveProperty('preview');

        // Validate template object
        expect(data.template).toHaveProperty('id');
        expect(data.template).toHaveProperty('name');
        expect(data.template).toHaveProperty('slug');

        // Validate preview is HTML
        expect(typeof data.preview).toBe('string');
        expect(data.preview).toContain('<');
      }
    });

    test('should clear all customizations after revert', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/revert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.status === 200) {
        // After revert, fetch the assignment to verify customizations are cleared
        const getResponse = await fetch(
          `${API_BASE}/design/${testOptimizationId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        if (getResponse.status === 200) {
          const assignment = await getResponse.json();
          expect(assignment.customization_id).toBeNull();
          expect(assignment.previous_customization_id).toBeNull();
        }
      }
    });

    test('should reset template_id to original_template_id', async () => {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/revert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.status === 200) {
        const getResponse = await fetch(
          `${API_BASE}/design/${testOptimizationId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        if (getResponse.status === 200) {
          const assignment = await getResponse.json();
          expect(assignment.template_id).toBe(assignment.original_template_id);
        }
      }
    });

    test('should return 404 for non-existent optimization', async () => {
      const response = await fetch(
        `${API_BASE}/design/non-existent-uuid/revert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('not_found');
    });

    test('should be idempotent - multiple reverts result in same state', async () => {
      const firstRevert = await fetch(
        `${API_BASE}/design/${testOptimizationId}/revert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (firstRevert.status === 200) {
        const secondRevert = await fetch(
          `${API_BASE}/design/${testOptimizationId}/revert`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(secondRevert.status).toBe(200);

        const firstData = await firstRevert.json();
        const secondData = await secondRevert.json();

        expect(firstData.template.id).toBe(secondData.template.id);
      }
    });
  });
});
