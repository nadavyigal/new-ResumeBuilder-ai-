/**
 * Supabase Client Wrapper: amendment_requests table
 *
 * Provides type-safe database operations for amendment requests with RLS enforcement.
 */

import { createClient } from '@supabase/supabase-js';
import type { AmendmentRequest, AmendmentRequestInsert, AmendmentRequestUpdate } from '../../types/chat';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create new amendment request
 *
 * @param request - Amendment request data to insert
 * @returns Created amendment request
 */
export async function createAmendmentRequest(
  request: AmendmentRequestInsert
): Promise<AmendmentRequest> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('amendment_requests')
    .insert(request)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create amendment request: ${error.message}`);
  }

  return data as AmendmentRequest;
}

/**
 * Get amendment request by ID
 *
 * @param requestId - Request ID
 * @returns Request data or null if not found
 */
export async function getAmendmentRequest(requestId: string): Promise<AmendmentRequest | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('amendment_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get amendment request: ${error.message}`);
  }

  return data as AmendmentRequest;
}

/**
 * Get amendment requests for a session
 *
 * @param sessionId - Session ID
 * @param status - Optional status filter
 * @returns Array of amendment requests
 */
export async function getSessionAmendments(
  sessionId: string,
  status?: 'pending' | 'applied' | 'rejected' | 'needs_clarification'
): Promise<AmendmentRequest[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('amendment_requests')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get session amendments: ${error.message}`);
  }

  return (data as AmendmentRequest[]) || [];
}

/**
 * Get pending amendment requests for a session
 *
 * @param sessionId - Session ID
 * @returns Array of pending requests
 */
export async function getPendingAmendments(sessionId: string): Promise<AmendmentRequest[]> {
  return getSessionAmendments(sessionId, 'pending');
}

/**
 * Update amendment request
 *
 * @param update - Request update data with id
 * @returns Updated request
 */
export async function updateAmendmentRequest(
  update: AmendmentRequestUpdate
): Promise<AmendmentRequest> {
  const supabase = getSupabaseClient();

  const { id, ...updateData } = update;

  const { data, error } = await supabase
    .from('amendment_requests')
    .update({
      ...updateData,
      processed_at: updateData.status !== 'pending' ? new Date().toISOString() : undefined,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update amendment request: ${error.message}`);
  }

  return data as AmendmentRequest;
}

/**
 * Mark amendment as applied
 *
 * @param requestId - Request ID
 * @returns Updated request
 */
export async function markAmendmentApplied(requestId: string): Promise<AmendmentRequest> {
  return updateAmendmentRequest({
    id: requestId,
    status: 'applied',
  });
}

/**
 * Mark amendment as rejected
 *
 * @param requestId - Request ID
 * @param reason - Rejection reason
 * @returns Updated request
 */
export async function markAmendmentRejected(
  requestId: string,
  reason: string
): Promise<AmendmentRequest> {
  return updateAmendmentRequest({
    id: requestId,
    status: 'rejected',
    rejection_reason: reason,
  });
}

/**
 * Delete amendment requests for a message
 *
 * @param messageId - Message ID
 */
export async function deleteMessageAmendments(messageId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('amendment_requests')
    .delete()
    .eq('message_id', messageId);

  if (error) {
    throw new Error(`Failed to delete message amendments: ${error.message}`);
  }
}
