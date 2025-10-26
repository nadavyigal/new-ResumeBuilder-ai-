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

## Deployment Status

### ✅ Production Deployment (ACTIVE)
- **URL**: https://new-resume-builder-ai.vercel.app
- **Status**: ✅ Working (200 OK)
- **Branch**: `main`
- **Last Deployment**: Commit `9f97a9c` - "chore: add vercel.json to explicitly specify Next.js framework"
- **Build Status**: Success
- **Pages**: All routes properly pre-rendered and cached

### 🔄 Preview Deployments (ACTIVE)
- **Branch**: `develop`
- **Auto-deploy**: ✅ Enabled via Vercel GitHub integration
- **Last Test**: Commit `9e6aa95` - "docs: update branching strategy with develop branch info"
- **Check Status**: Visit [Vercel Dashboard](https://vercel.com/nadavyigal-gmailcoms-projects/new-resume-builder-ai) → Deployments tab

## Fixes Applied

The following fixes were applied to resolve 404 errors and enable successful deployment:

1. **Supabase Client Browser-Only Initialization** (commit `34200d0`)
   - Modified `src/lib/supabase.ts` to only create Supabase client in browser context
   - Added `typeof window === 'undefined'` check to prevent SSR/build-time initialization
   - Returns placeholder during server-side rendering

2. **Removed Force Dynamic Rendering** (commit `e56b059`)
   - Removed `export const dynamic = 'force-dynamic'` from `src/app/layout.tsx`
   - Allows Next.js to properly pre-render static pages at build time
   - Improves performance with static page generation

3. **Explicit Framework Configuration** (commit `9f97a9c`)
   - Added `vercel.json` with explicit Next.js framework specification
   - Ensures Vercel properly detects and builds the Next.js application

## Troubleshooting

### 404 Errors on All Routes
- **Previous Issue**: ✅ RESOLVED
- **Root Cause**: Supabase client was being initialized during build time, causing static generation to fail
- **Solution Applied**: Browser-only client initialization + removed force-dynamic export

### Build Failures
- **Status**: ✅ No current issues
- **Note**: TypeScript/ESLint errors are bypassed via next.config.ts settings (by design)

### Middleware Issues
- **Note**: Middleware is currently disabled (middleware.ts.disabled)
- If re-enabling, ensure it doesn't break routing

## Monitoring

- **Build Logs**: Available in Vercel dashboard for each deployment
- **Runtime Logs**: Check Functions tab in Vercel dashboard
- **Error Tracking**: Sentry integration configured (via `@sentry/nextjs`)

Last Updated: 2025-10-26
