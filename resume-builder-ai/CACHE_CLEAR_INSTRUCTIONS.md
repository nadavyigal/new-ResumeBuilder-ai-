# Clear Browser Cache Instructions

If you're seeing the error: **"Error: Cannot coerce the result to a single JSON object"** or **406 errors**, this is likely due to cached old code in your browser.

## How to Fix

### Option 1: Hard Refresh (Recommended)
1. **Windows/Linux**: Press `Ctrl + Shift + R` or `Ctrl + F5`
2. **Mac**: Press `Cmd + Shift + R`

### Option 2: Clear Site Data
1. Open DevTools (`F12` or `Ctrl+Shift+I`)
2. Go to **Application** tab
3. Click **Clear site data**
4. Refresh the page

### Option 3: Incognito/Private Mode
1. Open an incognito/private window
2. Navigate to your app
3. This ensures no cache is used

### Option 4: Clear Cache Manually
1. Open DevTools (`F12`)
2. Right-click the refresh button
3. Select **Empty Cache and Hard Reload**

## Why This Happens

The old code used a query pattern that joined tables with `.single()`:
```typescript
.select("rewrite_data, resumes(raw_text), job_descriptions(raw_text)")
.single()  // ❌ This causes 406 errors
```

The new code separates queries:
```typescript
// ✅ Correct approach
.select("rewrite_data, resume_id, jd_id")
.single()
// Then fetch related data separately
```

## Still Having Issues?

If the problem persists after clearing cache:
1. Check the Network tab in DevTools
2. Look for the failing request to `/rest/v1/optimizations`
3. Share the full URL and error details
