/**
 * Unit tests for Thread Manager
 *
 * Tests the thread management utility that handles OpenAI Assistant thread lifecycle:
 * - Thread creation
 * - Thread restoration from database
 * - Error recovery when threads are missing or invalid
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ensureThread, archiveThread } from '@/lib/ai-assistant/thread-manager';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabase = () => {
  const mockSupabase = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;

  return mockSupabase;
};

// Mock OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    beta: {
      threads: {
        create: jest.fn().mockResolvedValue({ id: 'thread_new123' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'thread_existing123' }),
      },
    },
  })),
}));

describe('Thread Manager - ensureThread', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    jest.clearAllMocks();
  });

  describe('Thread Creation', () => {
    it('creates a new thread when none exists in database', async () => {
      // Mock: No existing thread in database
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: 'db-thread-id',
                openai_thread_id: 'thread_new123',
                optimization_id: 'opt-123',
                user_id: 'test-user-id',
                status: 'active',
              },
              error: null,
            }),
          }),
        }),
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      const result = await ensureThread('opt-123', 'test-user-id', mockSupabase);

      expect(result).toBeDefined();
      expect(result.openai_thread_id).toBe('thread_new123');
      expect(result.status).toBe('active');
      expect(mockFrom).toHaveBeenCalledWith('ai_threads');
    });

    it('stores thread metadata in database with correct fields', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'db-thread-id',
              openai_thread_id: 'thread_new123',
              optimization_id: 'opt-123',
              user_id: 'test-user-id',
              status: 'active',
              created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: mockInsert,
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      await ensureThread('opt-123', 'test-user-id', mockSupabase);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          optimization_id: 'opt-123',
          user_id: 'test-user-id',
          openai_thread_id: expect.any(String),
          status: 'active',
        })
      );
    });
  });

  describe('Thread Restoration', () => {
    it('restores existing active thread from database', async () => {
      // Mock: Existing thread in database
      const existingThread = {
        id: 'db-thread-123',
        openai_thread_id: 'thread_existing123',
        optimization_id: 'opt-123',
        user_id: 'test-user-id',
        status: 'active',
      };

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: existingThread,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      const result = await ensureThread('opt-123', 'test-user-id', mockSupabase);

      expect(result.openai_thread_id).toBe('thread_existing123');
      expect(result.id).toBe('db-thread-123');
    });

    it('updates last_message_at timestamp when restoring thread', async () => {
      const existingThread = {
        id: 'db-thread-123',
        openai_thread_id: 'thread_existing123',
        optimization_id: 'opt-123',
        user_id: 'test-user-id',
        status: 'active',
        last_message_at: new Date('2025-01-01').toISOString(),
      };

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { ...existingThread, last_message_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
      });

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === 'ai_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: existingThread,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      await ensureThread('opt-123', 'test-user-id', mockSupabase);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_message_at: expect.any(String),
        })
      );
    });
  });

  describe('Error Recovery', () => {
    it('creates new thread when OpenAI thread ID is invalid', async () => {
      // Mock: Thread exists in DB but is invalid in OpenAI
      const invalidThread = {
        id: 'db-thread-123',
        openai_thread_id: 'thread_invalid999',
        optimization_id: 'opt-123',
        user_id: 'test-user-id',
        status: 'active',
      };

      // Mock OpenAI API to reject invalid thread
      const { OpenAI } = require('openai');
      const mockOpenAI = new OpenAI();
      mockOpenAI.beta.threads.retrieve = jest.fn().mockRejectedValue(
        new Error('No thread found with id thread_invalid999')
      );

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === 'ai_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: invalidThread,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { ...invalidThread, status: 'error' },
                    error: null,
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'db-thread-new',
                    openai_thread_id: 'thread_new123',
                    optimization_id: 'opt-123',
                    user_id: 'test-user-id',
                    status: 'active',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      const result = await ensureThread('opt-123', 'test-user-id', mockSupabase);

      // Should create new thread after marking old one as error
      expect(result.openai_thread_id).toBe('thread_new123');
      expect(result.status).toBe('active');
    });

    it('marks thread as error status when OpenAI API fails', async () => {
      const existingThread = {
        id: 'db-thread-123',
        openai_thread_id: 'thread_broken123',
        optimization_id: 'opt-123',
        user_id: 'test-user-id',
        status: 'active',
      };

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { ...existingThread, status: 'error' },
              error: null,
            }),
          }),
        }),
      });

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === 'ai_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: existingThread,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      // Mock OpenAI to fail validation
      const { OpenAI } = require('openai');
      const mockOpenAI = new OpenAI();
      mockOpenAI.beta.threads.retrieve = jest.fn().mockRejectedValue(
        new Error('Thread validation failed')
      );

      try {
        await ensureThread('opt-123', 'test-user-id', mockSupabase);
      } catch (error) {
        // Error should be caught and thread marked as error
      }

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });

    it('throws descriptive error when database operations fail', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          }),
        }),
      });

      (mockSupabase.from as jest.Mock) = mockFrom;

      await expect(ensureThread('opt-123', 'test-user-id', mockSupabase)).rejects.toThrow(
        /database/i
      );
    });
  });

  describe('Input Validation', () => {
    it('throws error when optimization_id is missing', async () => {
      await expect(ensureThread('', 'test-user-id', mockSupabase)).rejects.toThrow(
        /optimization.*required/i
      );
    });

    it('throws error when user_id is missing', async () => {
      await expect(ensureThread('opt-123', '', mockSupabase)).rejects.toThrow(
        /user.*required/i
      );
    });

    it('throws error when supabase client is null', async () => {
      await expect(ensureThread('opt-123', 'test-user-id', null as any)).rejects.toThrow(
        /supabase.*required/i
      );
    });
  });
});

describe('Thread Manager - archiveThread', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    jest.clearAllMocks();
  });

  it('archives thread by updating status to archived', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'db-thread-123',
              status: 'archived',
              archived_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = jest.fn().mockReturnValue({
      update: mockUpdate,
    });

    (mockSupabase.from as jest.Mock) = mockFrom;

    const result = await archiveThread('thread_123', mockSupabase);

    expect(result.status).toBe('archived');
    expect(result.archived_at).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'archived',
        archived_at: expect.any(String),
      })
    );
  });

  it('throws error when thread_id is invalid', async () => {
    await expect(archiveThread('', mockSupabase)).rejects.toThrow(/thread.*required/i);
  });

  it('returns error when thread does not exist', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Thread not found' },
          }),
        }),
      }),
    });

    const mockFrom = jest.fn().mockReturnValue({
      update: mockUpdate,
    });

    (mockSupabase.from as jest.Mock) = mockFrom;

    await expect(archiveThread('nonexistent-thread', mockSupabase)).rejects.toThrow(
      /not found/i
    );
  });
});
