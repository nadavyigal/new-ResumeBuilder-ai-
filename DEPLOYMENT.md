# Deployment Guide

## Production Deployment

The application is deployed on Vercel at:
- **Production URL**: https://new-resume-builder-ai.vercel.app
- **Project Dashboard**: https://vercel.com/nadavyigal-gmailcoms-projects/new-resume-builder-ai

## Environment Variables

The following environment variables are configured in Vercel for all environments (Production, Preview, Development):

### Required Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `OPENAI_API_KEY` - OpenAI API key for AI resume optimization

### Optional Variables
- `STRIPE_SECRET_KEY` - Stripe secret key (not configured yet)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (not configured yet)
- `STRIPE_PREMIUM_PRICE_ID` - Stripe premium plan price ID (not configured yet)

## Git Branching Strategy

### Branches
- **`main`** - Production branch, deploys to https://new-resume-builder-ai.vercel.app
- **`develop`** - Development branch, auto-deploys to preview URLs (now active)

### Workflow
1. Create feature branches from `develop`
2. Work on features and commit to feature branches
3. Create PR to merge feature branch → `develop`
4. Test on preview deployment (Vercel automatically creates preview URLs)
5. When ready for production, create PR to merge `develop` → `main`
6. Main branch automatically deploys to production

### Testing the Workflow
To test preview deployments:
```bash
# Switch to develop branch
git checkout develop

# Make changes and commit
git add .
git commit -m "test: verify preview deployment workflow"

# Push to GitHub
git push github develop

# Vercel will automatically create a preview deployment
# Check Vercel dashboard for the preview URL
```

## Supabase Connection

The application connects to the Supabase project:
- **Project**: ResumeBuilder AI
- **Project ID**: brtdyamysfmctrhuankn
- **Region**: eu-north-1
- **Status**: ACTIVE_HEALTHY

## Deployment Process

### Automatic Deployments (GitHub Integration)
- Every push to `main` → production deployment
- Every push to `develop` → preview deployment
- Every PR → preview deployment

### Manual Deployment (Vercel CLI)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Build Configuration

See `next.config.ts` for build settings:
- ESLint: Disabled during builds (`ignoreDuringBuilds: true`)
- TypeScript: Type checking disabled during builds (`ignoreBuildErrors: true`)
- Webpack: PDF parsing externalized for server-side rendering

## Troubleshooting

### 404 Errors on All Routes
- **Cause**: Missing environment variables
- **Solution**: Ensure all required env vars are set in Vercel dashboard

### Build Failures
- **Cause**: Type errors or linting errors
- **Solution**: Currently bypassed via next.config.ts settings

### Middleware Issues
- **Note**: Middleware is currently disabled (middleware.ts.disabled)
- If re-enabling, ensure it doesn't break routing

## Monitoring

- **Build Logs**: Available in Vercel dashboard for each deployment
- **Runtime Logs**: Check Functions tab in Vercel dashboard
- **Error Tracking**: Sentry integration configured (via `@sentry/nextjs`)

Last Updated: 2025-10-26
