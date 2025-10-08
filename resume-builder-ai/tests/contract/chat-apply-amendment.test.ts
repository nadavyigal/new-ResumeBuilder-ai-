/**
 * Contract Test: POST /api/v1/chat/sessions/{id}/apply
 * Feature: AI Chat Resume Iteration
 *
 * Tests FR-011: Create new resume version with each successful amendment
 * Tests FR-014: Visual diff showing modifications
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('POST /api/v1/chat/sessions/{id}/apply - Apply Amendment', () => {
  let authToken: string;
  let sessionId: string;
  let amendmentId: string;

  beforeAll(async () => {
    authToken = 'test-auth-token';
    sessionId = 'test-session-id';
    amendmentId = 'test-amendment-id';
  });

  it('should apply amendment and create new version', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/apply`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amendment_id: amendmentId,
        }),
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('version_id');
    expect(data).toHaveProperty('version_number');
    expect(data).toHaveProperty('change_summary');
    expect(data).toHaveProperty('updated_content');
    expect(typeof data.version_number).toBe('number');
    expect(data.version_number).toBeGreaterThan(0);
  });

  it('should return 400 for invalid amendment_id', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/apply`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amendment_id: 'invalid',
        }),
      }
    );

    expect(response.status).toBe(400);
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/apply`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amendment_id: amendmentId,
        }),
      }
    );

    expect(response.status).toBe(401);
  });
});
