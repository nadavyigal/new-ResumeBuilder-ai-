// PostHog Server-Side Analytics
// Project: ResumeBuilder AI (PostHog Project ID: 270848)

import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (posthogClient) return posthogClient;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Server-side analytics disabled.');
    return null;
  }

  posthogClient = new PostHog(apiKey, {
    host: apiHost,
    flushAt: 1, // Flush immediately in serverless
    flushInterval: 0,
  });

  return posthogClient;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties,
    });
    await client.flush();
  } catch (error) {
    console.error('PostHog server capture error:', error);
  }
}

