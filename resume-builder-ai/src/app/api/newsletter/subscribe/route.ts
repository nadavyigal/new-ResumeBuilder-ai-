import { NextRequest, NextResponse } from 'next/server';
import { sendNewsletterWelcomeEmail } from '@/lib/email';
import { createServerClient } from '@/lib/supabase-server';

/**
 * POST /api/newsletter/subscribe
 * Subscribe a user to the newsletter and send a welcome email
 */
export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Optional: Store subscriber in database
    const supabase = createServerClient();

    // Check if subscriber already exists
    const { data: existingSubscriber } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingSubscriber) {
      return NextResponse.json(
        { error: 'Email already subscribed' },
        { status: 400 }
      );
    }

    // Store the subscriber
    const { error: dbError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
        name: name || null,
        subscribed_at: new Date().toISOString(),
        status: 'active',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue with email even if DB fails
    }

    // Send welcome email
    const emailResult = await sendNewsletterWelcomeEmail(email, name);

    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      return NextResponse.json(
        {
          success: true,
          message: 'Subscribed successfully, but welcome email may be delayed',
          emailSent: false
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully subscribed! Check your email for a welcome message.',
        emailSent: true
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}
