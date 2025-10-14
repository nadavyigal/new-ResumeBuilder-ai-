/**
 * GET /api/v1/chat/sessions/[id]/messages
 *
 * Get paginated message history for a session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getChatSession } from '@/lib/supabase/chat-sessions';
import { getSessionMessages, countSessionMessages } from '@/lib/supabase/chat-messages';
import type { ChatMessagesResponse } from '@/types/chat';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view messages.' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const sessionId = params.id;

    // Verify session exists and user owns it
    const session = await getChatSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: 'Session not found.' },
        { status: 404 }
      );
    }

    if (user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You do not own this session.' },
        { status: 403 }
      );
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '20', 10), 100); // Max 100

    if (page < 1 || pageSize < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters. Page and page_size must be positive integers.' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get messages and total count
    const [messages, total] = await Promise.all([
      getSessionMessages(sessionId, { limit: pageSize, offset }),
      countSessionMessages(sessionId),
    ]);

    // Calculate has_more
    const hasMore = offset + messages.length < total;

    // Build response
    const response: ChatMessagesResponse = {
      messages,
      total,
      page,
      page_size: pageSize,
      has_more: hasMore,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/v1/chat/sessions/[id]/messages:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to retrieve messages',
        details: errorMessage,
        context: 'An error occurred while fetching messages. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
