/**
 * Contract Test: GET /api/v1/chat/sessions/{id}
 * Feature: AI Chat Resume Iteration
 *
 * Tests FR-017: Display conversation history chronologically
 * Tests FR-019: Close and reopen chat sessions without losing context
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('GET /api/v1/chat/sessions/{id} - Get Session Details', () => {
  let authToken: string;
  let sessionId: string;
  let otherUserSessionId: string;

  beforeAll(async () => {
    // Setup: Create test session with messages
    authToken = 'test-auth-token';
    sessionId = 'test-session-id';
    otherUserSessionId = 'other-user-session-id';
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Session Details Retrieval', () => {
    it('should return session details with messages', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('session');
      expect(data).toHaveProperty('messages');
      expect(data).toHaveProperty('total_messages');

      expect(data.session.id).toBe(sessionId);
      expect(Array.isArray(data.messages)).toBe(true);
    });

    it('should include complete session metadata', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      const session = data.session;

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('user_id');
      expect(session).toHaveProperty('optimization_id');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('created_at');
      expect(session).toHaveProperty('last_activity_at');
      expect(session).toHaveProperty('updated_at');
    });

    it('should include message details in chronological order', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (data.messages.length > 0) {
        const message = data.messages[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('session_id');
        expect(message).toHaveProperty('sender');
        expect(message).toHaveProperty('content');
        expect(message).toHaveProperty('created_at');
        expect(['user', 'ai']).toContain(message.sender);
      }

      // Verify chronological ordering
      if (data.messages.length > 1) {
        const timestamps = data.messages.map((m: { created_at: string }) =>
          new Date(m.created_at).getTime()
        );

        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
        }
      }
    });
  });

  describe('Pagination', () => {
    it('should support pagination with limit parameter', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}?limit=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.messages.length).toBeLessThanOrEqual(10);
    });

    it('should support pagination with offset parameter', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}?offset=5&limit=5`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.messages.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should return 403 when accessing another user\'s session', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${otherUserSessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent session', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/non-existent-id`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions/invalid-uuid`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(400);
    });
  });
});
