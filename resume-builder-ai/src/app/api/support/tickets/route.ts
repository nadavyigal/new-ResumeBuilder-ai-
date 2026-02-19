import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase-server';
import { captureServerEvent } from '@/lib/posthog-server';
import { sendTicketAdminAlert, sendTicketAcknowledgement } from '@/lib/feedback-notifications';
import type { SupportTicketInsert } from '@/types/feedback';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, subject, message, category } = body as SupportTicketInsert;

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'email, subject, and message are required' },
        { status: 400 }
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Message is too short. Please provide more detail.' },
        { status: 400 }
      );
    }

    const validCategories = ['billing', 'technical', 'account', 'other'];
    const ticketCategory = validCategories.includes(category ?? '') ? category! : 'other';

    // Get user if authenticated
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const serviceClient = createServiceRoleClient();
    const { data: ticket, error } = await serviceClient
      .from('support_tickets')
      .insert({
        user_id: user?.id ?? null,
        email,
        name: name ?? null,
        subject,
        message,
        category: ticketCategory as 'billing' | 'technical' | 'account' | 'other',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to create support ticket:', error);
      return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
    }

    // Track in PostHog
    const distinctId = user?.id ?? email;
    await captureServerEvent(distinctId, 'support_ticket_created', {
      category: ticketCategory,
      ticket_id: ticket.id,
    });

    // Send emails in parallel — non-blocking so we don't fail the response if email fails
    Promise.all([
      sendTicketAdminAlert(ticket).catch((err) =>
        console.error('Failed to send ticket admin alert:', err)
      ),
      sendTicketAcknowledgement(ticket).catch((err) =>
        console.error('Failed to send ticket acknowledgement:', err)
      ),
    ]);

    return NextResponse.json({
      success: true,
      id: ticket.id,
      ticketRef: ticket.id.slice(0, 8).toUpperCase(),
    });
  } catch (error) {
    console.error('Support tickets API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
