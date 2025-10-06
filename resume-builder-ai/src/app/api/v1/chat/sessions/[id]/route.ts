/**
 * GET /api/v1/chat/sessions/[id]
 * DELETE /api/v1/chat/sessions/[id]
 *
 * Get session details or delete session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getChatSession, deleteChatSession } from '@/lib/supabase/chat-sessions';
import { getSessionMessages } from '@/lib/supabase/chat-messages';
import type { ChatSessionDetailResponse } from '@/types/chat';

/**
 * GET session details with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view session details.' },
        { status: 401 }
      );
    }

    const sessionId = params.id;

    // Get session
    const session = await getChatSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found.' },
        { status: 404 }
      );
    }

    // Verify ownership via RLS (check if user owns this session)
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You do not own this session.' },
        { status: 403 }
      );
    }

    // Get messages for this session
    const messages = await getSessionMessages(sessionId);

    // Build response
    const response: ChatSessionDetailResponse = {
      session,
      messages,
      total_messages: messages.length,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/v1/chat/sessions/[id]:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to retrieve session details',
        details: errorMessage,
        context: 'An error occurred while fetching session details. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to delete session.' },
        { status: 401 }
      );
    }

    const sessionId = params.id;

    // Get session to verify ownership
    const session = await getChatSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found.' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You cannot delete this session.' },
        { status: 403 }
      );
    }

    // Delete session (CASCADE will delete messages)
    await deleteChatSession(sessionId);

    return NextResponse.json(
      {
        success: true,
        message: 'Session deleted successfully',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in DELETE /api/v1/chat/sessions/[id]:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to delete session',
        details: errorMessage,
        context: 'An error occurred while deleting the session. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
