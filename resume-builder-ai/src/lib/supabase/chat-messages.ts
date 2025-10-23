/**
 * Supabase Client Wrapper: chat_messages table
 *
 * Provides type-safe database operations for chat messages with RLS enforcement.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, ChatMessageInsert } from '../../types/chat';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create new chat message
 *
 * @param message - Message data to insert
 * @returns Created message
 */
export async function createChatMessage(
  message: ChatMessageInsert
): Promise<ChatMessage> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(message)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create chat message: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Get messages for a session
 *
 * @param sessionId - Session ID
 * @param supabaseClient - Optional authenticated Supabase client (for server-side use with RLS)
 * @param options - Pagination options
 * @returns Array of messages in chronological order
 */
export async function getSessionMessages(
  sessionId: string,
  supabaseClient?: SupabaseClient | {
    limit?: number;
    offset?: number;
  },
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<ChatMessage[]> {
  // Handle overloaded parameters (backwards compatibility)
  let client: SupabaseClient;
  let paginationOptions = options;

  if (supabaseClient && 'from' in supabaseClient) {
    // First param is SupabaseClient
    client = supabaseClient as SupabaseClient;
  } else {
    // First param is options (old signature)
    client = getSupabaseClient();
    paginationOptions = supabaseClient as { limit?: number; offset?: number } | undefined;
  }

  let query = client
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (paginationOptions?.limit) {
    query = query.limit(paginationOptions.limit);
  }

  if (paginationOptions?.offset) {
    query = query.range(paginationOptions.offset, paginationOptions.offset + (paginationOptions.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get session messages: ${error.message}`);
  }

  return (data as ChatMessage[]) || [];
}

/**
 * Get single message by ID
 *
 * @param messageId - Message ID
 * @returns Message data or null if not found
 */
export async function getChatMessage(messageId: string): Promise<ChatMessage | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get chat message: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Count messages in a session
 *
 * @param sessionId - Session ID
 * @returns Total message count
 */
export async function countSessionMessages(sessionId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to count session messages: ${error.message}`);
  }

  return count || 0;
}

/**
 * Delete all messages in a session
 * (Called when session is deleted via CASCADE)
 *
 * @param sessionId - Session ID
 */
export async function deleteSessionMessages(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to delete session messages: ${error.message}`);
  }
}
