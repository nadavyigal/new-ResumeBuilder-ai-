/**
 * Contract Test: GET /api/v1/chat/sessions/{id}/messages
 * Feature: AI Chat Resume Iteration
 *
 * Tests FR-017: Display conversation history with pagination
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('GET /api/v1/chat/sessions/{id}/messages - Get Messages', () => {
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    authToken = 'test-auth-token';
    sessionId = 'test-session-id';
  });

  it('should return paginated messages', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/messages?page=1&page_size=20`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('messages');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('page_size');
    expect(data).toHaveProperty('has_more');
    expect(Array.isArray(data.messages)).toBe(true);
  });

  it('should return messages in chronological order', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/messages`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    const data = await response.json();

    if (data.messages.length > 1) {
      const timestamps = data.messages.map((m: { created_at: string }) =>
        new Date(m.created_at).getTime()
      );

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    }
  });

  it('should return 401 without authentication', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/${sessionId}/messages`,
      { method: 'GET' }
    );

    expect(response.status).toBe(401);
  });

  it('should return 403 for another user\'s session', async () => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/sessions/other-user-session/messages`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(403);
  });
});
