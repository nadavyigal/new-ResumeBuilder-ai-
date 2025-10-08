/**
 * Contract Tests: Design Recommendation API
 * Tests POST /api/v1/design/recommend
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T010
 *
 * IMPORTANT: This test MUST FAIL until implementation is complete (TDD)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

describe('Contract Tests: Design Recommendation API', () => {
  let authToken: string;
  let testOptimizationId: string;

  beforeAll(async () => {
    // TODO: Setup test user and optimization
    authToken = 'test-token';
    testOptimizationId = 'test-optimization-uuid';
  });

  describe('POST /api/v1/design/recommend', () => {
    test('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: testOptimizationId
        })
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('unauthorized');
    });

    test('should return 400 without optimizationId', async () => {
      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
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

    test('should return recommended template with reasoning', async () => {
      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: testOptimizationId
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('recommendedTemplate');
      expect(data).toHaveProperty('reasoning');

      // Validate DesignTemplate schema
      const template = data.recommendedTemplate;
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('slug');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('description');

      // Validate reasoning
      expect(typeof data.reasoning).toBe('string');
      expect(data.reasoning.length).toBeGreaterThan(10); // Should have meaningful reasoning
    });

    test('should recommend one of the 4 seed templates', async () => {
      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: testOptimizationId
        })
      });

      const data = await response.json();
      const recommendedSlug = data.recommendedTemplate.slug;

      expect(['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr']).toContain(recommendedSlug);
    });

    test('should return 404 for invalid optimizationId', async () => {
      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: 'non-existent-uuid'
        })
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('not_found');
    });

    test('should respond within reasonable time (< 10 seconds)', async () => {
      const startTime = Date.now();

      const response = await fetch(`${API_BASE}/design/recommend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: testOptimizationId
        })
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      expect([200, 404]).toContain(response.status);
      expect(duration).toBeLessThan(10); // AI call should be fast
    }, 15000); // 15 second test timeout
  });
});
