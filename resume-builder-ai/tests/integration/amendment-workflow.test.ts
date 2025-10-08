/**
 * Integration Test: Amendment Workflow
 * Feature: AI Chat Resume Iteration
 *
 * User journey: Request change → preview diff → apply → verify new version
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Integration: Amendment Workflow', () => {
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    authToken = 'test-auth-token';
    sessionId = 'test-session-id';
  });

  it('should complete amendment workflow with preview and apply', async () => {
    // Step 1: Preview amendment
    const previewResponse = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: 'Add Python to skills',
        }),
      }
    );

    const previewData = await previewResponse.json();
    expect(previewData.diff).toBeDefined();
    expect(previewData.change_summary).toBeDefined();

    // Step 2: Apply amendment
    const applyResponse = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/apply`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amendment_id: 'test-amendment-id',
        }),
      }
    );

    const applyData = await applyResponse.json();
    expect(applyData.version_number).toBeGreaterThan(1);
    expect(applyData.updated_content).toBeDefined();
  }, 15000);
});
