# Deployment Fix Guide

## Problem Summary
Your website https://www.resumelybuilderai.com was not accessible because all Vercel deployments were failing during the build process.

## Root Cause
The build was failing with this error:
```
Error: Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.
```

The issue was caused by:
1. Environment validation (`getEnv()`) running at module import time
2. `OPENAI_API_KEY` being required during build-time when it's only needed at runtime
3. Multiple files calling `getEnv()` at the module level

## Fixes Applied

### 1. Made Environment Validation Build-Friendly
**File: `src/lib/env.ts`**
- Made `OPENAI_API_KEY` optional in the Zod schema
- Changed module-level validation to only run in development mode
- Added try-catch with warning instead of throwing errors

### 2. Removed Module-Level getEnv() Calls
**Files modified:**
- `src/lib/openai.ts` - Moved env access inside the lazy initialization function
- `src/lib/supabase.ts` - Moved env access inside the client creation function

## Next Steps

### Step 1: Set Environment Variables in Vercel
You need to add the `OPENAI_API_KEY` to your Vercel project:

1. Go to: https://vercel.com/nadavyigal-gmailcoms-projects/resume-builder-ai/settings/environment-variables

2. Add the following environment variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-`)
   - **Environment:** Production, Preview, and Development (select all)

3. Also verify these are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Trigger a New Deployment
After setting the environment variables, trigger a new deployment:

**Option A: Via Vercel Dashboard**
1. Go to: https://vercel.com/nadavyigal-gmailcoms-projects/resume-builder-ai
2. Click "Deployments" tab
3. Click the "..." menu on the latest deployment
4. Select "Redeploy"

**Option B: Push the fixes (if you haven't already)**
```bash
cd "resume-builder-ai"
git add src/lib/env.ts src/lib/openai.ts src/lib/supabase.ts
git commit -m "fix: prevent build-time environment validation errors"
git push
```

### Step 3: Configure Custom Domain
Once the deployment succeeds, configure your custom domain:

1. Go to: https://vercel.com/nadavyigal-gmailcoms-projects/resume-builder-ai/settings/domains

2. Add your custom domain:
   - Click "Add Domain"
   - Enter: `www.resumelybuilderai.com`
   - Also add the apex domain: `resumelybuilderai.com`

3. Configure DNS:
   - For `www.resumelybuilderai.com`: Add a CNAME record pointing to `cname.vercel-dns.com`
   - For `resumelybuilderai.com`: Add an A record pointing to `76.76.21.21`
   
4. Vercel will automatically provision SSL certificates (takes a few minutes)

### Step 4: Verify Deployment
Once the deployment is complete:

1. Check the deployment status: https://vercel.com/nadavyigal-gmailcoms-projects/resume-builder-ai
2. Wait for the build to show "Ready" status
3. Test the default Vercel URL first
4. Then test your custom domain

## Current Deployment Status
- **Latest Deployment:** ERROR (before fixes)
- **Project Status:** live: false
- **Custom Domain:** NOT configured yet

## Monitoring
After deployment, monitor:
- Build logs for any new errors
- Runtime errors in the Vercel logs
- API endpoint functionality (test resume upload/optimization)

## Technical Details

### What Changed
1. **Environment Validation**: Now happens lazily at runtime instead of build-time
2. **OpenAI Initialization**: Remains lazy-loaded but no longer depends on module-level env access
3. **Supabase Client**: Now creates env variables on-demand instead of at module import

### Why This Works
- Next.js builds in a separate environment where runtime secrets aren't available
- By deferring env access until actual runtime (when API routes are called), we avoid build-time errors
- The app will still fail gracefully if API keys are missing at runtime, but the build will succeed

## Getting Your OpenAI API Key
If you don't have an OpenAI API key:
1. Go to: https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add it to Vercel environment variables

**Important**: Never commit API keys to your repository!
