/**
 * POST /api/v1/chat
 *
 * Send a chat message and receive AI response.
 * Creates or resumes session automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getActiveSession } from '@/lib/supabase/chat-sessions';
import { processMessage } from '@/lib/chat-manager/processor';
import { streamChatResponse } from '@/lib/chat-manager/ai-client';
import type { ChatSendMessageRequest, ChatSendMessageResponse } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use chat.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ChatSendMessageRequest = await request.json();
    const { session_id, optimization_id, message } = body;

    if (!optimization_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: optimization_id and message are required.' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0 || message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be between 1 and 5000 characters.' },
        { status: 400 }
      );
    }

    // Get or create chat session
    let chatSession;
    if (session_id) {
      // Resume existing session
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (!existingSession) {
        return NextResponse.json(
          { error: 'Session not found or access denied.' },
          { status: 404 }
        );
      }

      chatSession = existingSession;
    } else {
      // Create or get active session for this optimization
      const activeSession = await getActiveSession(user.id, optimization_id);

      if (activeSession) {
        chatSession = activeSession;
      } else {
        // Verify user owns the optimization
        const { data: optimization } = await supabase
          .from('optimizations')
          .select('id')
          .eq('id', optimization_id)
          .eq('user_id', user.id)
          .single();

        if (!optimization) {
          return NextResponse.json(
            { error: 'Optimization not found or access denied.' },
            { status: 404 }
          );
        }

        // Create new session using authenticated supabase client
        const now = new Date().toISOString();
        const { data: newSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            optimization_id,
            status: 'active',
            last_activity_at: now,
          })
          .select()
          .single();

        if (sessionError) {
          return NextResponse.json(
            { error: `Failed to create chat session: ${sessionError.message}` },
            { status: 500 }
          );
        }

        chatSession = newSession;
      }
    }

    // Save user message using authenticated supabase client
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: chatSession.id,
        sender: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMessageError) {
      return NextResponse.json(
        { error: `Failed to save user message: ${userMessageError.message}` },
        { status: 500 }
      );
    }

    // Update session last activity
    await supabase
      .from('chat_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', chatSession.id);

    // Get current resume content for processing
    const { data: optimization } = await supabase
      .from('optimizations')
      .select('optimized_data')
      .eq('id', optimization_id)
      .single();

    const currentResumeContent = optimization?.optimized_data || {};

    // Process message and generate AI response
    const startTime = Date.now();
    const processResult = await processMessage({
      message,
      sessionId: chatSession.id,
      currentResumeContent,
    });
    const processingTime = Date.now() - startTime;

    // Generate streaming AI response (for now, use the processor response)
    // TODO: Implement actual streaming with OpenAI in Phase 3.5
    const aiResponseText = processResult.aiResponse;

    // Save AI message using authenticated supabase client
    const { data: aiMessage, error: aiMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: chatSession.id,
        sender: 'ai',
        content: aiResponseText,
        metadata: {
          ai_model_version: 'gpt-4',
          processing_time_ms: processingTime,
          amendment_type: processResult.amendments[0]?.type,
          section_affected: processResult.amendments[0]?.targetSection || undefined,
        },
      })
      .select()
      .single();

    if (aiMessageError) {
      return NextResponse.json(
        { error: `Failed to save AI message: ${aiMessageError.message}` },
        { status: 500 }
      );
    }

    // Build response
    const response: ChatSendMessageResponse = {
      session_id: chatSession.id,
      message_id: aiMessage.id,
      ai_response: aiResponseText,
      requires_clarification: !processResult.shouldApply,
    };

    // Return response
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/v1/chat:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: errorMessage,
        context: 'An error occurred while processing your message. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
