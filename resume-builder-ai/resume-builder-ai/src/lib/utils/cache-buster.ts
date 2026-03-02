/**
 * Cache Buster Utility
 *
 * Helps prevent 406 errors from cached Supabase queries by:
 * 1. Adding version headers to API requests
 * 2. Detecting problematic query patterns
 * 3. Providing cache clear instructions
 */

// Increment this version when you make breaking changes to Supabase queries
export const APP_VERSION = '2.0.0';

/**
 * Add cache-busting headers to fetch requests
 */
export function getCacheBustingHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-App-Version': APP_VERSION,
  };
}

/**
 * Detect if a Supabase error is due to cached query issues
 */
export function isCacheError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message || error.toString();

  // Common cache-related error patterns
  const cacheErrorPatterns = [
    'Cannot coerce the result to a single JSON object',
    '406',
    'Not Acceptable',
    'PGRST116', // PostgREST error for multiple rows with .single()
  ];

  return cacheErrorPatterns.some(pattern =>
    errorMessage.includes(pattern)
  );
}

/**
 * Get user-friendly cache error message with instructions
 */
export function getCacheErrorMessage(): string {
  return `
The app has been updated with improved database queries. Please clear your browser cache:

**Quick Fix:**
- Windows/Linux: Press Ctrl + Shift + R
- Mac: Press Cmd + Shift + R

**Or:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

If the problem persists, try opening the app in an incognito/private window.
  `.trim();
}

/**
 * Wrapper for Supabase queries that handles cache errors gracefully
 */
export async function withCacheErrorHandling<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; isCacheError?: boolean }> {
  const result = await queryFn();

  if (result.error && isCacheError(result.error)) {
    return {
      ...result,
      isCacheError: true,
      error: new Error(getCacheErrorMessage()),
    };
  }

  return result;
}
