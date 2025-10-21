/**
 * Integration Test: Complete Chat Flow
 * Feature: AI Chat Resume Iteration
 *
 * User journey: Open chat → send message → receive AI response → view history
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Integration: Complete Chat Flow', () => {
  let authToken: string;
  let optimizationId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Create user, resume, job description, optimization
    authToken = 'test-auth-token';
    optimizationId = 'test-optimization-id';
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should complete full chat workflow', async () => {
    // Step 1: Open chat (sends first message, creates session)
    const sendResponse = await fetch(`${API_BASE}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        optimization_id: optimizationId,
        message: 'Add Python and JavaScript to my skills',
      }),
    });

    expect(sendResponse.status).toBe(200);
    const sendData = await sendResponse.json();
    expect(sendData).toHaveProperty('session_id');
    expect(sendData).toHaveProperty('ai_response');
    sessionId = sendData.session_id;

    // Step 2: Verify session appears in list
    const listResponse = await fetch(`${API_BASE}/api/v1/chat/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const listData = await listResponse.json();
    const session = listData.sessions.find((s: { id: string }) => s.id === sessionId);
    expect(session).toBeDefined();
    expect(session.status).toBe('active');

    // Step 3: Retrieve conversation history
    const historyResponse = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const historyData = await historyResponse.json();
    expect(historyData.messages.length).toBeGreaterThanOrEqual(2); // User + AI
    expect(historyData.messages[0].sender).toBe('user');
    expect(historyData.messages[1].sender).toBe('ai');

    // Step 4: Send follow-up message
    const followupResponse = await fetch(`${API_BASE}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        optimization_id: optimizationId,
        message: 'Also add Docker',
      }),
    });

    expect(followupResponse.status).toBe(200);

    // Step 5: Verify updated history
    const updatedHistoryResponse = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const updatedHistoryData = await updatedHistoryResponse.json();
    expect(updatedHistoryData.messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 AI
  }, 30000);
});
