/**
 * GET /api/v1/chat/sessions
 *
 * List user's chat sessions with optional status filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { listChatSessions } from '@/lib/supabase/chat-sessions';
import type { ChatSessionListResponse } from '@/types/chat';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view sessions.' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam === 'active' || statusParam === 'closed' ? statusParam : undefined;

    // Get user's chat sessions
    const sessions = await listChatSessions(user.id, status);

    // Build response
    const response: ChatSessionListResponse = {
      sessions,
      total: sessions.length,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/v1/chat/sessions:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to retrieve chat sessions',
        details: errorMessage,
        context: 'An error occurred while fetching your chat sessions. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
