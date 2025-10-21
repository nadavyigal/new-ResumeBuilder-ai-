/**
 * Integration Test: Design Chat Customization Flow
 * Tests AI-powered design modification through chat interface
 *
 * Reference: specs/003-i-want-to/quickstart.md (Steps 4-6)
 * Task: T015
 *
 * IMPORTANT: This test MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Integration Test: Design Chat Customization Flow', () => {
  let authToken: string;
  let testOptimizationId: string;
  let chatSessionId: string;

  beforeAll(async () => {
    // TODO: Setup test environment
    // 1. Create test user and get auth token
    // 2. Create test optimization
    // 3. Assign default design template

    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
  });

  afterAll(async () => {
    // TODO: Cleanup test data
  });

  // ============================================================================
  // Test 1: Create Chat Session for Design
  // ============================================================================

  test('should create chat session for design customization', async () => {
    const response = await fetch(`${API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        optimizationId: testOptimizationId,
        type: 'design' // Indicate this is a design customization session
      })
    });

    expect([200, 201]).toContain(response.status);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    chatSessionId = data.id;
  });

  // ============================================================================
  // Test 2: Step 4 - Color Change Request (Quickstart)
  // ============================================================================

  test('Step 4: should interpret "make headers dark blue" request', async () => {
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}/customize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeRequest: 'make the headers dark blue'
        })
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Validate AI interpreted the request correctly
    expect(data.customization.color_scheme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);

    // Dark blue should be in the range of #0000AA to #2222FF (approximate)
    const primaryColor = data.customization.color_scheme.primary;
    expect(primaryColor.toLowerCase()).toMatch(/^#[0-2][0-4][3-9a-f][0-9a-f][6-9a-f][a-f]$/);

    // Verify ATS validation passed
    expect(data.customization.is_ats_safe).toBe(true);

    // Verify preview was generated
    expect(data.preview).toContain('<!DOCTYPE html>');

    // Verify reasoning was provided
    expect(data.reasoning).toContain('blue');
  });

  test('Step 4: should apply customization immediately (FR-010)', async () => {
    // After applying customization, fetch assignment to verify it was updated
    const getResponse = await fetch(
      `${API_BASE}/design/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect(getResponse.status).toBe(200);

    const assignment = await getResponse.json();
    expect(assignment.customization_id).not.toBeNull();
  });

  // ============================================================================
  // Test 3: Step 5 - Font Change Request (Quickstart)
  // ============================================================================

  test('Step 5: should interpret "use Times New Roman" request', async () => {
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}/customize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeRequest: 'use a more professional font like Times New Roman for the body text'
        })
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Validate font change
    expect(data.customization.font_family.body).toBe('Times New Roman');

    // Verify previous color change was preserved
    expect(data.customization.color_scheme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);

    // Verify ATS safety
    expect(data.customization.is_ats_safe).toBe(true);
  });

  test('Step 5: should preserve previous customizations', async () => {
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    const assignment = await response.json();

    // Both color and font changes should be present
    expect(assignment.customization.color_scheme.primary).toBeDefined();
    expect(assignment.customization.font_family.body).toBe('Times New Roman');
  });

  // ============================================================================
  // Test 4: Step 6 - Undo Last Change (Quickstart)
  // ============================================================================

  test('Step 6: should undo font change', async () => {
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}/undo`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Font should be reverted to Arial
    expect(data.customization.font_family.body).toBe('Arial');

    // Color change should still be preserved
    expect(data.customization.color_scheme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('Step 6: undo button should be enabled after undo', async () => {
    // After undo, we should be able to undo again (swap back)
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    const assignment = await response.json();

    // Should have previous_customization_id (can undo again)
    expect(assignment.previous_customization_id).not.toBeNull();
  });

  // ============================================================================
  // Test 5: Multiple Customizations
  // ============================================================================

  test('should handle multiple customization requests in sequence', async () => {
    const requests = [
      'make the layout more compact',
      'use a larger font size for headings',
      'add more spacing between sections'
    ];

    for (const request of requests) {
      const response = await fetch(
        `${API_BASE}/design/${testOptimizationId}/customize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            changeRequest: request
          })
        }
      );

      expect([200, 400]).toContain(response.status);
    }
  });

  // ============================================================================
  // Test 6: ATS Violation Detection (Step 7 - Quickstart)
  // ============================================================================

  test('Step 7: should reject "add my photo" request (ATS violation)', async () => {
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
    expect(data.error).toBe('ats_violation');
    expect(data).toHaveProperty('validationErrors');
    expect(Array.isArray(data.validationErrors)).toBe(true);

    // Should provide helpful error message
    expect(data.message).toContain('ATS');
  });

  // ============================================================================
  // Test 7: Unclear Request Handling (Step 8 - Quickstart)
  // ============================================================================

  test('Step 8: should request clarification for "make it look cooler"', async () => {
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
    expect(data.error).toBe('unclear_request');
    expect(data).toHaveProperty('clarificationNeeded');
    expect(typeof data.clarificationNeeded).toBe('string');

    // Should provide helpful suggestions
    expect(data.clarificationNeeded.toLowerCase()).toMatch(/color|font|spacing|layout/);
  });

  // ============================================================================
  // Test 8: Fabrication Prevention
  // ============================================================================

  test('should detect and reject requests for false information', async () => {
    const response = await fetch(
      `${API_BASE}/design/${testOptimizationId}/customize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeRequest: 'add 10 years of experience at Google'
        })
      }
    );

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toMatch(/fabrication|invalid_request/);
  });

  // ============================================================================
  // Test 9: Performance Requirements
  // ============================================================================

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

    const duration = (Date.now() - startTime) / 1000;

    expect([200, 400, 404]).toContain(response.status);
    expect(duration).toBeLessThan(7);
  }, 10000);
});
