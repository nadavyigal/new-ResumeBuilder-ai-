/**
 * POST /api/v1/chat/sessions/[id]/preview
 *
 * Preview amendment changes without applying them.
 * Returns diff between current and proposed resume content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getChatSession } from '@/lib/supabase/chat-sessions';
import { getLatestVersion } from '@/lib/chat-manager/versioning';
import { processMessage } from '@/lib/chat-manager/processor';
import type { ChatPreviewAmendmentRequest, ChatPreviewAmendmentResponse, DiffResult } from '@/types/chat';

/**
 * Simple diff function to compare two objects
 * Returns array of changes
 */
function generateDiff(
  original: Record<string, unknown>,
  proposed: Record<string, unknown>
): DiffResult[] {
  const diff: DiffResult[] = [];
  const allKeys = new Set([...Object.keys(original), ...Object.keys(proposed)]);

  allKeys.forEach(key => {
    const originalValue = JSON.stringify(original[key] || '', null, 2);
    const proposedValue = JSON.stringify(proposed[key] || '', null, 2);

    if (originalValue !== proposedValue) {
      if (!original[key]) {
        diff.push({
          type: 'added',
          value: `${key}: ${proposedValue}`,
        });
      } else if (!proposed[key]) {
        diff.push({
          type: 'removed',
          value: `${key}: ${originalValue}`,
        });
      } else {
        diff.push({
          type: 'removed',
          value: `${key}: ${originalValue}`,
        });
        diff.push({
          type: 'added',
          value: `${key}: ${proposedValue}`,
        });
      }
    }
  });

  return diff;
}

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
        { error: 'Unauthorized. Please sign in to preview amendments.' },
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
    const body: ChatPreviewAmendmentRequest = await request.json();
    const { message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message too long. Maximum 5000 characters.' },
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
        .select('optimized_data')
        .eq('id', session.optimization_id)
        .maybeSingle();

      currentContent = optimization?.optimized_data || {};
    }

    // Process message to extract amendment intent
    const processResult = await processMessage({
      message,
      sessionId: sessionId,
      currentResumeContent: currentContent,
    });

    if (!processResult.shouldApply) {
      return NextResponse.json(
        {
          error: 'Cannot preview this amendment',
          reason: processResult.aiResponse,
        },
        { status: 400 }
      );
    }

    // Generate proposed content
    // TODO: Implement actual AI-based amendment application in Phase 3.5
    // For now, create a simple mock implementation
    const proposedContent = { ...currentContent };
    const amendment = processResult.amendments[0];

    if (amendment) {
      const section = amendment.section || 'summary';
      if (!proposedContent[section]) {
        proposedContent[section] = '';
      }

      switch (amendment.operation) {
        case 'add':
          proposedContent[section] = `${proposedContent[section]} [Preview: Add]`;
          break;
        case 'modify':
          proposedContent[section] = `${proposedContent[section]} [Preview: Modify]`;
          break;
        case 'remove':
          proposedContent[section] = `${proposedContent[section]} [Preview: Remove]`;
          break;
        default:
          break;
      }
    }

    // Generate diff
    const diff = generateDiff(currentContent, proposedContent);

    // Generate change summary
    const changeSummary = amendment
      ? `Preview: ${amendment.operation} in ${amendment.section || 'summary'}`
      : 'Preview: Changes to resume';

    // Build response
    const response: ChatPreviewAmendmentResponse = {
      original_content: currentContent,
      proposed_content: proposedContent,
      diff,
      change_summary: changeSummary,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/v1/chat/sessions/[id]/preview:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to preview amendment',
        details: errorMessage,
        context: 'An error occurred while generating the preview. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
