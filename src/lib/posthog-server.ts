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

/**
 * Stamped on every server event so a release can be told apart in analysis.
 *
 * Client events carry `app_version` from the iOS bundle; server events carried
 * nothing. Since `optimization_completed` and `export_success` are emitted from
 * both sides, any funnel over them could not be filtered to a single release —
 * the server half always came along regardless of which build produced it.
 *
 * `backend_release` is the deploy identity (Vercel supplies the SHA), and
 * `emitter` mirrors the property the iOS client now sends, so the two halves of
 * a shared event name are separable without inspecting `$lib`.
 */
const SERVER_EVENT_CONTEXT = {
  emitter: 'server',
  backend_release:
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.BACKEND_RELEASE || 'unknown',
  backend_env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
} as const;

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
      // Caller properties win, so an explicit value is never silently replaced.
      properties: { ...SERVER_EVENT_CONTEXT, ...properties },
    });
    await client.flush();
  } catch (error) {
    console.error('PostHog server capture error:', error);
  }
}
