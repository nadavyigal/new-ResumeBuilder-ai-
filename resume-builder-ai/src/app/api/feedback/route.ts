import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import { sendFeedbackAdminAlert } from '@/lib/feedback-notifications';
import type { FeedbackInsert } from '@/types/feedback';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, rating, message, context, session_id } = body as FeedbackInsert & { session_id?: string };

    if (!type || !['general', 'bug', 'feature_request', 'nps', 'rating'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 });
    }

    if (rating != null && (typeof rating !== 'number' || rating < 0 || rating > 10)) {
      return NextResponse.json({ error: 'Rating must be a number between 0 and 10' }, { status: 400 });
    }

    // Get user if authenticated (feedback can be anonymous)
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const serviceClient = createServiceRoleClient();
    const { data: feedback, error } = await (serviceClient as any)
      .from('feedback')
      .insert({
        user_id: user?.id ?? null,
        session_id: session_id ?? null,
        type,
        rating: rating ?? null,
        message: message ?? null,
        context: context ?? {},
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to insert feedback:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    if (!feedback) {
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    // Track in PostHog
    const distinctId = user?.id ?? session_id ?? 'anonymous';
    await captureServerEvent(distinctId, 'feedback_submitted', {
      type,
      rating,
      has_message: !!message,
      page: context?.page,
    });

    // Send admin alert (non-blocking — don't fail request if email fails)
    sendFeedbackAdminAlert(feedback, user?.email).catch((err) =>
      console.error('Failed to send feedback admin alert:', err)
    );

    return NextResponse.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
