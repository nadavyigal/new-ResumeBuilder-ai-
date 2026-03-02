import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { WELCOME_SEQUENCE } from '@/lib/welcome-emails';

const BUTTONDOWN_API = 'https://api.buttondown.com/v1';

interface ButtondownSubscriber {
  id: string;
  email_address: string;
  creation_date: string;
  tags: string[];
  type: string;
  metadata: Record<string, string>;
}

interface ButtondownListResponse {
  results: ButtondownSubscriber[];
  next: string | null;
  count: number;
}

/**
 * GET /api/cron/welcome-emails
 *
 * Vercel Cron job that runs daily to send welcome sequence emails.
 * Uses Buttondown for subscriber management and Resend for delivery.
 *
 * Flow:
 * 1. Fetch all confirmed subscribers from Buttondown
 * 2. For each subscriber, check age (days since signup) and tags
 * 3. Send the appropriate email via Resend
 * 4. Tag the subscriber in Buttondown to prevent duplicate sends
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const buttondownKey = process.env.BUTTONDOWN_API_KEY;
  if (!buttondownKey) {
    return NextResponse.json({ error: 'BUTTONDOWN_API_KEY not configured' }, { status: 500 });
  }

  const results: { email: string; sent: string; error?: string }[] = [];

  try {
    // Fetch all subscribers (paginated)
    const subscribers = await fetchAllSubscribers(buttondownKey);
    const now = new Date();

    for (const subscriber of subscribers) {
      // Skip unconfirmed subscribers
      if (subscriber.type !== 'regular') continue;

      const signupDate = new Date(subscriber.creation_date);
      const ageDays = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
      const existingTags = new Set(subscriber.tags);

      for (const step of WELCOME_SEQUENCE) {
        if (ageDays >= step.minAgeDays && !existingTags.has(step.tag)) {
          const { subject, html } = step.getEmail({
            firstName: subscriber.metadata?.first_name,
          });

          const sendResult = await sendEmail({
            to: subscriber.email_address,
            subject,
            html,
          });

          if (sendResult.success) {
            // Tag subscriber to prevent duplicate sends
            await tagSubscriber(buttondownKey, subscriber.id, [
              ...subscriber.tags,
              step.tag,
            ]);
            results.push({ email: subscriber.email_address, sent: step.tag });
          } else {
            results.push({
              email: subscriber.email_address,
              sent: step.tag,
              error: 'send_failed',
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed: subscribers.length,
      sent: results.filter((r) => !r.error).length,
      errors: results.filter((r) => r.error).length,
      details: results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Welcome email cron error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: results },
      { status: 500 }
    );
  }
}

async function fetchAllSubscribers(apiKey: string): Promise<ButtondownSubscriber[]> {
  const all: ButtondownSubscriber[] = [];
  let url: string | null = `${BUTTONDOWN_API}/subscribers?type=regular`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!response.ok) {
      console.error(`Buttondown API error: ${response.status}`);
      break;
    }

    const data: ButtondownListResponse = await response.json();
    all.push(...data.results);
    url = data.next;
  }

  return all;
}

async function tagSubscriber(
  apiKey: string,
  subscriberId: string,
  tags: string[]
): Promise<void> {
  const response = await fetch(`${BUTTONDOWN_API}/subscribers/${subscriberId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });

  if (!response.ok) {
    console.error(`Failed to tag subscriber ${subscriberId}: ${response.status}`);
  }
}
