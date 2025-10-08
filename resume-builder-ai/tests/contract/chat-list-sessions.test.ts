/**
 * Contract Test: GET /api/v1/chat/sessions
 * Feature: AI Chat Resume Iteration
 *
 * Tests FR-020: Link chat sessions to specific optimization records
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('GET /api/v1/chat/sessions - List Sessions', () => {
  let authToken: string;
  let userId: string;
  let session1Id: string;
  let session2Id: string;

  beforeAll(async () => {
    // Setup: Create test user and multiple chat sessions
    authToken = 'test-auth-token';
    userId = 'test-user-id';
    session1Id = 'test-session-1';
    session2Id = 'test-session-2';
  });

  afterAll(async () => {
    // Cleanup: Delete test sessions
  });

  describe('Session Listing', () => {
    it('should return list of user\'s chat sessions', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('sessions');
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data).toHaveProperty('total');
      expect(typeof data.total).toBe('number');
    });

    it('should include session metadata in response', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (data.sessions.length > 0) {
        const session = data.sessions[0];
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('optimization_id');
        expect(session).toHaveProperty('status');
        expect(session).toHaveProperty('created_at');
        expect(session).toHaveProperty('last_activity_at');
        expect(['active', 'closed']).toContain(session.status);
      }
    });

    it('should return empty array for user with no sessions', async () => {
      // Use a different auth token for user with no sessions
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer new-user-token`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sessions).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Filtering & Sorting', () => {
    it('should return sessions sorted by last_activity_at DESC', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (data.sessions.length > 1) {
        const timestamps = data.sessions.map((s: { last_activity_at: string }) =>
          new Date(s.last_activity_at).getTime()
        );

        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
        }
      }
    });

    it('should filter by status when query parameter provided', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions?status=active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      data.sessions.forEach((session: { status: string }) => {
        expect(session.status).toBe('active');
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should only return sessions belonging to authenticated user', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      data.sessions.forEach((session: { user_id: string }) => {
        expect(session.user_id).toBe(userId);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid status filter', async () => {
      const response = await fetch(`${API_BASE}/api/v1/chat/sessions?status=invalid`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });
});
