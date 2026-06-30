// PostHog Server-Side Analytics
// Project: ResumeBuilder AI (PostHog Project ID: 270848)

import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
let warnedMissingPostHogKey = false;

export function getPostHogClient(): PostHog | null {
  if (posthogClient) return posthogClient;

  const apiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost =
    process.env.POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    'https://us.i.posthog.com';

  if (!apiKey) {
    if (!warnedMissingPostHogKey) {
      console.warn('PostHog API key not found. Server-side analytics disabled.');
      warnedMissingPostHogKey = true;
    }
    return null;
  }

  posthogClient = new PostHog(apiKey, {
    host: apiHost,
    flushAt: 1, // Flush immediately in serverless
    flushInterval: 0,
  });

  return posthogClient;
}

export async function flushPostHogClient() {
  const client = getPostHogClient();
  if (!client) return;

  try {
    await client.flush();
  } catch (error) {
    console.error('PostHog server flush error:', error);
  }
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
