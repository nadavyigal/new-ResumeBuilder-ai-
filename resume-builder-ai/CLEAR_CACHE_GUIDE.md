# Clear Cache Guide - Fix 406 Errors

## What's the Issue?

If you're seeing an error like **"Cannot coerce the result to a single JSON object (406)"**, your browser is using outdated cached JavaScript code from a previous version of the application.

## Root Cause

The 406 error occurs when:
1. The application was updated with new database query patterns
2. Your browser still has old JavaScript chunks cached
3. The old code tries to make queries that are no longer valid
4. Supabase rejects these malformed queries with a 406 status

## Quick Fixes (Try in Order)

### Fix 1: Hard Refresh (Fastest) ⚡

**Windows/Linux:**
- Press `Ctrl + Shift + R` or `Ctrl + F5`

**macOS:**
- Press `Cmd + Shift + R`

This forces your browser to bypass cache and fetch fresh code from the server.

### Fix 2: Clear Browser Cache 🗑️

If hard refresh doesn't work:

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Choose "All time" from the time range
4. Click "Clear data"
5. Reload the page

**Firefox:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cache"
3. Choose "Everything" from the time range
4. Click "Clear Now"
5. Reload the page

**Safari:**
1. Press `Cmd + Option + E` to empty caches
2. Or go to Develop → Empty Caches
3. Reload the page

### Fix 3: Use Incognito/Private Mode 🕵️

Open the application in an incognito or private window:

- **Chrome/Edge:** `Ctrl + Shift + N` (Windows) or `Cmd + Shift + N` (Mac)
- **Firefox:** `Ctrl + Shift + P` (Windows) or `Cmd + Shift + P` (Mac)
- **Safari:** `Cmd + Shift + N`

This ensures no cached code is loaded.

### Fix 4: Clear All Site Data 🔧

For persistent issues:

**Chrome/Edge:**
1. Click the lock icon in the address bar
2. Click "Site settings"
3. Scroll down and click "Clear data"
4. Reload the page

**Firefox:**
1. Right-click the page → "Inspect"
2. Go to "Storage" tab
3. Right-click on the domain → "Delete All"
4. Reload the page

## For Developers

### What We've Implemented

1. **Build ID Cache Busting** (`next.config.ts`)
   - Unique build IDs generated on each deployment
   - Forces browsers to fetch new chunks

2. **Middleware Headers** (`middleware.ts`)
   - `X-App-Version: 3.0.0` - Version tracking
   - `Cache-Control: no-cache, no-store, must-revalidate, max-age=0`
   - `Pragma: no-cache`
   - `Expires: 0`

3. **Error Boundary** (`CacheBustingErrorBoundary.tsx`)
   - Detects 406 errors automatically
   - Shows user-friendly cache clearing instructions
   - Provides one-click cache clearing

4. **Fixed Query Pattern** (`optimizations/[id]/page.tsx`)
   - Changed from: `.select("rewrite_data, resumes(raw_text), job_descriptions(raw_text)").single()`
   - To: Separate queries for optimization, resume, and job description
   - Prevents Supabase 406 "Cannot coerce" errors

### Testing

To verify the fix:

1. **Clean build:**
   ```bash
   cd resume-builder-ai
   rm -rf .next
   npm run build
   npm run dev
   ```

2. **Test in incognito:**
   - Open application in incognito mode
   - Navigate to an optimization page
   - Verify no 406 errors occur

3. **Verify headers:**
   - Open DevTools → Network tab
   - Check response headers include cache-busting directives

### Prevention Strategy

Going forward:

1. Always increment `X-App-Version` in middleware when deploying breaking changes
2. Test in incognito mode before deploying
3. Use separate queries instead of table joins with `.single()`
4. Monitor Sentry/logs for 406 errors
5. Educate users to hard refresh after deployments

## Still Having Issues?

If none of the above solutions work:

1. Try a different browser
2. Check if you're using a VPN or proxy that might cache content
3. Clear DNS cache:
   - **Windows:** `ipconfig /flushdns` in Command Prompt
   - **Mac:** `sudo dscacheutil -flushcache` in Terminal
4. Check browser extensions - some ad blockers cache aggressively
5. Report the issue with:
   - Browser name and version
   - Exact error message
   - Network tab screenshot from DevTools

---

**Last Updated:** 2025-10-19
**Version:** 3.0.0
