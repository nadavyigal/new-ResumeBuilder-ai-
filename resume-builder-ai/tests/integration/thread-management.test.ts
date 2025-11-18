/**
 * Integration tests for Thread Management Lifecycle
 *
 * Tests the complete flow of thread management across multiple chat interactions:
 * - Thread creation on first message
 * - Thread reuse on subsequent messages
 * - Thread persistence across sessions
 * - Error recovery and thread recreation
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ensureThread } from '@/lib/ai-assistant/thread-manager';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase server client
jest.mock('@/lib/supabase-server', () => ({
  createRouteHandlerClient: jest.fn(),
}));

// Mock OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    beta: {
      threads: {
        create: jest.fn().mockResolvedValue({ id: 'thread_integration123' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'thread_integration123' }),
      },
      assistants: {
        create: jest.fn().mockResolvedValue({ id: 'asst_test123' }),
      },
    },
  })),
}));

describe('Thread Management Integration - Full Lifecycle', () => {
  let mockSupabase: SupabaseClient;
  let threadStore: Map<string, any>; // In-memory store simulating database

  beforeEach(() => {
    threadStore = new Map();
    jest.clearAllMocks();

    // Create mock Supabase client with in-memory store
    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'ai_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockImplementation(async () => {
                      const threads = Array.from(threadStore.values()).filter(
                        (t) => t.status === 'active'
                      );
                      return {
                        data: threads[0] || null,
                        error: null,
                      };
                    }),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockImplementation(async (data: any) => {
              const newThread = {
                id: `db-thread-${threadStore.size + 1}`,
                ...data,
                created_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              };
              threadStore.set(newThread.id, newThread);
              return {
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: newThread,
                    error: null,
                  }),
                }),
              };
            }),
            update: jest.fn().mockImplementation(async (data: any) => {
              return {
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockImplementation(async () => {
                      // Find and update thread
                      const thread = Array.from(threadStore.values())[0];
                      if (thread) {
                        const updated = { ...thread, ...data };
                        threadStore.set(thread.id, updated);
                        return { data: updated, error: null };
                      }
                      return { data: null, error: { message: 'Thread not found' } };
                    }),
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    (createRouteHandlerClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    threadStore.clear();
  });

  describe('First Message - Thread Creation', () => {
    it('creates new thread on first chat interaction', async () => {
      const optimizationId = 'opt-first-message';
      const userId = 'user-123';

      // Simulate first message - no existing thread
      const thread = await ensureThread(optimizationId, userId, mockSupabase);

      expect(thread).toBeDefined();
      expect(thread.openai_thread_id).toMatch(/^thread_/);
      expect(thread.optimization_id).toBe(optimizationId);
      expect(thread.user_id).toBe(userId);
      expect(thread.status).toBe('active');
      expect(threadStore.size).toBe(1);
    });

    it('stores thread with proper timestamps', async () => {
      const optimizationId = 'opt-timestamps';
      const userId = 'user-123';

      const beforeCreate = new Date();
      const thread = await ensureThread(optimizationId, userId, mockSupabase);
      const afterCreate = new Date();

      expect(thread.created_at).toBeDefined();
      expect(thread.last_message_at).toBeDefined();

      const createdAt = new Date(thread.created_at);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('creates thread with unique OpenAI thread ID', async () => {
      const thread1 = await ensureThread('opt-1', 'user-123', mockSupabase);
      const thread2 = await ensureThread('opt-2', 'user-123', mockSupabase);

      expect(thread1.openai_thread_id).not.toBe(thread2.openai_thread_id);
    });
  });

  describe('Subsequent Messages - Thread Reuse', () => {
    it('reuses same thread for multiple messages to same optimization', async () => {
      const optimizationId = 'opt-reuse';
      const userId = 'user-123';

      // First message - creates thread
      const thread1 = await ensureThread(optimizationId, userId, mockSupabase);
      const firstThreadId = thread1.openai_thread_id;

      // Second message - should reuse thread
      const thread2 = await ensureThread(optimizationId, userId, mockSupabase);

      expect(thread2.openai_thread_id).toBe(firstThreadId);
      expect(threadStore.size).toBe(1); // Only one thread created
    });

    it('updates last_message_at timestamp on each message', async () => {
      const optimizationId = 'opt-timestamp-update';
      const userId = 'user-123';

      // First message
      const thread1 = await ensureThread(optimizationId, userId, mockSupabase);
      const firstTimestamp = thread1.last_message_at;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second message
      const thread2 = await ensureThread(optimizationId, userId, mockSupabase);
      const secondTimestamp = thread2.last_message_at;

      expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(
        new Date(firstTimestamp).getTime()
      );
    });

    it('maintains thread continuity across multiple interactions', async () => {
      const optimizationId = 'opt-continuity';
      const userId = 'user-123';

      // Simulate 5 consecutive messages
      const threads = [];
      for (let i = 0; i < 5; i++) {
        const thread = await ensureThread(optimizationId, userId, mockSupabase);
        threads.push(thread);
      }

      // All should have the same OpenAI thread ID
      const threadIds = threads.map((t) => t.openai_thread_id);
      const uniqueIds = new Set(threadIds);
      expect(uniqueIds.size).toBe(1); // Only one unique thread ID

      // Only one thread record in database
      expect(threadStore.size).toBe(1);
    });
  });

  describe('Session Persistence', () => {
    it('restores thread after session timeout', async () => {
      const optimizationId = 'opt-session-restore';
      const userId = 'user-123';

      // Create thread in first session
      const thread1 = await ensureThread(optimizationId, userId, mockSupabase);
      const originalThreadId = thread1.openai_thread_id;

      // Simulate session expiry (clear local state but keep DB)
      // Thread should be restored from database
      const thread2 = await ensureThread(optimizationId, userId, mockSupabase);

      expect(thread2.openai_thread_id).toBe(originalThreadId);
    });

    it('handles concurrent requests for same optimization gracefully', async () => {
      const optimizationId = 'opt-concurrent';
      const userId = 'user-123';

      // Simulate 3 concurrent requests
      const promises = [
        ensureThread(optimizationId, userId, mockSupabase),
        ensureThread(optimizationId, userId, mockSupabase),
        ensureThread(optimizationId, userId, mockSupabase),
      ];

      const threads = await Promise.all(promises);

      // All should resolve to the same thread
      const threadIds = threads.map((t) => t.openai_thread_id);
      const uniqueIds = new Set(threadIds);
      expect(uniqueIds.size).toBe(1);
    });
  });

  describe('Error Recovery and Thread Recreation', () => {
    it('creates new thread when existing thread is corrupted', async () => {
      const optimizationId = 'opt-recovery';
      const userId = 'user-123';

      // Create initial thread
      const thread1 = await ensureThread(optimizationId, userId, mockSupabase);

      // Simulate thread corruption by marking it as error
      const corruptedThread = Array.from(threadStore.values())[0];
      if (corruptedThread) {
        corruptedThread.status = 'error';
        threadStore.set(corruptedThread.id, corruptedThread);
      }

      // Mock OpenAI to reject the corrupted thread
      const { OpenAI } = require('openai');
      const mockOpenAI = new OpenAI();
      mockOpenAI.beta.threads.retrieve = jest.fn().mockRejectedValue(
        new Error('Thread not found in OpenAI')
      );

      // Next message should create new thread
      const thread2 = await ensureThread(optimizationId, userId, mockSupabase);

      expect(thread2.openai_thread_id).not.toBe(thread1.openai_thread_id);
      expect(thread2.status).toBe('active');
    });

    it('maintains chat history continuity after thread recreation', async () => {
      const optimizationId = 'opt-history-continuity';
      const userId = 'user-123';

      // First thread with messages
      const thread1 = await ensureThread(optimizationId, userId, mockSupabase);

      // Force recreation
      const threads = Array.from(threadStore.values());
      threads.forEach((t) => {
        t.status = 'error';
        threadStore.set(t.id, t);
      });

      // New thread should be created
      const thread2 = await ensureThread(optimizationId, userId, mockSupabase);

      // Verify new thread is different but linked to same optimization
      expect(thread2.openai_thread_id).not.toBe(thread1.openai_thread_id);
      expect(thread2.optimization_id).toBe(optimizationId);
    });

    it('handles OpenAI API errors gracefully', async () => {
      const optimizationId = 'opt-api-error';
      const userId = 'user-123';

      // Mock OpenAI to fail
      const { OpenAI } = require('openai');
      const mockOpenAI = new OpenAI();
      mockOpenAI.beta.threads.create = jest.fn().mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );

      // Should throw descriptive error
      await expect(ensureThread(optimizationId, userId, mockSupabase)).rejects.toThrow(
        /openai|rate limit/i
      );
    });
  });

  describe('Multi-User Isolation', () => {
    it('creates separate threads for different users on same optimization', async () => {
      const optimizationId = 'opt-shared';

      // User 1 creates thread
      const mockSupabase1 = { ...mockSupabase };
      const thread1 = await ensureThread(optimizationId, 'user-1', mockSupabase1);

      // User 2 creates thread (should be separate)
      const mockSupabase2 = { ...mockSupabase };
      const thread2 = await ensureThread(optimizationId, 'user-2', mockSupabase2);

      // Both threads should exist but be different
      expect(thread1.openai_thread_id).not.toBe(thread2.openai_thread_id);
      expect(thread1.user_id).toBe('user-1');
      expect(thread2.user_id).toBe('user-2');
    });

    it('prevents users from accessing other users threads', async () => {
      const optimizationId = 'opt-security';

      // User 1 creates thread
      await ensureThread(optimizationId, 'user-1', mockSupabase);

      // User 2 tries to access same optimization (should get own thread)
      const thread2 = await ensureThread(optimizationId, 'user-2', mockSupabase);

      // User 2 should not get User 1's thread
      const user1Threads = Array.from(threadStore.values()).filter(
        (t) => t.user_id === 'user-1'
      );
      const user2Threads = Array.from(threadStore.values()).filter(
        (t) => t.user_id === 'user-2'
      );

      expect(user1Threads.length).toBe(1);
      expect(user2Threads.length).toBe(1);
      expect(user1Threads[0].id).not.toBe(user2Threads[0].id);
    });
  });

  describe('Performance and Scalability', () => {
    it('handles rapid sequential messages efficiently', async () => {
      const optimizationId = 'opt-performance';
      const userId = 'user-123';

      const startTime = Date.now();

      // Simulate 10 rapid messages
      for (let i = 0; i < 10; i++) {
        await ensureThread(optimizationId, userId, mockSupabase);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second for 10 messages)
      expect(duration).toBeLessThan(1000);

      // Only one thread should be created
      expect(threadStore.size).toBe(1);
    });

    it('maintains performance with multiple active threads', async () => {
      const userId = 'user-123';

      // Create 20 different threads for different optimizations
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(ensureThread(`opt-${i}`, userId, mockSupabase));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should handle multiple threads efficiently
      expect(duration).toBeLessThan(2000);
      expect(threadStore.size).toBe(20);
    });
  });
});
