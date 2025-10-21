# Clear Cache Instructions - FIX 406 ERROR

## The 406 error is caused by browser cache. Follow these steps:

### Option 1: Hard Refresh (Quickest)
1. Press **Ctrl + Shift + Delete** (Windows) or **Cmd + Shift + Delete** (Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Press **Ctrl + F5** to hard refresh the page

### Option 2: Clear All Site Data (Most Thorough)
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **"Clear storage"** in the left sidebar
4. Click **"Clear site data"** button
5. Refresh the page (F5)

### Option 3: Use Incognito/Private Mode
1. Open a new Incognito/Private window
2. Navigate to your application
3. This bypasses all cached code

## What We Fixed:
- Changed all `.single()` calls to `.maybeSingle()` to prevent 406 errors
- Added proper error handling with null checks
- Improved error messages with better user feedback
- Added console logging for debugging

## After Clearing Cache:
The optimization page should now:
1. ✅ Display the match score at the top
2. ✅ Show the full job description with structured sections
3. ✅ Display match score in applications page
4. ✅ No more 406 errors

## If Error Persists:
1. Check browser console (F12) for specific error messages
2. Try a different browser
3. Verify you're logged in to your Supabase account
4. Check that the optimization ID in the URL is correct
