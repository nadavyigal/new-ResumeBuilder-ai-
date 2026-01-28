/**
 * POST /api/v1/chat/sessions/[id]/apply
 *
 * Apply an amendment to the resume and create a new version.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getChatSession } from '@/lib/supabase/chat-sessions';
import { createVersion, getLatestVersion } from '@/lib/chat-manager/versioning';
import type { ChatApplyAmendmentRequest, ChatApplyAmendmentResponse } from '@/types/chat';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to apply amendments.' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const sessionId = params.id;

    // Get session and verify ownership
    const session = await getChatSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found.' },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You do not own this session.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ChatApplyAmendmentRequest = await request.json();
    const { amendment_id } = body;

    if (!amendment_id) {
      return NextResponse.json(
        { error: 'Missing required field: amendment_id' },
        { status: 400 }
      );
    }

    // Get amendment request
    const { data: amendmentRequest, error: amendmentError } = await supabase
      .from('amendment_requests')
      .select('*')
      .eq('id', amendment_id)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (amendmentError || !amendmentRequest) {
      return NextResponse.json(
        { error: 'Amendment request not found.' },
        { status: 404 }
      );
    }

    if (amendmentRequest.status === 'applied') {
      return NextResponse.json(
        { error: 'Amendment already applied.' },
        { status: 400 }
      );
    }

    if (amendmentRequest.status === 'rejected') {
      return NextResponse.json(
        { error: 'Cannot apply rejected amendment.' },
        { status: 400 }
      );
    }

    // Get current resume content (from latest version or original optimization)
    const latestVersion = await getLatestVersion(session.optimization_id);
    let currentContent: Record<string, unknown>;

    if (latestVersion) {
      currentContent = latestVersion.content;
    } else {
      // No versions yet, get from optimization
      const { data: optimization } = await supabase
        .from('optimizations')
        .select('rewrite_data')
        .eq('id', session.optimization_id)
        .maybeSingle();

      currentContent = optimization?.rewrite_data || {};
    }

    // TODO: Implement actual amendment application logic
    // For now, create a simple mock implementation
    const updatedContent = { ...currentContent };

    // Apply the amendment based on type
    // This is a simplified implementation - Phase 3.5 will add proper AI-based amendment application
    const section = amendmentRequest.target_section || 'summary';
    if (!updatedContent[section]) {
      updatedContent[section] = '';
    }

    switch (amendmentRequest.type) {
      case 'add':
        updatedContent[section] = `${updatedContent[section]} [Added: ${amendmentRequest.type}]`;
        break;
      case 'modify':
        updatedContent[section] = `${updatedContent[section]} [Modified: ${amendmentRequest.type}]`;
        break;
      case 'remove':
        updatedContent[section] = `${updatedContent[section]} [Removed: ${amendmentRequest.type}]`;
        break;
      default:
        break;
    }

    // Create new version
    const changeSummary = `Applied ${amendmentRequest.type} amendment to ${section}`;
    const newVersion = await createVersion({
      optimizationId: session.optimization_id,
      sessionId: sessionId,
      content: updatedContent,
      changeSummary,
    });

    // Mark amendment as applied
    await supabase
      .from('amendment_requests')
      .update({
        status: 'applied',
        processed_at: new Date().toISOString(),
      })
      .eq('id', amendment_id);

    // Build response
    const response: ChatApplyAmendmentResponse = {
      version_id: newVersion.id,
      version_number: newVersion.versionNumber,
      change_summary: changeSummary,
      updated_content: updatedContent,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/v1/chat/sessions/[id]/apply:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to apply amendment',
        details: errorMessage,
        context: 'An error occurred while applying the amendment. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
