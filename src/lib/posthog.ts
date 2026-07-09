// PostHog Analytics Client Initializer
// Project: ResumeBuilder AI (PostHog Project ID: 270848)
// Environment: production

import posthog from 'posthog-js';
import type { CaptureResult, Properties } from 'posthog-js';

const SENSITIVE_URL_PARAMS = new Set([
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
  'type',
  'email',
  'code',
  'state',
  'provider_token',
  'provider_refresh_token',
]);

const AUTH_ROUTE_SEGMENTS = ['/auth/callback', '/auth/reset-password'] as const;

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_SEGMENTS.some((segment) => pathname.includes(segment));
}

function stripSensitiveSearchParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) {
    if (SENSITIVE_URL_PARAMS.has(key)) {
      params.delete(key);
    }
  }
}

function sanitizeHash(hash: string): string {
  if (!hash || hash === '#') {
    return '';
  }

  const hashContent = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!hashContent.includes('=')) {
    return hash.startsWith('#') ? hash : `#${hash}`;
  }

  const hashParams = new URLSearchParams(
    hashContent.startsWith('?') ? hashContent.slice(1) : hashContent,
  );
  stripSensitiveSearchParams(hashParams);

  const remaining = hashParams.toString();
  return remaining ? `#${remaining}` : '';
}

export function sanitizeAnalyticsUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (isAuthRoute(parsed.pathname)) {
      return parsed.pathname;
    }

    stripSensitiveSearchParams(parsed.searchParams);
    parsed.hash = sanitizeHash(parsed.hash);

    const search = parsed.searchParams.toString();
    const searchPart = search ? `?${search}` : '';

    return `${parsed.origin}${parsed.pathname}${searchPart}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function sanitizePostHogProperties(properties: Properties): Properties {
  const sanitized: Properties = { ...properties };

  if (typeof sanitized.$current_url === 'string') {
    sanitized.$current_url = sanitizeAnalyticsUrl(sanitized.$current_url);
  }

  if (typeof sanitized.$pathname === 'string' && isAuthRoute(sanitized.$pathname)) {
    sanitized.$pathname = sanitized.$pathname.split('?')[0].split('#')[0];
  }

  return sanitized;
}

function sanitizeBeforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) {
    return event;
  }

  return {
    ...event,
    properties: sanitizePostHogProperties(event.properties),
  };
}

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (posthog.__loaded) return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.');
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: 'identified_only',
    capture_pageview: false, // SPA pageviews tracked manually in PostHogProvider
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false, // Explicit event tracking only
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-private]',
    },
    before_send: sanitizeBeforeSend,
    loaded: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('PostHog initialized:', { apiHost, apiKey: apiKey.substring(0, 8) + '...' });
      }
    },
  });
}

export { posthog };
