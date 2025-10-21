/**
 * Contract Test: DELETE /api/v1/chat/sessions/{id}
 * Feature: AI Chat Resume Iteration
 *
 * Tests ability to manually delete sessions before 30-day retention
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('DELETE /api/v1/chat/sessions/{id} - Delete Session', () => {
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    authToken = 'test-auth-token';
    sessionId = 'test-session-id';
  });

  it('should successfully delete session', async () => {
    const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(204);
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  it('should return 403 when deleting another user\'s session', async () => {
    const response = await fetch(`${API_BASE}/api/v1/chat/sessions/other-user-session`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(403);
  });

  it('should return 404 for non-existent session', async () => {
    const response = await fetch(`${API_BASE}/api/v1/chat/sessions/non-existent`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(404);
  });
});
