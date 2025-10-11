/**
 * Supabase Client Wrapper: chat_sessions table
 *
 * Provides type-safe database operations for chat sessions with RLS enforcement.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ChatSession, ChatSessionInsert, ChatSessionUpdate } from '../../types/chat';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Get Supabase client for chat_sessions operations
 */
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create new chat session
 *
 * @param session - Session data to insert
 * @returns Created session
 * @throws Error if active session already exists for optimization
 */
export async function createChatSession(
  session: ChatSessionInsert
): Promise<ChatSession> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert(session)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation - active session already exists
      throw new Error(
        `Active chat session already exists for optimization ${session.optimization_id}`
      );
    }
    throw new Error(`Failed to create chat session: ${error.message}`);
  }

  return data as ChatSession;
}

/**
 * Get chat session by ID
 *
 * @param sessionId - Session ID to retrieve
 * @param supabaseClient - Optional authenticated Supabase client (for server-side use with RLS)
 * @returns Session data or null if not found
 */
export async function getChatSession(sessionId: string, supabaseClient?: SupabaseClient): Promise<ChatSession | null> {
  const supabase = supabaseClient || getSupabaseClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get chat session: ${error.message}`);
  }

  return data as ChatSession;
}

/**
 * Get active session for user's optimization
 *
 * @param userId - User ID
 * @param optimizationId - Optimization ID
 * @returns Active session or null if none exists
 */
export async function getActiveSession(
  userId: string,
  optimizationId: string
): Promise<ChatSession | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('optimization_id', optimizationId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get active session: ${error.message}`);
  }

  return data as ChatSession;
}

/**
 * List user's chat sessions
 *
 * @param userId - User ID
 * @param status - Optional status filter
 * @returns Array of sessions
 */
export async function listChatSessions(
  userId: string,
  status?: 'active' | 'closed'
): Promise<ChatSession[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_activity_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list chat sessions: ${error.message}`);
  }

  return (data as ChatSession[]) || [];
}

/**
 * Update chat session
 *
 * @param update - Session update data with id
 * @returns Updated session
 */
export async function updateChatSession(
  update: ChatSessionUpdate
): Promise<ChatSession> {
  const supabase = getSupabaseClient();

  const { id, ...updateData } = update;

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update chat session: ${error.message}`);
  }

  return data as ChatSession;
}

/**
 * Close chat session
 *
 * @param sessionId - Session ID to close
 * @returns Updated session
 */
export async function closeChatSession(sessionId: string): Promise<ChatSession> {
  return updateChatSession({
    id: sessionId,
    status: 'closed',
  });
}

/**
 * Delete chat session
 *
 * @param sessionId - Session ID to delete
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to delete chat session: ${error.message}`);
  }
}

/**
 * Update session last_activity_at timestamp
 *
 * @param sessionId - Session ID
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('chat_sessions')
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}
