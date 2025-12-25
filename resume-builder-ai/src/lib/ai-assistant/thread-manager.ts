/**
 * Thread Manager - OpenAI Assistant Thread Lifecycle Management
 *
 * Handles creation, restoration, and error recovery for OpenAI Assistant threads.
 * Ensures one active thread per optimization and prevents "undefined thread ID" errors.
 *
 * @module lib/ai-assistant/thread-manager
 */

import { OpenAI } from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

/**
 * AI Thread record from database
 */
export interface AIThread {
  id: string;
  user_id: string;
  optimization_id: string;
  session_id?: string | null;
  openai_thread_id: string;
  openai_assistant_id?: string | null;
  status: 'active' | 'archived' | 'error';
  metadata?: Record<string, any>;
  created_at: string;
  last_message_at: string;
  archived_at?: string | null;
}

/**
 * Ensures a valid OpenAI thread exists for the given optimization.
 *
 * Flow:
 * 1. Check database for existing active thread
 * 2. If found, validate with OpenAI API
 * 3. If invalid, mark as error and create new thread
 * 4. If not found, create new thread
 * 5. Update last_message_at timestamp
 *
 * @param optimizationId - UUID of the optimization
 * @param userId - UUID of the user
 * @param supabase - Supabase client instance
 * @returns AIThread record with valid openai_thread_id
 * @throws Error if validation fails or required parameters missing
 *
 * @example
 * ```ts
 * const thread = await ensureThread('opt-123', 'user-456', supabase);
 * console.log(thread.openai_thread_id); // "thread_abc123"
 * ```
 */
export async function ensureThread(
  optimizationId: string,
  userId: string,
  supabase: SupabaseClient,
  deps: { openaiClient?: OpenAI } = {}
): Promise<AIThread> {
  // Input validation
  if (!optimizationId || optimizationId.trim() === '') {
    throw new Error('optimization_id is required');
  }
  if (!userId || userId.trim() === '') {
    throw new Error('user_id is required');
  }
  if (!supabase) {
    throw new Error('supabase client is required');
  }

  const openaiClient = deps.openaiClient ?? getOpenAI();
  const threadsTable = supabase.from('ai_threads') as any;

  try {
    // Step 1: Look for existing active thread
    const { data: existingThread, error: fetchError } = await threadsTable
      .select('*')
      .eq('optimization_id', optimizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Database error fetching thread: ${fetchError.message}`);
    }

    // Step 2: If thread exists, validate it with OpenAI
    if (existingThread) {
      try {
        // Verify thread still exists in OpenAI
        await openaiClient.beta.threads.retrieve(existingThread.openai_thread_id);

        // Thread is valid, update last_message_at and return
        const canUpdate = typeof threadsTable.update === 'function';
        if (canUpdate) {
          const { data: updatedThread, error: updateError } = await threadsTable
            .update({
              last_message_at: new Date().toISOString(),
            })
            .eq('id', existingThread.id)
            .select()
            .maybeSingle();

          if (updateError) {
            console.warn('Failed to update last_message_at:', updateError.message);
            // Non-critical error, return existing thread
            return existingThread as AIThread;
          }

          return updatedThread as AIThread;
        }

        // If update isn't available (e.g., mocked client), return existing thread
        return existingThread as AIThread;
      } catch (openaiError) {
        // Thread is invalid in OpenAI, mark as error
        console.error('OpenAI thread validation failed:', openaiError);

        if (typeof threadsTable.update === 'function') {
          await threadsTable
            .update({
              status: 'error',
              metadata: {
                error: openaiError instanceof Error ? openaiError.message : 'Unknown error',
                error_timestamp: new Date().toISOString(),
              },
            })
            .eq('id', existingThread.id);
        }

        // Continue to create new thread below
      }
    }

    // Step 3: Create new thread in OpenAI
    const newOpenAIThread = await openaiClient.beta.threads.create();

    // Step 4: Save thread to database
    const { data: newThread, error: insertError } = await threadsTable
      .insert({
        optimization_id: optimizationId,
        user_id: userId,
        openai_thread_id: newOpenAIThread.id,
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insertError) {
      throw new Error(`Failed to save thread to database: ${insertError.message}`);
    }

    if (!newThread) {
      throw new Error('Failed to create thread: no data returned from database');
    }

    return newThread as AIThread;
  } catch (error) {
    // Handle OpenAI API errors
    if (error instanceof Error && error.message.includes('rate limit')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
    }

    // Re-throw other errors with context
    throw error;
  }
}

/**
 * Archives a thread by updating its status to 'archived'.
 *
 * Archived threads are not returned by ensureThread and won't be reused.
 * Use this when a chat session is explicitly closed or optimization is deleted.
 *
 * @param threadId - OpenAI thread ID (e.g., "thread_abc123")
 * @param supabase - Supabase client instance
 * @returns Updated AIThread record with status='archived'
 * @throws Error if thread not found or database operation fails
 *
 * @example
 * ```ts
 * await archiveThread('thread_abc123', supabase);
 * ```
 */
export async function archiveThread(
  threadId: string,
  supabase: SupabaseClient
): Promise<AIThread> {
  // Input validation
  if (!threadId || threadId.trim() === '') {
    throw new Error('thread_id is required');
  }
  if (!supabase) {
    throw new Error('supabase client is required');
  }

  try {
    const { data: archivedThread, error: updateError } = await supabase
      .from('ai_threads')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('openai_thread_id', threadId)
      .select()
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to archive thread: ${updateError.message}`);
    }

    if (!archivedThread) {
      throw new Error('Thread not found or already archived');
    }

    return archivedThread as AIThread;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error archiving thread');
  }
}

/**
 * Retrieves the current active thread for an optimization without creating a new one.
 *
 * Useful for checking thread status or displaying thread information.
 *
 * @param optimizationId - UUID of the optimization
 * @param userId - UUID of the user
 * @param supabase - Supabase client instance
 * @returns AIThread record or null if no active thread exists
 *
 * @example
 * ```ts
 * const thread = await getActiveThread('opt-123', 'user-456', supabase);
 * if (thread) {
 *   console.log('Active thread:', thread.openai_thread_id);
 * }
 * ```
 */
export async function getActiveThread(
  optimizationId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<AIThread | null> {
  const { data: thread, error } = await supabase
    .from('ai_threads')
    .select('*')
    .eq('optimization_id', optimizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching active thread:', error);
    return null;
  }

  return thread as AIThread | null;
}
