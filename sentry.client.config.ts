import * as Sentry from "@sentry/nextjs";

const replayIntegration = (Sentry as unknown as {
  replayIntegration?: (options: { maskAllText?: boolean; blockAllMedia?: boolean }) => unknown;
}).replayIntegration;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay is used to record user sessions for debugging
  // This can be privacy-sensitive, so consider carefully before enabling
  integrations: replayIntegration
    ? [
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ]
    : [],

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay - only in production, 10% of sessions
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
});
