import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Server-specific options
  beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
    // Filter out sensitive data
    if (event.request) {
      // Remove sensitive headers
      delete event.request.headers?.['authorization'];
      delete event.request.headers?.['cookie'];
    }

    // Filter out database connection errors (contain sensitive URLs)
    if (hint.originalException && typeof hint.originalException === 'object') {
      const error = hint.originalException as Error;
      if (error.message?.includes('SUPABASE')) {
        // Sanitize error message
        event.message = 'Database connection error';
      }
    }

    return event;
  },
});
