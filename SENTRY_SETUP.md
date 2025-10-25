# Sentry Setup Guide

This document explains how to set up Sentry error tracking for production monitoring.

## What is Sentry?

Sentry is an error tracking service that helps you:
- Monitor errors in production in real-time
- Track performance issues and slow operations
- Capture user sessions for debugging (optional)
- Get notified when errors occur
- View stack traces and context for every error

## Setup Steps

### 1. Create a Sentry Account

1. Go to [https://sentry.io](https://sentry.io)
2. Sign up for a free account
3. Create a new project
4. Select "Next.js" as the platform

### 2. Get Your DSN

After creating the project:
1. Navigate to **Settings** → **Projects** → **Your Project**
2. Click on **Client Keys (DSN)**
3. Copy the **DSN** value (it looks like: `https://[key]@[org].ingest.sentry.io/[project]`)

### 3. Configure Environment Variable

Add the DSN to your environment variables:

**For development (.env.local):**
```
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

**For production:**
- Add `NEXT_PUBLIC_SENTRY_DSN` to your deployment platform's environment variables
- Examples:
  - **Vercel**: Project Settings → Environment Variables
  - **Netlify**: Site Settings → Build & deploy → Environment
  - **Railway**: Project → Variables

### 4. Verify Setup

Sentry is configured to only run in production (`NODE_ENV=production`). To test locally:

1. Set `NODE_ENV=production` temporarily
2. Start the app: `npm run build && npm start`
3. Trigger an error (e.g., visit a non-existent page)
4. Check your Sentry dashboard for the error

## Configuration Files

The following files have been created:

- **sentry.client.config.ts** - Client-side error tracking
  - Captures React component errors
  - Records user sessions (with privacy settings)
  - Tracks client-side performance

- **sentry.server.config.ts** - Server-side error tracking
  - Captures API route errors
  - Filters sensitive data (auth tokens, cookies)
  - Tracks server performance

- **sentry.edge.config.ts** - Edge runtime tracking
  - For middleware and edge functions

## Privacy & Security Features

### Data Filtering

The server config automatically filters:
- Authorization headers
- Cookies
- Database connection strings
- Supabase URLs

### Session Replay Privacy

Session replay is configured with:
- `maskAllText: true` - All text is masked
- `blockAllMedia: true` - Images/videos are blocked
- Only 10% of sessions recorded in production
- 100% of error sessions captured

## Sampling Rates

### Performance Monitoring
- **Development**: 100% of transactions tracked
- **Production**: 10% of transactions sampled (to reduce costs)

### Session Replay
- **Development**: 0% (disabled)
- **Production**:
  - 10% of normal sessions
  - 100% of sessions with errors

## Cost Management

Sentry has a generous free tier:
- 5,000 errors per month
- 10,000 performance units
- 50 replays

To stay within free tier:
- Sampling is set to 10% in production
- Only errors trigger full session recording
- Sensitive data is filtered

## Disabling Sentry

To disable Sentry:
1. Remove or leave empty `NEXT_PUBLIC_SENTRY_DSN` in environment
2. Sentry will be disabled automatically

OR

Set in environment:
```
NODE_ENV=development
```

## Monitoring in Production

Once deployed, you can:

1. **View Errors**: Sentry Dashboard → Issues
2. **Check Performance**: Performance → Web Vitals
3. **Watch Replays**: Replays → Session Replays
4. **Set Alerts**: Alerts → Create Alert Rule

## Integration with Existing Logger

Our structured logger (`src/lib/logger.ts`) already integrates with Sentry:
- All `log.error()` calls are sent to Sentry
- Context is preserved
- Stack traces are captured

Example:
```typescript
import { log } from '@/lib/logger';

try {
  // ... some code
} catch (error) {
  log.error('Failed to process payment', error, {
    userId: user.id,
    amount: 99.99,
  });
  // Error is automatically sent to Sentry with context
}
```

## Troubleshooting

### Errors not appearing in Sentry

1. Check that `NODE_ENV=production`
2. Verify `NEXT_PUBLIC_SENTRY_DSN` is set correctly
3. Check browser console for Sentry initialization messages
4. Test with a thrown error: `throw new Error('Test error')`

### Too many events

If you're hitting rate limits:
1. Lower `tracesSampleRate` in config files
2. Add error filtering in `beforeSend` hook
3. Upgrade to paid plan for more quota

### Session replays not working

1. Ensure user privacy: replays are intentionally limited
2. Check that error occurred (100% capture on errors)
3. Wait a few minutes for processing

## Best Practices

1. **Don't log sensitive data**: Sentry filters some data, but be careful
2. **Add context**: Use structured logging with context objects
3. **Group similar errors**: Use error grouping in Sentry dashboard
4. **Set up alerts**: Get notified of critical errors via email/Slack
5. **Review regularly**: Check Sentry weekly for patterns

## Support

- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Our implementation: See `src/lib/logger.ts` and `src/components/error-boundary.tsx`
